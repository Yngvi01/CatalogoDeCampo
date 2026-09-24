"use client";
import { useState } from "react";
import {
  FlaskConical,
  Plus,
  ArrowUpRight,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, Field, Modal, ErrorText, api, send } from "@/components/shared";
import { EvidenceForm } from "./evidence-form";
import type { Catalog, Discovery } from "@/lib/validation/schemas";
import { normalize } from "@/lib/utils";
const discoveryStatuses: Record<string, string> = {
  new: "Novo",
  relevant: "Relevante",
  investigate: "Investigar",
  inconclusive: "Inconclusivo",
  discarded: "Descartado",
  incorporated: "Incorporado",
};
export function ResearchPanel({
  data,
  refresh,
  query,
  onSpecies,
}: {
  data: Catalog;
  refresh: () => Promise<void>;
  query: string;
  onSpecies: (id: string) => void;
}) {
  const [tab, setTab] = useState("discoveries"),
    [species, setSpecies] = useState(""),
    [status, setStatus] = useState("all"),
    [adding, setAdding] = useState(false),
    [review, setReview] = useState<Discovery | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const discoveries = data.discoveries.filter(
    (d) =>
      (!species || d.speciesId === species) &&
      (status === "all" || d.status === status) &&
      normalize(JSON.stringify(d)).includes(normalize(query)),
  );
  const compounds = data.compounds.filter((c) =>
    normalize(JSON.stringify(c)).includes(normalize(query)),
  );
  return (
    <>
      <ErrorText message={error} />
      {notice && <p className="notice">{notice}</p>}
      <div className="research-intro panel">
        <FlaskConical size={32} />
        <div>
          <h3>Uma pergunta pode abrir muitos caminhos.</h3>
          <p>
            Investigue nomes aceitos e sinônimos na Europe PMC. Revise cada
            descoberta antes de incorporá-la à ficha.
          </p>
        </div>
        <span className="pill">CIÊNCIA COM CONTEXTO</span>
      </div>
      <div className="catalog-toolbar">
        <div className="tabs">
          <button
            className={tab === "discoveries" ? "active" : ""}
            onClick={() => setTab("discoveries")}
          >
            <BookOpen size={15} /> Descobertas{" "}
            <span>{data.discoveries.length}</span>
          </button>
          <button
            className={tab === "compounds" ? "active" : ""}
            onClick={() => setTab("compounds")}
          >
            <FlaskConical size={15} /> Compostos{" "}
            <span>{data.compounds.length}</span>
          </button>
        </div>
        {tab === "compounds" && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Novo composto
          </Button>
        )}
      </div>
      {tab === "discoveries" ? (
        <>
          <div className="research-controls">
            <select
              aria-label="Espécie para investigar"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            >
              <option value="">Selecione uma espécie</option>
              {data.species.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.scientificName}
                </option>
              ))}
            </select>
            <select
              aria-label="Status da descoberta"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Todos os status</option>
              {Object.entries(discoveryStatuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!species || busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await api<{ count: number }>(
                    `species/${species}/investigate`,
                    send({ refresh: true }),
                  );
                  await refresh();
                  setNotice(
                    `${r.count} resultados consultados; descobertas já existentes foram preservadas.`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={14} />
              {busy ? "Investigando…" : "Investigar espécie"}
            </Button>
          </div>
          {discoveries.length ? (
            <div className="discovery-list">
              {discoveries.map((d) => (
                <article className="panel discovery-card" key={d.id}>
                  <div className="discovery-meta">
                    <span className="badge">EUROPE PMC · {d.year}</span>
                    <button
                      className="text-button"
                      onClick={() => onSpecies(d.speciesId)}
                    >
                      {
                        data.species.find((s) => s.id === d.speciesId)
                          ?.scientificName
                      }
                    </button>
                  </div>
                  <h3>
                    <a href={d.url} target="_blank" rel="noreferrer">
                      {d.title} <ArrowUpRight size={16} />
                    </a>
                  </h3>
                  <p>{d.authors}</p>
                  {d.abstract && (
                    <details>
                      <summary>Resumo da publicação</summary>
                      <p>{d.abstract}</p>
                    </details>
                  )}
                  <div className="discovery-footer">
                    <select
                      aria-label={`Status: ${d.title}`}
                      value={d.status}
                      disabled={d.status === "incorporated"}
                      onChange={async (e) => {
                        try {
                          await api(`discoveries/${d.id}`, {
                            ...send({ status: e.target.value }),
                            method: "PATCH",
                          });
                          await refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {Object.entries(discoveryStatuses)
                        .filter(
                          ([v]) =>
                            v !== "incorporated" || d.status === "incorporated",
                        )
                        .map(([v, l]) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={d.status === "incorporated"}
                      onClick={() => setReview(d)}
                    >
                      {d.status === "incorporated"
                        ? "Incorporado à ficha"
                        : "Revisar e incorporar"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={<BookOpen size={32} />}
              title="Descobertas começam com perguntas."
              text="Selecione uma espécie do catálogo e investigue sua composição, propriedades e toxicidade na literatura."
            />
          )}
        </>
      ) : compounds.length ? (
        <div className="compound-grid">
          {compounds.map((c) => (
            <article className="panel compound-card" key={c.id}>
              <span className="badge">
                {c.chemicalClass || "Classe não informada"}
              </span>
              <h3>{c.name}</h3>
              <code>{c.formula}</code>
              <p>{c.description}</p>
              <dl>
                {[
                  ["Sinônimos", c.synonyms.join(", ")],
                  ["Mecanismos", c.mechanisms],
                  ["Alvos", c.targets],
                  ["Efeitos descritos", c.effects],
                  ["Toxicologia", c.toxicology],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              <small>
                {data.evidence.filter((e) => e.compoundId === c.id).length}{" "}
                evidências vinculadas nas fichas das espécies
              </small>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<FlaskConical size={32} />}
          title="Compostos, com suas fontes."
          text="Cadastre compostos e vincule-os a espécies por evidências, partes analisadas e métodos."
          action={
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus size={15} /> Cadastrar composto
            </Button>
          }
        />
      )}
      {adding && (
        <Modal
          title="Novo composto"
          subtitle="Organize informações químicas; associe referências pelas evidências da espécie."
          onClose={() => setAdding(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const value: Record<string, unknown> = {};
              for (const k of [
                "name",
                "chemicalClass",
                "formula",
                "description",
                "mechanisms",
                "targets",
                "effects",
                "toxicology",
              ])
                value[k] = String(f.get(k) || "");
              value.synonyms = String(f.get("synonyms") || "")
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean);
              setBusy(true);
              setError("");
              try {
                await api("compounds", send(value));
                await refresh();
                setAdding(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              {[
                ["name", "Nome"],
                ["synonyms", "Sinônimos (;)"],
                ["chemicalClass", "Classe química"],
                ["formula", "Fórmula"],
                ["targets", "Alvos"],
              ].map(([k, l]) => (
                <Field label={l} key={k}>
                  <input name={k} required={k === "name"} />
                </Field>
              ))}
            </div>
            {[
              ["description", "Descrição"],
              ["mechanisms", "Mecanismos"],
              ["effects", "Efeitos descritos"],
              ["toxicology", "Toxicologia"],
            ].map(([k, l]) => (
              <Field label={l} key={k}>
                <textarea name={k} />
              </Field>
            ))}
            <ErrorText message={error} />
            <Button disabled={busy}>Salvar composto</Button>
          </form>
        </Modal>
      )}
      {review && (
        <Modal
          title="Incorporar descoberta"
          subtitle={review.title}
          onClose={() => setReview(null)}
          wide
        >
          <EvidenceForm
            speciesId={review.speciesId}
            compounds={data.compounds}
            discovery={review}
            onSaved={async () => {
              await refresh();
              setReview(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
