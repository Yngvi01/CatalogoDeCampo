"use client";
import { useState } from "react";
import { FlaskConical, Save, Plus, ArrowUpRight, Leaf } from "lucide-react";
import {
  Modal,
  Field,
  ErrorText,
  api,
  send,
  evidenceLabels,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { LibraryLink } from "@/features/library/library-panel";
import { EvidenceForm } from "@/features/research/evidence-form";
import type { Catalog } from "@/lib/validation/schemas";
import { dateLabel } from "@/lib/utils";
export function SpeciesDetail({
  id,
  catalog,
  onClose,
  onChanged,
  onObservation,
}: {
  id: string;
  catalog: Catalog;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onObservation: (id: string) => void;
}) {
  const s = catalog.species.find((s) => s.id === id);
  const [editing, setEditing] = useState(false),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  if (!s) return null;
  const observations = catalog.observations.filter((o) => o.speciesId === id),
    evidence = catalog.evidence.filter((e) => e.speciesId === id);
  return (
    <Modal
      title={s.scientificName}
      subtitle={`${s.group === "plant" ? "Planta" : "Fungo"} · ${s.family || "Família não registrada"} · ${observations.length} observações`}
      onClose={onClose}
      wide
    >
      {s.group === "plant" && <LibraryLink scientificName={s.scientificName} />}
      <ErrorText message={error} />
      {notice && <p className="notice">{notice}</p>}
      <div className="species-actions">
        <div>
          <span className="pill">FICHA DA ESPÉCIE</span>
          <p>
            {s.commonNames.join(" · ") ||
              "Nomes populares ainda não registrados"}
          </p>
        </div>
        <div className="actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(!editing)}
          >
            Editar ficha
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api<{ count: number }>(
                  `species/${id}/investigate`,
                  send({}),
                );
                await onChanged();
                setNotice(
                  `${r.count} publicações encontradas. Revise-as em Pesquisa → Descobertas.`,
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FlaskConical size={15} />
            {busy ? "Pesquisando…" : "Investigar espécie"}
          </Button>
        </div>
      </div>
      {editing ? (
        <form
          className="panel inset"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            const value: Record<string, unknown> = {};
            for (const k of [
              "scientificName",
              "acceptedName",
              "genus",
              "family",
              "description",
              "diagnostics",
              "distribution",
              "habitat",
              "toxicity",
              "traditionalUses",
              "notes",
            ])
              value[k] = f.get(k) || "";
            for (const k of ["commonNames", "synonyms"])
              value[k] = String(f.get(k) || "")
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean);
            try {
              await api(`species/${id}`, { ...send(value), method: "PATCH" });
              await onChanged();
              setEditing(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="eyebrow">MEUS DADOS · EDIÇÃO MANUAL</span>
          <div className="form-grid">
            {[
              ["scientificName", "Nome científico"],
              ["acceptedName", "Nome aceito"],
              ["commonNames", "Nomes populares (separados por ;)"],
              ["synonyms", "Sinônimos (separados por ;)"],
              ["genus", "Gênero"],
              ["family", "Família"],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <input
                  name={k}
                  required={k === "scientificName"}
                  defaultValue={
                    Array.isArray(s[k as keyof typeof s])
                      ? (s[k as "synonyms"] as string[]).join("; ")
                      : String(s[k as keyof typeof s])
                  }
                />
              </Field>
            ))}
          </div>
          {[
            ["description", "Descrição"],
            ["diagnostics", "Características diagnósticas"],
            ["distribution", "Distribuição"],
            ["habitat", "Habitat"],
            ["toxicity", "Toxicidade"],
            ["traditionalUses", "Usos tradicionais"],
            ["notes", "Hipóteses e notas pessoais"],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <textarea
                name={k}
                defaultValue={String(s[k as keyof typeof s])}
              />
            </Field>
          ))}
          <p className="tip">
            Associe informações científicas às fontes na seção Evidências.
          </p>
          <Button disabled={busy}>
            <Save size={16} /> Salvar ficha
          </Button>
        </form>
      ) : (
        <>
          <div className="species-text panel">
            <span className="eyebrow">MEUS DADOS</span>
            <dl>
              <div>
                <dt>Nome aceito</dt>
                <dd>
                  <em>{s.acceptedName || "Não informado"}</em>
                </dd>
              </div>
              <div>
                <dt>Gênero / família</dt>
                <dd>
                  {[s.genus, s.family].filter(Boolean).join(" · ") ||
                    "Não informado"}
                </dd>
              </div>
              {!!s.synonyms.length && (
                <div>
                  <dt>Sinônimos</dt>
                  <dd>{s.synonyms.join(", ")}</dd>
                </div>
              )}
            </dl>
            {[
              ["Descrição", s.description],
              ["Características diagnósticas", s.diagnostics],
              ["Distribuição", s.distribution],
              ["Habitat", s.habitat],
              ["Toxicidade", s.toxicity],
              ["Usos tradicionais", s.traditionalUses],
              ["Hipóteses e notas pessoais", s.notes],
            ].map(([l, v]) =>
              v ? (
                <div key={l}>
                  <h4>{l}</h4>
                  <p className="notes">{v}</p>
                </div>
              ) : null,
            )}
            {!s.description && (
              <p className="muted">
                Uma ficha em construção. Adicione características e incorpore
                evidências com suas fontes.
              </p>
            )}
          </div>
        </>
      )}
      <div className="section-heading">
        <h2>Minhas observações</h2>
        <span>{observations.length} encontros</span>
      </div>
      <div className="field-list">
        {observations.map((o) => (
          <button key={o.id} onClick={() => onObservation(o.id)}>
            {o.photos[0] ? (
              <img src={`/api/images/${o.photos[0].id}`} alt="" />
            ) : (
              <Leaf size={20} />
            )}
            <div>
              <strong>{o.code}</strong>
              <span>
                {o.region || "Sem local"} · {dateLabel(o.observedAt)}
              </span>
            </div>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      <div className="section-heading">
        <h2>Propriedades, compostos e evidências</h2>
        <Button variant="outline" size="sm" onClick={() => setAdding(!adding)}>
          <Plus size={14} /> Evidência
        </Button>
      </div>
      {adding && (
        <EvidenceForm
          speciesId={id}
          compounds={catalog.compounds}
          onSaved={async () => {
            await onChanged();
            setAdding(false);
          }}
        />
      )}
      {!evidence.length && (
        <p className="muted inset">
          Nenhuma evidência incorporada. Pesquisas externas não alteram esta
          ficha automaticamente.
        </p>
      )}
      {evidence.map((e) => (
        <article key={e.id} className="evidence-card panel">
          <div className="actions">
            <span
              className={`badge ${e.origin === "hypothesis" ? "amber" : ""}`}
            >
              {
                {
                  personal: "Meus dados",
                  automatic: "Dados automáticos",
                  publication: "Publicação científica",
                  hypothesis: "Hipótese",
                  confirmed: "Dado confirmado",
                }[e.origin]
              }
            </span>
            <span className="badge">{evidenceLabels[e.type]}</span>
            {e.property && <span className="tag">{e.property}</span>}
          </div>
          <p>{e.claim}</p>
          {e.compoundId && (
            <strong>
              {catalog.compounds.find((c) => c.id === e.compoundId)?.name}
            </strong>
          )}
          <dl>
            {[
              ["Parte", e.part],
              [
                "Concentração",
                [e.concentration, e.unit].filter(Boolean).join(" "),
              ],
              ["Intervalo", e.range],
              ["Método", e.method],
              ["Amostra", e.sampleOrigin],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {e.notes && <p>{e.notes}</p>}
          {e.url ? (
            <a
              className="text-button"
              target="_blank"
              rel="noreferrer"
              href={e.url}
            >
              {e.source || "Consultar referência"} <ArrowUpRight size={13} />
            </a>
          ) : (
            <small>{e.source || "Sem fonte externa informada"}</small>
          )}
        </article>
      ))}
      <p className="tip">
        As propriedades descritas na literatura não determinam a composição do
        exemplar observado. Nenhum resultado representa recomendação de consumo.
      </p>
    </Modal>
  );
}
