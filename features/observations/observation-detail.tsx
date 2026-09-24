"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ScanLine,
  Trash2,
  Check,
  ArrowUpRight,
  MapPin,
  Clock,
  RefreshCw,
  Save,
  Leaf,
} from "lucide-react";
import {
  Modal,
  Field,
  ErrorText,
  Loading,
  api,
  send,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { dateLabel, statuses, distanceKm } from "@/lib/utils";
import type {
  Observation,
  Photo,
  Identification,
  Catalog,
  Candidate,
} from "@/lib/validation/schemas";
import type { SourceResult } from "@/lib/providers/types";
type Detail = Observation & {
  photos: Photo[];
  identifications: Identification[];
  history: {
    id: string;
    previousStatus: string;
    status: string;
    note: string;
    createdAt: string;
  }[];
  context: {
    observation: Observation;
    sameRegion: boolean;
    sameMonth: boolean;
    sameHabitat: boolean;
    sameSubstrate: boolean;
    morphologyMatches: string[];
  }[];
};
export function ObservationDetail({
  id,
  catalog,
  onClose,
  onChanged,
  onDeleted,
  onSpecies,
}: {
  id: string;
  catalog: Catalog;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDeleted: (message: string) => Promise<void>;
  onSpecies: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<Candidate | null>(null),
    [status, setStatus] = useState("user_identified"),
    [sources, setSources] = useState<SourceResult[]>([]),
    [comparisonName, setComparisonName] = useState(""),
    [photo, setPhoto] = useState(0),
    [editing, setEditing] = useState(false);
  const load = useCallback(async () => {
    try {
      const d = await api<Detail>(`observations/${id}`);
      setData(d);
      setName(
        catalog.species.find((s) => s.id === d.speciesId)?.scientificName || "",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, catalog.species]);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      await onChanged();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const latest = data?.identifications.at(-1);
  return (
    <Modal
      title={data?.code || "Observação"}
      subtitle={
        data
          ? `${data.group === "plant" ? "Planta" : "Fungo"} · ${dateLabel(data.observedAt)} · ${statuses[data.status]}`
          : undefined
      }
      onClose={onClose}
      wide
    >
      <ErrorText message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          {confirmDelete && (
            <section
              className="panel"
              role="alertdialog"
              aria-labelledby="delete-observation-title"
              aria-describedby="delete-observation-description"
              style={{ padding: 20, marginBottom: 20 }}
            >
              <h2 id="delete-observation-title">Excluir {data.code}?</h2>
              <p id="delete-observation-description">
                Esta ação remove a observação, suas consultas de identificação,
                histórico e fotos guardadas. A ficha da espécie e as outras
                observações permanecem. Não é possível desfazer; backups
                anteriores não serão alterados.
              </p>
              <div className="actions">
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancelar exclusão
                </Button>
                <Button
                  variant="destructive"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy("delete");
                    setError("");
                    try {
                      const result = await api<{ pendingFiles: number }>(
                        `observations/${id}`,
                        { ...send({ confirm: true }), method: "DELETE" },
                      );
                      await onDeleted(
                        result.pendingFiles
                          ? "Identificação excluída. A remoção de alguns arquivos está pendente e será tentada novamente ao carregar o catálogo."
                          : "Identificação e fotos excluídas.",
                      );
                    } catch (error) {
                      setError((error as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {busy === "delete" ? "Excluindo…" : "Excluir definitivamente"}
                </Button>
              </div>
            </section>
          )}
          <div className="observation-layout">
            <div>
              <div className="detail-photo">
                {!data.photos.length && (
                  <p className="muted">
                    Nenhuma foto foi guardada nesta observação.
                  </p>
                )}
                {data.photos[photo] && (
                  <img
                    src={`/api/images/${data.photos[photo].id}?variant=optimized`}
                    alt={`Foto ${photo + 1} de ${data.code}`}
                  />
                )}
              </div>
              <div className="photo-strip">
                {data.photos.map((p, i) => (
                  <button
                    key={p.id}
                    className={photo === i ? "selected" : ""}
                    onClick={() => setPhoto(i)}
                    aria-label={`Ver foto ${i + 1}`}
                  >
                    <img src={`/api/images/${p.id}`} alt="" />
                  </button>
                ))}
              </div>
              {data.photos[photo] && (
                <a
                  className="text-button"
                  href={`/api/images/${data.photos[photo].id}?variant=original`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir original <ArrowUpRight size={13} />
                </a>
              )}
            </div>
            <div className="observation-info">
              <span className="pill">MEUS DADOS</span>
              <h3>
                {catalog.species.find((s) => s.id === data.speciesId)
                  ?.scientificName || "Identidade em aberto"}
              </h3>
              <p>
                <MapPin size={14} />
                {data.region || "Local não informado"}
              </p>
              <p>
                <Clock size={14} />
                {new Date(data.observedAt).toLocaleString("pt-BR")}
              </p>
              <dl>
                {[
                  ["Habitat", data.habitat],
                  ["Substrato", data.substrate],
                  ["Vegetação", data.vegetation],
                  ["Luminosidade", data.light],
                  [
                    "Altitude",
                    data.altitude !== null ? `${data.altitude} m` : "",
                  ],
                  [
                    "Coordenadas",
                    data.latitude !== null
                      ? `${data.latitude}, ${data.longitude}`
                      : "",
                  ],
                  ...Object.entries(data.morphology),
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              {data.notes && <p className="notes">{data.notes}</p>}
              <div className="actions">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} /> Excluir identificação
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(!editing)}
                >
                  Editar dados
                </Button>
                {data.speciesId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSpecies(data.speciesId!)}
                  >
                    Ficha da espécie <ArrowUpRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {editing && (
            <form
              className="panel inset"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const value: Record<string, unknown> = { ...data };
                for (const k of [
                  "region",
                  "habitat",
                  "substrate",
                  "vegetation",
                  "light",
                  "notes",
                ])
                  value[k] = f.get(k) || "";
                for (const k of ["latitude", "longitude", "altitude"])
                  value[k] = f.get(k) ? Number(f.get(k)) : null;
                value.observedAt = new Date(
                  String(f.get("observedAt")),
                ).toISOString();
                value.morphology = Object.fromEntries(
                  Array.from(f.entries())
                    .filter(([k]) => k.startsWith("m-"))
                    .map(([k, v]) => [k.slice(2), String(v)]),
                );
                void act("edit", async () => {
                  await api(`observations/${id}`, {
                    ...send(value),
                    method: "PATCH",
                  });
                  setEditing(false);
                });
              }}
            >
              <div className="form-grid">
                {[
                  ["region", "Local"],
                  ["habitat", "Habitat"],
                  ["substrate", "Substrato"],
                  ["vegetation", "Vegetação"],
                  ["light", "Luminosidade"],
                  ["latitude", "Latitude"],
                  ["longitude", "Longitude"],
                  ["altitude", "Altitude"],
                ].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input
                      name={k}
                      defaultValue={String(data[k as keyof Observation] ?? "")}
                    />
                  </Field>
                ))}
                <Field label="Data e hora">
                  <input
                    type="datetime-local"
                    name="observedAt"
                    required
                    defaultValue={new Date(
                      new Date(data.observedAt).getTime() -
                        new Date(data.observedAt).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                  />
                </Field>
                {data.group === "fungus" &&
                  [
                    "Píleo",
                    "Cor",
                    "Superfície",
                    "Lamelas",
                    "Poros",
                    "Dentes",
                    "Estipe",
                    "Anel",
                    "Volva",
                    "Base",
                    "Esporada",
                    "Cheiro",
                    "Textura",
                    "Mudança de cor",
                    "Plantas associadas",
                  ].map((k) => (
                    <Field label={k} key={k}>
                      <input
                        name={`m-${k}`}
                        defaultValue={data.morphology[k] || ""}
                      />
                    </Field>
                  ))}
              </div>
              <Field label="Notas">
                <textarea name="notes" defaultValue={data.notes} />
              </Field>
              <Button disabled={!!busy} size="sm">
                <Save size={14} /> Salvar alterações
              </Button>
            </form>
          )}
          <div className="section-heading">
            <div>
              <h2>Identificação assistida</h2>
              <span>
                {data.group === "plant"
                  ? "Pl@ntNet"
                  : "Histórico e registros próximos"}
              </span>
            </div>
            <Button
              size="sm"
              disabled={
                !!busy || (data.group === "plant" && !data.photos.length)
              }
              onClick={() =>
                void act("identify", () =>
                  api(`observations/${id}/identify`, send({})),
                )
              }
            >
              <ScanLine size={16} />
              {busy === "identify"
                ? "Consultando…"
                : data.group === "plant"
                  ? "Consultar Pl@ntNet"
                  : "Buscar candidatos"}
            </Button>
          </div>
          <p className="tip">
            {data.group === "plant"
              ? `Envia até 5 fotos otimizadas, sem EXIF, ao Pl@ntNet. ${catalog.plantnetConfigured ? "O score é uma similaridade visual, não uma confirmação." : "Configure PLANTNET_API_KEY para habilitar. Você pode identificar manualmente abaixo."}`
              : "Compara morfologia e ambiente com seu histórico e consulta fungos registrados a até 25 km no mesmo mês, pelo iNaturalist. Envia coordenadas para a consulta. Não analisa imagens nem confirma a espécie."}
          </p>
          {latest && (
            <>
              <div className="candidate-list">
                {latest.candidates.length ? (
                  latest.candidates.map((c, i) => (
                    <div
                      className={`candidate ${name === c.scientificName ? "selected" : ""}`}
                      key={c.scientificName}
                    >
                      <span className="candidate-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>
                          <em>{c.scientificName}</em>
                        </h3>
                        <p>
                          {c.commonNames.join(", ") ||
                            c.family ||
                            "Candidato sugerido"}
                        </p>
                        <small>
                          {c.score !== null
                            ? `Score visual original: ${c.score} (${(c.score * 100).toFixed(1)}%)`
                            : "Contexto pessoal/geográfico · sem score visual"}
                        </small>
                        {c.referenceImages.map((img) => (
                          <a
                            className="reference-image"
                            key={img.url}
                            href={img.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Foto de referência · {img.author} · {img.license} ↗
                          </a>
                        ))}
                      </div>
                      <div className="candidate-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setName(c.scientificName);
                            setSelected(c);
                          }}
                        >
                          Selecionar
                        </Button>
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() =>
                            void act("compare", async () => {
                              setComparisonName(c.scientificName);
                              setSources(
                                await api<SourceResult[]>(
                                  `observations/${id}/compare`,
                                  send({ name: c.scientificName }),
                                ),
                              );
                            })
                          }
                        >
                          Cruzar fontes
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="inset panel">
                    Nenhum candidato retornado. Registre mais características ou
                    insira uma hipótese manual.
                  </p>
                )}
              </div>
              <div className="query-meta">
                {latest.provider} ·{" "}
                {new Date(latest.queriedAt).toLocaleString("pt-BR")} ·{" "}
                {latest.imageIds.length} fotos
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() =>
                    void act("refresh", () =>
                      api(
                        `observations/${id}/identify`,
                        send({ refresh: true }),
                      ),
                    )
                  }
                >
                  <RefreshCw size={12} /> Atualizar consulta
                </button>
              </div>
              {data.group === "fungus" && (
                <details>
                  <summary>Critérios e fontes dos candidatos</summary>
                  <pre className="source-data">
                    {JSON.stringify(latest.raw, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
          {!!sources.length && (
            <div className="comparison">
              <div className="section-heading">
                <h3>
                  Fontes: <em>{comparisonName}</em>
                </h3>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() =>
                    void act("compare", async () =>
                      setSources(
                        await api<SourceResult[]>(
                          `observations/${id}/compare`,
                          send({ name: comparisonName, refresh: true }),
                        ),
                      ),
                    )
                  }
                >
                  <RefreshCw size={13} /> Atualizar dados externos
                </button>
              </div>
              <p className="tip">
                Ocorrência geográfica oferece contexto. Habitat e morfologia
                requerem avaliação manual; os dados não são combinados em uma
                porcentagem.
              </p>
              {sources.map((s, i) => {
                const d = s.data as {
                  count?: number | null;
                  seasonalCount?: number | null;
                  scope?: string;
                  taxon?: unknown;
                  message?: string;
                  matchType?: string;
                  scientificName?: string;
                } | null;
                return (
                  <div className="source-card" key={i}>
                    <div>
                      <strong>{s.provider}</strong>
                      <span className="badge">
                        {s.status !== "ok"
                          ? "Dados insuficientes"
                          : typeof d?.count === "number"
                            ? d.count > 0
                              ? "Suporte moderado"
                              : "Pouca evidência"
                            : d?.taxon || d?.matchType === "EXACT"
                              ? "Suporte taxonômico"
                              : "Dados insuficientes"}
                      </span>
                    </div>
                    {typeof d?.count === "number" && (
                      <p>
                        {d.count} registros · {d.seasonalCount ?? "—"} no mesmo
                        mês · {d.scope}
                      </p>
                    )}
                    <p>{s.message || d?.message || d?.scientificName}</p>
                    <small>
                      Consultado em{" "}
                      {new Date(s.queriedAt).toLocaleString("pt-BR")}
                    </small>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-button"
                      >
                        Consultar fonte <ArrowUpRight size={13} />
                      </a>
                    )}
                    <details>
                      <summary>Dados retornados</summary>
                      <pre className="source-data">
                        {JSON.stringify(s.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })}
              <div className="tip">
                Compatibilidade morfológica e de habitat: dados insuficientes
                para inferência automática. Registre sua avaliação nas notas da
                identificação.
              </div>
            </div>
          )}
          <form
            className="confirm-box panel"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void act("confirm", () =>
                api(
                  `observations/${id}/confirm`,
                  send({
                    scientificName: name,
                    status,
                    note: form.get("note"),
                    commonNames: selected?.commonNames || [],
                    genus: selected?.genus || "",
                    family: selected?.family || "",
                    identificationId: latest?.id,
                  }),
                ),
              );
            }}
          >
            <div className="section-heading">
              <h3>
                <Check size={18} /> Sua identificação
              </h3>
              <span className="pill">DECISÃO MANUAL</span>
            </div>
            <div className="form-grid">
              <Field label="Nome científico">
                <input
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Ex.: Passiflora edulis"
                />
              </Field>
              <Field label="Grau de identificação">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="probable">Identificação provável</option>
                  <option value="user_identified">
                    Identificado pelo usuário
                  </option>
                  <option value="externally_confirmed">
                    Confirmado externamente
                  </option>
                </select>
              </Field>
            </div>
            <Field label="Justificativa / fonte externa">
              <textarea
                name="note"
                required={status === "externally_confirmed"}
                placeholder="Características observadas, dúvidas ou referência de quem confirmou…"
              />
            </Field>
            <div className="actions">
              <Button disabled={!!busy || !name} type="submit">
                <Check size={16} />
                {busy === "confirm" ? "Salvando…" : "Salvar identificação"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!name || !!busy}
                onClick={() =>
                  void act("compare", async () => {
                    setComparisonName(name);
                    setSources(
                      await api<SourceResult[]>(
                        `observations/${id}/compare`,
                        send({ name }),
                      ),
                    );
                  })
                }
              >
                Comparar fontes
              </Button>
            </div>
          </form>
          <details className="form-details">
            <summary>
              Histórico de identificação{" "}
              <span>{data.history.length} alterações</span>
            </summary>
            {data.history.map((h) => (
              <div key={h.id} className="history-item">
                <small>{new Date(h.createdAt).toLocaleString("pt-BR")}</small>
                <p>
                  {statuses[h.previousStatus]} → {statuses[h.status]}
                </p>
                <span>{h.note}</span>
              </div>
            ))}
          </details>
          <details className="form-details">
            <summary>
              Contexto do meu catálogo <span>histórico pessoal</span>
            </summary>
            {data.context
              .filter(
                (c) =>
                  c.sameRegion ||
                  c.sameHabitat ||
                  c.sameSubstrate ||
                  c.morphologyMatches.length ||
                  (data.latitude !== null &&
                    data.longitude !== null &&
                    c.observation.latitude !== null &&
                    c.observation.longitude !== null &&
                    distanceKm(
                      data.latitude,
                      data.longitude,
                      c.observation.latitude,
                      c.observation.longitude,
                    ) < 25),
              )
              .map((c) => (
                <p key={c.observation.id}>
                  <Leaf size={14} /> {c.observation.code} ·{" "}
                  {
                    catalog.species.find(
                      (s) => s.id === c.observation.speciesId,
                    )?.scientificName
                  }{" "}
                  ·{" "}
                  {[
                    c.sameRegion ? "mesma região" : "",
                    c.sameMonth ? "mesmo mês" : "",
                    c.sameHabitat ? "mesmo habitat" : "",
                    c.sameSubstrate ? "mesmo substrato" : "",
                    ...c.morphologyMatches,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ))}
            <p className="muted">
              Registros anteriores contextualizam o encontro; não confirmam a
              identidade.
            </p>
          </details>
          {data.identifications.length > 1 && (
            <details className="form-details">
              <summary>
                Consultas anteriores{" "}
                <span>{data.identifications.length - 1}</span>
              </summary>
              {data.identifications
                .slice(0, -1)
                .reverse()
                .map((q) => (
                  <div key={q.id} className="history-item">
                    <strong>{q.provider}</strong> · {dateLabel(q.queriedAt)}
                    <p>
                      {q.candidates.map((c) => c.scientificName).join(", ") ||
                        "Sem candidatos"}
                      {q.selectedName && ` · Selecionado: ${q.selectedName}`}
                    </p>
                  </div>
                ))}
            </details>
          )}
        </>
      )}
    </Modal>
  );
}
