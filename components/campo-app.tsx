"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  FolderOpen,
  Sprout,
  ScanLine,
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
import { Empty, Loading, Modal, api } from "./shared";
import { WorkspacePanel } from "@/features/workspace/workspace-panel";
import { SyncPanel } from "@/features/field/sync-panel";
import { ProjectsPanel } from "@/features/projects/projects-panel";
import { NewObservation } from "@/features/observations/new-observation";
import { deleteDraft, listDrafts, type OfflineDraft } from "@/lib/offline/drafts";
import { ObservationDetail } from "@/features/observations/observation-detail";
import { SpeciesDetail } from "@/features/species/species-detail";
import { BackupPanel } from "@/features/backup/backup-panel";
import { NotebookPanel } from "@/features/notebook/notebook-panel";
import { LibraryPanel } from "@/features/library/library-panel";
import { ResearchPanel } from "@/features/research/research-panel";
import { CatalogExampleCards } from "@/features/catalog/example-cards";
import type { Catalog, Species } from "@/lib/validation/schemas";
import { normalize, dateLabel, statuses, distanceKm } from "@/lib/utils";
const FieldMap = dynamic(() => import("@/features/map/field-map"), {
  ssr: false,
  loading: () => <Loading />,
});
type Area = "projects" | "identify" | "field" | "catalog" | "research" | "notebook" | "library";
const navigation = [
  { id: "identify" as const, label: "Início", icon: LayoutGrid },
  { id: "projects" as const, label: "Projetos", icon: FolderOpen },
  { id: "catalog" as const, label: "Registros", icon: Library },
  { id: "library" as const, label: "Explorar", icon: BookOpen },
  { id: "notebook" as const, label: "Caderno", icon: NotebookPen },
];
export function CampoApp() {
  const [area, setArea] = useState<Area>("identify"),
    [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [newOpen, setNewOpen] = useState(false),
    [registrationChoice, setRegistrationChoice] = useState(false),
    [recordsView, setRecordsView] = useState<"observations" | "species" | "map">("observations"),
    [pendingQueueCount, setPendingQueueCount] = useState<number | null>(null),
    [fieldContext, setFieldContext] = useState<{ projectId: string; campaignId?: string } | null>(null),
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
  const openRegistration = (context?: { projectId: string; campaignId?: string }) => {
    setFieldContext(context || null);
    setRegistrationChoice(true);
  };
  const activeNavigationId = area === "field" ? "catalog" : area === "research" ? "library" : area;
  const refresh = useCallback(async () => {
    try {
      setData(await api<Catalog>("catalog"));
      setOfflineDrafts(await listDrafts());
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
  const showFirstUse = Boolean(
    data && pendingQueueCount === 0 && data.observations.length === 0 &&
    offlineDrafts.length === 0,
  );
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
        <span className="nav-caption">SEU ESPAÇO</span>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${activeNavigationId === n.id ? "active" : ""}`}
              onClick={() => { setArea(n.id); if (n.id === "catalog") setRecordsView("observations"); }}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {activeNavigationId === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <button className="nav-item nav-register" aria-label="Registrar encontro" title="Registrar encontro" onClick={() => openRegistration()}>
          <Plus size={19} /><span>Registrar</span>
        </button>
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
          <WorkspacePanel />
          <div className="breadcrumb">
            <span>Meu espaço</span>
            <ChevronRight size={13} />
            {navigation.find((n) => n.id === activeNavigationId)?.label}
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
                {area === "projects" ? "ORGANIZE SEU TRABALHO DE CAMPO" :
                  area === "identify" ? "SEU ESPAÇO DE CAMPO" :
                  area === "field" || area === "catalog" ? "OBSERVAÇÕES, ESPÉCIES E LUGARES" :
                  area === "notebook" ? "ANOTAÇÕES PESSOAIS" : "FLORA, SUBSTÂNCIAS E FONTES"}
              </span>
              <h1>
                {area === "projects" ? "Projetos de campo" :
                  area === "identify" ? "O que você quer fazer hoje?" :
                  area === "field" ? "Mapa de observações" :
                  area === "catalog" ? "Seus registros" :
                  area === "notebook" ? "Meu caderno" :
                  area === "library" ? "Explore e descubra" : "Pesquisa científica"}
              </h1>
              <p>
                {area === "projects" ? "Organize campanhas, locais e observações do seu trabalho de campo." :
                  area === "identify" ? "Registre um encontro, retome uma coleta ou acompanhe o que precisa de atenção." :
                  area === "field" ? "Veja onde e quando seus encontros foram registrados." :
                  area === "catalog" ? "Consulte observações e espécies reunidas no seu espaço." :
                  area === "notebook" ? "Guarde leituras, ideias e anotações para voltar quando quiser." :
                  area === "library" ? "Consulte fichas de plantas e relações documentadas com suas fontes." :
                  "Examine estudos e evidências antes de incorporar uma descoberta ao catálogo."}
              </p>
            </div>
            {area !== "identify" && area !== "projects" && <Button onClick={() => openRegistration()}>
              <Plus size={18} /> Registrar encontro
            </Button>}
          </div>
          {area === "catalog" && <div className="tabs flow-tabs" role="group" aria-label="Tipo de registro">
            <button type="button" aria-pressed={recordsView === "observations"} className={recordsView === "observations" ? "active" : ""} onClick={() => setRecordsView("observations")}>Observações</button>
            <button type="button" aria-pressed={recordsView === "species"} className={recordsView === "species" ? "active" : ""} onClick={() => setRecordsView("species")}>Espécies</button>
            <button type="button" aria-pressed={false} onClick={() => { setRecordsView("map"); setArea("field"); }}>Mapa</button>
          </div>}
          {area === "field" && <div className="tabs flow-tabs" role="group" aria-label="Tipo de registro">
            <button type="button" aria-pressed={false} onClick={() => { setRecordsView("observations"); setArea("catalog"); }}>Observações</button>
            <button type="button" aria-pressed={false} onClick={() => { setRecordsView("species"); setArea("catalog"); }}>Espécies</button>
            <button type="button" aria-pressed={true} className="active">Mapa</button>
          </div>}
          {(area === "library" || area === "research") && <div className="tabs flow-tabs" role="group" aria-label="Explorar">
            <button type="button" aria-pressed={area === "library"} className={area === "library" ? "active" : ""} onClick={() => setArea("library")}>Biblioteca de plantas</button>
            <button type="button" aria-pressed={area === "research"} className={area === "research" ? "active" : ""} onClick={() => setArea("research")}>Pesquisa e evidências</button>
          </div>}
          {!data ? (
            <Loading />
          ) : (
            <>
                  {area === "identify" && !hasFilters && (
                <>
                  {showFirstUse ? <section className="first-use panel" aria-labelledby="first-use-title">
                    <span className="pill">PRIMEIROS PASSOS</span>
                    <h2 id="first-use-title">{data.projects.length ? "Seu próximo passo é registrar um encontro." : "Comece com um encontro."}</h2>
                    <p>Você pode registrar sem criar um projeto. Se estiver em campo sem internet, a coleta fica neste aparelho até poder ser enviada.</p>
                    <div className="first-use-actions">
                      <Button onClick={() => openRegistration()}><ScanLine size={17} /> Registrar primeiro encontro <ArrowRight size={16} /></Button>
                      <Button variant="outline" onClick={() => setArea("projects")}><FolderOpen size={16} /> {data.projects.length ? "Abrir projetos" : "Criar um projeto"}</Button>
                      <Button variant="ghost" onClick={() => setArea("library")}><BookOpen size={16} /> Explorar a biblioteca</Button>
                    </div>
                    <small>{data.projects.length ? "Para vincular o registro, abra o projeto e comece a coleta por lá." : "Projetos são opcionais. Você pode vincular um registro a eles depois."}</small>
                  </section> : <section className="hero panel">
                    <div className="hero-copy">
                      <span className="pill">
                        <span className="pulse-dot" /> REGISTRE NO SEU RITMO
                      </span>
                      <h2>
                        Observe, registre,
                        <br />
                        <em>volte quando quiser.</em>
                      </h2>
                      <p>
                        Escolha como registrar seu encontro.
                        <br />
                        Você pode identificar agora ou coletar offline.
                      </p>
                      <div className="actions">
                        <Button onClick={() => openRegistration()}>
                          <ScanLine size={17} /> Escolher como registrar{" "}
                          <ArrowRight size={17} />
                        </Button>
                        <button
                          className="text-button"
                          onClick={() => { setRecordsView("observations"); setArea("catalog"); }}
                        >
                          Ver meus registros <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="hero-foot">
                        <ShieldCheck size={14} /> Privado por natureza <span />{" "}
                        Confirmação sempre manual
                      </div>
                    </div>
                    <Botanical />
                  </section>}
                  <section className="offline-drafts panel" aria-label="Rascunhos no aparelho">
                    <div className="offline-drafts-heading"><HardDriveDownload size={20} /><div><h2>Rascunhos para identificar {offlineDrafts.length > 0 && <span>{offlineDrafts.length}</span>}</h2><p>Registros guardados neste navegador aguardam identificação e envio. As fotos ficam aqui até você decidir quais guardar.</p></div></div>
                    {draftError && <p role="alert" className="error">{draftError}</p>}
                    {offlineDrafts.length ? <div className="offline-draft-list">{offlineDrafts.map(item => <article key={item.id}>
                      <div><strong>{item.data.region || (item.data.group === "plant" ? "Planta sem local informado" : "Fungo sem local informado")}</strong><small>{new Date(item.data.observedAt).toLocaleString("pt-BR")} · {item.photos.length} {item.photos.length === 1 ? "foto" : "fotos"}</small></div>
                      <div className="offline-draft-actions"><Button type="button" size="sm" onClick={() => { setFieldContext(null); setResumeDraft(item); setNewOpen(true); }}>Continuar rascunho</Button><Button type="button" size="sm" variant="outline" onClick={async () => {
                        if (!window.confirm("Excluir este rascunho e suas fotos deste aparelho?")) return;
                        try { await deleteDraft(item.id); await refreshDrafts(); } catch (cause) { setDraftError((cause as Error).message); }
                      }}>Excluir rascunho</Button></div>
                    </article>)}</div> : <p className="offline-drafts-empty">Nenhum rascunho pendente. Se perder a conexão no campo, abra o Campo para registrar fotos e notas sem enviar nada ao servidor.</p>}
                  </section>
                  <SyncPanel refresh={refresh} onPendingCount={setPendingQueueCount} />
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
              {((area === "identify" && (!showFirstUse || observations.length > 0 || hasFilters)) || area === "catalog" || area === "field") && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>
                        {hasFilters
                          ? "Resultados da busca"
                          : area === "identify" ? "Atividade recente" :
                            area === "field" ? "Mapa de observações" :
                            recordsView === "species" ? "Espécies" : "Observações"}
                      </h2>
                      <span>
                        {recordsView === "species" ? species.length : observations.length}{" "}
                        {recordsView === "species" ? "espécies" : "registros"}
                      </span>
                    </div>
                    {area === "identify" && (
                      <button
                        className="text-button"
                        onClick={() => { setRecordsView("observations"); setArea("catalog"); }}
                      >
                        Ver todas as observações <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                  {area !== "identify" && <div className="catalog-toolbar">
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
                      {area !== "field" && recordsView !== "map" && (
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
                  </div>}
                  {filters && area !== "identify" && (
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
                  {area === "field" || recordsView === "map" ? (
                    <FieldMap
                      samplingSites={data.samplingSites}
                      observations={observations}
                      species={data.species}
                      onOpen={setObservationId}
                    />
                  ) : recordsView === "species" ? (
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
                            onClick={() => openRegistration()}
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
                        .slice(0, area === "identify" && !hasFilters ? 5 : undefined)
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
                          onClick={() => openRegistration()}
                        >
                          <Plus size={16} /> Criar primeira observação
                        </Button>
                      }
                    />
                  )}
                </>
              )}
              {area === "catalog" && recordsView === "species" && species.length === 0 && !hasFilters && <CatalogExampleCards onNew={() => openRegistration()} view={view as "grid" | "list"} />}
              {area === "projects" && <SyncPanel refresh={refresh} onPendingCount={setPendingQueueCount} />}
              {area === "projects" && <ProjectsPanel data={data} query={query} refresh={refresh} onObservation={setObservationId} onNew={(projectId, campaignId) => openRegistration({ projectId, campaignId })} />}
              {area === "library" && <><LibraryPanel query={query} /><div className="explore-inspiration"><ReflectionCard /><NatureCard /></div></>}
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
                  Backup e dados <span className="pulse-dot" />
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
      {registrationChoice && <Modal title="Registrar um encontro" subtitle={fieldContext ? "Este registro ficará ligado ao projeto selecionado." : "Este registro será pessoal. Para vinculá-lo a um projeto, comece pela tela do projeto."} onClose={() => { setRegistrationChoice(false); setFieldContext(null); }}>
        <div className="registration-options">
          <button type="button" className="registration-option panel" onClick={() => { setRegistrationChoice(false); setNewOpen(true); }}>
            <ScanLine size={22} /><span><strong>Identificar com fotos</strong><small>Receba sugestões, revise as evidências e escolha quais fotos guardar.</small></span><ArrowRight size={17} />
          </button>
          <a className="registration-option panel" href={fieldContext ? `/collect.html?project=${encodeURIComponent(fieldContext.projectId)}${fieldContext.campaignId ? `&campaign=${encodeURIComponent(fieldContext.campaignId)}` : ""}` : "/collect.html"}>
            <MapPin size={22} /><span><strong>Coletar agora, identificar depois</strong><small>Registre notas e fotos mesmo sem internet. A coleta sincroniza quando voltar à rede.</small></span><ArrowRight size={17} />
          </a>
        </div>
      </Modal>}
      {newOpen && (
        <NewObservation
          key={resumeDraft?.id || "new"}
          draft={resumeDraft}
          projects={data?.projects || []}
          campaigns={data?.campaigns || []}
          samplingSites={data?.samplingSites || []}
          projectId={fieldContext?.projectId}
          campaignId={fieldContext?.campaignId}
          onClose={() => { setNewOpen(false); setResumeDraft(null); setFieldContext(null); }}
          onDraftSaved={async () => { await refreshDrafts(); setNewOpen(false); setResumeDraft(null); setFieldContext(null); setNotice("Rascunho guardado neste aparelho. Retome quando quiser."); }}
          onSaved={async (id, message) => {
            setNewOpen(false);
            setResumeDraft(null);
            setFieldContext(null);
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
