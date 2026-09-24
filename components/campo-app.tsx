"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Sprout,
  ScanLine,
  Map,
  Library,
  FlaskConical,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Leaf,
  TreeDeciduous,
  Database,
  Download,
  SlidersHorizontal,
  LayoutGrid,
  List,
  MapPin,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  NotebookPen,
  HardDriveDownload,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Botanical } from "./botanical";
import { NatureCard } from "@/features/nature/nature-card";
import { ReflectionCard } from "@/features/reflections/reflection-card";
import { Empty, Loading, api } from "./shared";
import { NewObservation } from "@/features/observations/new-observation";
import { deleteDraft, listDrafts, type OfflineDraft } from "@/lib/offline/drafts";
import { ObservationDetail } from "@/features/observations/observation-detail";
import { SpeciesDetail } from "@/features/species/species-detail";
import { BackupPanel } from "@/features/backup/backup-panel";
import { NotebookPanel } from "@/features/notebook/notebook-panel";
import { LibraryPanel } from "@/features/library/library-panel";
import { ResearchPanel } from "@/features/research/research-panel";
import { IdentificationExampleCards } from "@/features/identification/example-cards";
import type { Catalog, Species } from "@/lib/validation/schemas";
import { normalize, dateLabel, statuses, distanceKm } from "@/lib/utils";
const FieldMap = dynamic(() => import("@/features/map/field-map"), {
  ssr: false,
  loading: () => <Loading />,
});
type Area = "identify" | "field" | "catalog" | "research" | "notebook" | "library";
const navigation = [
  { id: "identify" as const, label: "Identificar", icon: ScanLine },
  { id: "field" as const, label: "Campo", icon: Map },
  { id: "catalog" as const, label: "Catálogo", icon: Library },
  { id: "library" as const, label: "Biblioteca", icon: BookOpen },
  { id: "notebook" as const, label: "Meu caderno", icon: NotebookPen },
  { id: "research" as const, label: "Pesquisa", icon: FlaskConical },
];
export function CampoApp() {
  const [area, setArea] = useState<Area>("identify"),
    [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [newOpen, setNewOpen] = useState(false),
    [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]),
    [resumeDraft, setResumeDraft] = useState<OfflineDraft | null>(null),
    [draftError, setDraftError] = useState(""),
    [observationId, setObservationId] = useState<string | null>(null),
    [speciesId, setSpeciesId] = useState<string | null>(null),
    [backups, setBackups] = useState(false),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("all"),
    [status, setStatus] = useState("all"),
    [filters, setFilters] = useState(false),
    [view, setView] = useState("grid"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [property, setProperty] = useState(""),
    [evidenceType, setEvidenceType] = useState(""),
    [radius, setRadius] = useState(""),
    [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const refresh = useCallback(async () => {
    try {
      setData(await api<Catalog>("catalog"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const refreshDrafts = useCallback(async () => {
    try { setOfflineDrafts(await listDrafts()); setDraftError(""); }
    catch (cause) { setDraftError((cause as Error).message); }
  }, []);
  useEffect(() => {
    void refresh();
    void refreshDrafts();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [refresh, refreshDrafts]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const speciesById = useMemo(
    () => new globalThis.Map(data?.species.map((s) => [s.id, s]) || []),
    [data],
  );
  const matchesSpecies = (s: Species) => {
    const evidence = data!.evidence.filter((e) => e.speciesId === s.id);
    const compounds = data!.compounds.filter((c) =>
      evidence.some((e) => e.compoundId === c.id),
    );
    return (
      (!property ||
        evidence.some((e) =>
          normalize(e.property).includes(normalize(property)),
        )) &&
      (!evidenceType || evidence.some((e) => e.type === evidenceType)) &&
      (!query ||
        normalize(JSON.stringify([s, evidence, compounds])).includes(
          normalize(query),
        ))
    );
  };
  const observations =
    data?.observations.filter((o) => {
      const s = o.speciesId ? speciesById.get(o.speciesId) : null;
      const text = normalize(
        JSON.stringify([
          o,
          s,
          data.evidence.filter((e) => e.speciesId === s?.id),
          data.compounds.filter((c) =>
            data.evidence.some(
              (e) => e.speciesId === s?.id && e.compoundId === c.id,
            ),
          ),
        ]),
      );
      return (
        (group === "all" || o.group === group) &&
        (status === "all" || o.status === status) &&
        (!query || text.includes(normalize(query))) &&
        (!from || o.observedAt.slice(0, 10) >= from) &&
        (!to || o.observedAt.slice(0, 10) <= to) &&
        (!property ||
          (!!s &&
            data.evidence.some(
              (e) =>
                e.speciesId === s.id &&
                normalize(e.property).includes(normalize(property)),
            ))) &&
        (!evidenceType ||
          (!!s &&
            data.evidence.some(
              (e) => e.speciesId === s.id && e.type === evidenceType,
            ))) &&
        (!radius ||
          !center ||
          (o.latitude !== null &&
            o.longitude !== null &&
            distanceKm(center.lat, center.lon, o.latitude, o.longitude) <=
              Number(radius)))
      );
    }) || [];
  const species =
    data?.species.filter(
      (s) =>
        (group === "all" || s.group === group) &&
        matchesSpecies(s) &&
        ((!from && !to && status === "all" && !radius) ||
          observations.some((o) => o.speciesId === s.id)),
    ) || [];
  const hasFilters =
    !!query ||
    group !== "all" ||
    status !== "all" ||
    !!from ||
    !!to ||
    !!property ||
    !!evidenceType ||
    !!radius;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <div className="brand-mark">
            <Sprout size={28} />
          </div>
          <span>
            campo<small>CATÁLOGO PESSOAL</small>
          </span>
        </a>
        <span className="nav-caption">EXPLORAR</span>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${area === n.id ? "active" : ""}`}
              onClick={() => setArea(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {area === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="small-orbit">
            <Sprout size={28} />
          </div>
          <p>
            O conhecimento cresce
            <br />a cada encontro.
          </p>
          <span>OBSERVE. REGISTRE. DESCUBRA.</span>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setBackups(true)}>
            <Database size={17} /> Dados e backup <ArrowUpRight size={14} />
          </button>
          <div className="local-status">
            <span />{" "}
            {data?.storageMode === "supabase"
              ? "Salvo na nuvem"
              : "Armazenamento local"}
          </div>
          <small>Seu catálogo. Seus dados.</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Meu espaço</span>
            <ChevronRight size={13} />
            {navigation.find((n) => n.id === area)?.label}
          </div>
          <div className="search-box">
            <Search size={17} />
            <input
              id="global-search"
              aria-label="Busca global"
              placeholder="Buscar no seu catálogo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button aria-label="Limpar busca" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </div>
          <button
            className="avatar"
            title={data?.passwordConfigured ? "Sair" : "Catálogo local"}
            aria-label={data?.passwordConfigured ? "Sair" : "Catálogo local"}
            onClick={async () => {
              if (data?.passwordConfigured) {
                await fetch("/api/auth", { method: "DELETE" });
                location.href = "/login";
              }
            }}
          >
            {data?.passwordConfigured ? (
              <LogOut size={16} />
            ) : (
              <Sprout size={20} />
            )}
          </button>
        </header>
        <main className="main-content">
          {error && (
            <div role="alert" className="error">
              {error} <button onClick={refresh}>Tentar novamente</button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {area === "identify"
                  ? "CURIOSIDADE EM ESTADO NATURAL"
                  : area === "field"
                    ? "SEUS ENCONTROS NO TERRITÓRIO"
                    : area === "catalog"
                      ? "CONHECIMENTO QUE CRIA RAÍZES"
                      : area === "notebook"
                        ? "SEU LIVRO EM CONSTRUÇÃO"
                        : area === "library"
                          ? "FLORA DOCUMENTADA DO RIO GRANDE DO SUL"
                        : "PLANTAS · SUBSTÂNCIAS · FONTES"}
              </span>
              <h1>
                {area === "identify"
                  ? "Cada encontro, uma descoberta."
                  : area === "field"
                    ? "Seu caderno de campo."
                    : area === "catalog"
                      ? "Um catálogo em crescimento."
                      : area === "notebook"
                        ? "Meu caderno"
                        : area === "library"
                          ? "Biblioteca de plantas"
                        : "Explore substâncias em plantas."}
              </h1>
              <p>
                {area === "identify"
                  ? "Um lugar para observar, identificar e conhecer o que vive ao seu redor."
                  : area === "field"
                    ? "Explore onde e quando você encontrou cada organismo."
                    : area === "catalog"
                      ? "Espécies, histórias e detalhes que você decidiu preservar."
                      : area === "notebook"
                        ? "Um espaço para suas leituras, ideias e anotações. Escreva livremente e volte quando quiser."
                        : area === "library"
                          ? "Plantas encontradas no RS, com usos, composição e fontes para consultar."
                        : "Encontre relações documentadas e examine a evidência antes de incorporá-las ao seu catálogo."}
              </p>
            </div>
            <Button onClick={() => setNewOpen(true)}>
              <Plus size={18} /> Nova observação
            </Button>
          </div>
          {!data ? (
            <Loading />
          ) : (
            <>
              {area === "identify" && !hasFilters && (
                <>
                  <section className="hero panel">
                    <div className="hero-copy">
                      <span className="pill">
                        <span className="pulse-dot" /> SEU PRÓXIMO ACHADO COMEÇA
                        AQUI
                      </span>
                      <h2>
                        Olhe mais de perto.
                        <br />
                        <em>Há muito por descobrir.</em>
                      </h2>
                      <p>
                        Uma folha, um fungo, uma nova pergunta.
                        <br />
                        Registre o encontro e construa seu próprio conhecimento.
                      </p>
                      <div className="actions">
                        <Button onClick={() => setNewOpen(true)}>
                          <ScanLine size={17} /> Identificar um organismo{" "}
                          <ArrowRight size={17} />
                        </Button>
                        <button
                          className="text-button"
                          onClick={() => setArea("research")}
                        >
                          Explorar substâncias <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <div className="hero-foot">
                        <ShieldCheck size={14} /> Privado por natureza <span />{" "}
                        Confirmação sempre manual
                      </div>
                    </div>
                    <Botanical />
                  </section>
                  <section className="offline-drafts panel" aria-label="Rascunhos no aparelho">
                    <div className="offline-drafts-heading"><HardDriveDownload size={20} /><div><h2>Rascunhos no aparelho {offlineDrafts.length > 0 && <span>{offlineDrafts.length}</span>}</h2><p>Registros feitos sem conexão aguardam identificação e envio. As fotos continuam neste navegador até você decidir quais guardar.</p></div></div>
                    {draftError && <p role="alert" className="error">{draftError}</p>}
                    {offlineDrafts.length ? <div className="offline-draft-list">{offlineDrafts.map(item => <article key={item.id}>
                      <div><strong>{item.data.region || (item.data.group === "plant" ? "Planta sem local informado" : "Fungo sem local informado")}</strong><small>{new Date(item.data.observedAt).toLocaleString("pt-BR")} · {item.photos.length} {item.photos.length === 1 ? "foto" : "fotos"}</small></div>
                      <div className="offline-draft-actions"><Button type="button" size="sm" onClick={() => { setResumeDraft(item); setNewOpen(true); }}>Continuar rascunho</Button><Button type="button" size="sm" variant="outline" onClick={async () => {
                        if (!window.confirm("Excluir este rascunho e suas fotos deste aparelho?")) return;
                        try { await deleteDraft(item.id); await refreshDrafts(); } catch (cause) { setDraftError((cause as Error).message); }
                      }}>Excluir rascunho</Button></div>
                    </article>)}</div> : <p className="offline-drafts-empty">Nenhum rascunho pendente. Se perder a conexão no campo, abra o Campo para registrar fotos e notas sem enviar nada ao servidor.</p>}
                  </section>
                  <ReflectionCard />
                  <NatureCard />
                  <button className="library-home-link panel" onClick={() => setArea("research")}><FlaskConical size={20} /><span><strong>Quais compostos foram relatados nesta planta?</strong><small>Explore relações com referências no LOTUS</small></span><ArrowRight size={17} /></button>
                  <button className="library-home-link panel" onClick={() => setArea("library")}><BookOpen size={20} /><span><strong>Conheça a flora do Rio Grande do Sul</strong><small>Biblioteca com fichas e fontes consultáveis</small></span><ArrowRight size={17} /></button>
                  <div className="stats-grid">
                    {[
                      {
                        label: "Observações",
                        value: data.observations.length,
                        icon: ScanLine,
                        note: "Encontros registrados",
                      },
                      {
                        label: "Espécies no catálogo",
                        value: data.species.length,
                        icon: Leaf,
                        note: "Diversidade conhecida",
                      },
                      {
                        label: "Aguardando identificação",
                        value: data.observations.filter((o) =>
                          ["unidentified", "candidates"].includes(o.status),
                        ).length,
                        icon: BookOpen,
                        note: "Perguntas em aberto",
                      },
                      {
                        label: "Descobertas científicas",
                        value: data.discoveries.length,
                        icon: FlaskConical,
                        note: "Novas conexões",
                      },
                    ].map((s) => (
                      <div className="stat panel" key={s.label}>
                        <div>
                          <span>{s.label}</span>
                          <s.icon size={18} />
                        </div>
                        <strong>{String(s.value).padStart(2, "0")}</strong>
                        <small>{s.note}</small>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {area !== "research" && area !== "notebook" && area !== "library" && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>
                        {hasFilters
                          ? "Resultados da busca"
                          : area === "catalog"
                            ? "Minhas espécies"
                            : area === "field"
                              ? "Mapa de observações"
                              : "Últimas observações"}
                      </h2>
                      <span>
                        {area === "catalog"
                          ? species.length
                          : observations.length}{" "}
                        {area === "catalog" ? "espécies" : "registros"}
                      </span>
                    </div>
                    {area === "identify" && (
                      <button
                        className="text-button"
                        onClick={() => setArea("field")}
                      >
                        Ver todas <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                  <div className="catalog-toolbar">
                    <div className="tabs">
                      <button
                        className={group === "all" ? "active" : ""}
                        onClick={() => setGroup("all")}
                      >
                        Todos
                      </button>
                      <button
                        className={group === "plant" ? "active" : ""}
                        onClick={() => setGroup("plant")}
                      >
                        <Leaf size={14} /> Plantas
                      </button>
                      <button
                        className={group === "fungus" ? "active" : ""}
                        onClick={() => setGroup("fungus")}
                      >
                        <TreeDeciduous size={14} /> Fungos
                      </button>
                    </div>
                    <div className="actions">
                      <button
                        className={`filter-button ${filters ? "selected" : ""}`}
                        onClick={() => setFilters(!filters)}
                      >
                        <SlidersHorizontal size={15} /> Filtros
                      </button>
                      {area !== "field" && (
                        <div className="view-toggle">
                          <button
                            aria-label="Visualizar em grade"
                            className={view === "grid" ? "active" : ""}
                            onClick={() => setView("grid")}
                          >
                            <LayoutGrid size={16} />
                          </button>
                          <button
                            aria-label="Visualizar em lista"
                            className={view === "list" ? "active" : ""}
                            onClick={() => setView("list")}
                          >
                            <List size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {filters && (
                    <div className="filters panel">
                      <label>
                        Status
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="all">Todos os status</option>
                          {Object.entries(statuses).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        De
                        <input
                          aria-label="De"
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                        />
                      </label>
                      <label>
                        Até
                        <input
                          aria-label="Até"
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                        />
                      </label>
                      <label>
                        Propriedade
                        <input
                          value={property}
                          onChange={(e) => setProperty(e.target.value)}
                          placeholder="Ex.: medicinal"
                        />
                      </label>
                      <label>
                        Evidência
                        <select
                          value={evidenceType}
                          onChange={(e) => setEvidenceType(e.target.value)}
                        >
                          <option value="">Todas</option>
                          {[
                            ["personal", "Pessoal"],
                            ["observation", "Observação"],
                            ["traditional", "Tradicional"],
                            ["anecdotal", "Relato anedótico"],
                            ["in_vitro", "In vitro"],
                            ["animal", "Animal"],
                            ["human", "Humano"],
                            ["review", "Revisão"],
                            ["meta_analysis", "Metanálise"],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Distância (km)
                        <input
                          type="number"
                          min="1"
                          value={radius}
                          onChange={(e) => {
                            setRadius(e.target.value);
                            if (e.target.value && !center)
                              navigator.geolocation?.getCurrentPosition(
                                (p) =>
                                  setCenter({
                                    lat: p.coords.latitude,
                                    lon: p.coords.longitude,
                                  }),
                                () => {
                                  setNotice(
                                    "Localização indisponível; o filtro de distância foi desativado.",
                                  );
                                  setRadius("");
                                },
                              );
                          }}
                          placeholder="Da minha localização"
                        />
                      </label>
                      <button
                        className="text-button"
                        onClick={() => {
                          setQuery("");
                          setGroup("all");
                          setStatus("all");
                          setFrom("");
                          setTo("");
                          setProperty("");
                          setEvidenceType("");
                          setRadius("");
                        }}
                      >
                        Limpar filtros
                      </button>
                    </div>
                  )}
                  {area === "field" ? (
                    <FieldMap
                      observations={observations}
                      species={data.species}
                      onOpen={setObservationId}
                    />
                  ) : area === "catalog" ? (
                    species.length ? (
                      <div
                        className={`cards ${view === "list" ? "list-view" : ""}`}
                      >
                        {species.map((s) => {
                          const obs = data.observations.filter(
                            (o) => o.speciesId === s.id,
                          );
                          const photo = obs.flatMap((o) => o.photos)[0];
                          return (
                            <button
                              key={s.id}
                              className="organism-card panel"
                              onClick={() => setSpeciesId(s.id)}
                            >
                              <div className="card-photo">
                                {photo ? (
                                  <img
                                    src={`/api/images/${photo.id}`}
                                    alt={s.scientificName}
                                  />
                                ) : (
                                  <Leaf size={58} />
                                )}
                                <span className="photo-label">
                                  {s.group === "plant" ? "PLANTA" : "FUNGO"}
                                </span>
                              </div>
                              <div className="card-body">
                                <small>
                                  {s.family || "Família não informada"}
                                </small>
                                <h3>
                                  <em>{s.scientificName}</em>
                                </h3>
                                <p>
                                  {s.commonNames.join(", ") ||
                                    "Nome popular não registrado"}
                                </p>
                                <div className="card-meta">
                                  {obs.length} observações{" "}
                                  <ArrowUpRight size={15} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty
                        icon={<Library size={30} />}
                        title={
                          hasFilters
                            ? "Nenhuma espécie encontrada"
                            : "Seu catálogo começa com um encontro."
                        }
                        text={
                          hasFilters
                            ? "Experimente outros termos ou limpe os filtros."
                            : "Registre uma observação e atribua uma identificação para criar a primeira ficha."
                        }
                        action={
                          <Button
                            variant="outline"
                            onClick={() => setNewOpen(true)}
                          >
                            <Plus size={16} /> Registrar um encontro
                          </Button>
                        }
                      />
                    )
                  ) : observations.length ? (
                    <div
                      className={`cards ${view === "list" ? "list-view" : ""}`}
                    >
                      {observations
                        .slice(0, area === "identify" ? 12 : undefined)
                        .map((o) => {
                          const s = o.speciesId
                            ? speciesById.get(o.speciesId)
                            : null;
                          return (
                            <button
                              className="organism-card panel"
                              key={o.id}
                              onClick={() => setObservationId(o.id)}
                            >
                              <div className="card-photo">
                                {o.photos[0] ? (
                                  <img
                                    src={`/api/images/${o.photos[0].id}`}
                                    alt={s?.scientificName || o.code}
                                  />
                                ) : (
                                  <Leaf size={58} />
                                )}
                                <span className="photo-label">
                                  {o.group === "plant" ? "PLANTA" : "FUNGO"}
                                </span>
                                <span
                                  className={`status-dot ${o.status === "unidentified" ? "pending" : ""}`}
                                />
                              </div>
                              <div className="card-body">
                                <small>{o.code}</small>
                                <h3>
                                  {s ? (
                                    <em>{s.scientificName}</em>
                                  ) : (
                                    "Um encontro por identificar"
                                  )}
                                </h3>
                                <p>
                                  <MapPin size={13} />
                                  {o.region || "Local não informado"}
                                </p>
                                <div className="card-meta">
                                  <span>{dateLabel(o.observedAt)}</span>
                                  <span className="status-label">
                                    {statuses[o.status]}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <Empty
                      icon={<Sprout size={35} />}
                      title={
                        hasFilters
                          ? "Nenhum encontro por aqui."
                          : "Seu primeiro encontro está lá fora."
                      }
                      text={
                        hasFilters
                          ? "Ajuste a busca ou os filtros para explorar seus registros."
                          : "Fotografe uma planta ou um fungo. O resto pode ser descoberto no caminho."
                      }
                      action={
                        <Button
                          variant="outline"
                          onClick={() => setNewOpen(true)}
                        >
                          <Plus size={16} /> Criar primeira observação
                        </Button>
                      }
                    />
                  )}
                </>
              )}
              {area === "identify" && !hasFilters && <IdentificationExampleCards onNew={() => setNewOpen(true)} />}
              {area === "library" && <LibraryPanel query={query} />}
              {area === "notebook" && (
                <NotebookPanel notes={data.notes} query={query} refresh={refresh} />
              )}
              {area === "research" && (
                <ResearchPanel
                  data={data}
                  refresh={refresh}
                  query={query}
                  onSpecies={setSpeciesId}
                />
              )}
              {area === "identify" && !hasFilters && (
                <div className="bottom-notes">
                  <div>
                    <Leaf size={18} />
                    <p>
                      <strong>Identificar é um processo.</strong>
                      <span>
                        Compare evidências. A decisão final é sempre sua.
                      </span>
                    </p>
                  </div>
                  <button onClick={() => setBackups(true)}>
                    <Download size={18} />
                    <p>
                      <strong>Seu conhecimento, preservado.</strong>
                      <span>
                        Exporte um backup completo a qualquer momento.
                      </span>
                    </p>
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              )}
              <footer className="main-footer">
                <span>
                  <Sprout size={13} /> Campo · Catálogo
                </span>
                <span>Feito para observar com calma.</span>
                <button onClick={() => setBackups(true)}>
                  Dados locais <span className="pulse-dot" />
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
      {newOpen && (
        <NewObservation
          key={resumeDraft?.id || "new"}
          draft={resumeDraft}
          onClose={() => { setNewOpen(false); setResumeDraft(null); }}
          onDraftSaved={async () => { await refreshDrafts(); setNewOpen(false); setResumeDraft(null); setNotice("Rascunho guardado neste aparelho. Retome quando quiser."); }}
          onSaved={async (id, message) => {
            setNewOpen(false);
            setResumeDraft(null);
            await refresh();
            await refreshDrafts();
            setObservationId(id);
            if (message) setNotice(message);
          }}
        />
      )}
      {observationId && data && (
        <ObservationDetail
          id={observationId}
          catalog={data}
          onClose={() => setObservationId(null)}
          onChanged={refresh}
          onDeleted={async (message) => {
            setObservationId(null);
            setData((current) =>
              current
                ? {
                    ...current,
                    observations: current.observations.filter(
                      (o) => o.id !== observationId,
                    ),
                  }
                : current,
            );
            setNotice(message);
            await refresh();
          }}
          onSpecies={(id) => {
            setObservationId(null);
            setSpeciesId(id);
          }}
        />
      )}
      {speciesId && data && (
        <SpeciesDetail
          id={speciesId}
          catalog={data}
          onClose={() => setSpeciesId(null)}
          onChanged={refresh}
          onObservation={(id) => {
            setSpeciesId(null);
            setObservationId(id);
          }}
        />
      )}
      {backups && (
        <BackupPanel onClose={() => setBackups(false)} onChanged={refresh} />
      )}
    </div>
  );
}
