"use client";
import { useState } from "react";
import {
  FlaskConical,
  Plus,
  ArrowUpRight,
  BookOpen,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, Modal, ErrorText, api, send } from "@/components/shared";
import { EvidenceForm } from "./evidence-form";
import { CompoundForm } from "./compound-form";
import { LotusExplorer } from "./lotus-explorer";
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
  const [tab, setTab] = useState("explore"),
    [species, setSpecies] = useState(""),
    [compoundName, setCompoundName] = useState(""),
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
          <p>Explore relações planta–composto no LOTUS, confira substâncias no PubChem e revise os estudos na Europe PMC.</p>
        </div>
        <span className="pill">CIÊNCIA COM CONTEXTO</span>
      </div>
      <div className="catalog-toolbar">
        <div className="tabs">
          <button className={tab === "explore" ? "active" : ""} onClick={() => setTab("explore")}><Search size={15} /> Explorar substâncias</button>
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
      {tab === "explore" ? <LotusExplorer compounds={data.compounds} /> : tab === "discoveries" ? (
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
            <input aria-label="Composto para investigar" list="research-compounds" value={compoundName} onChange={event => setCompoundName(event.target.value)} placeholder="Composto (opcional)" maxLength={120} />
            <datalist id="research-compounds">{data.compounds.map(compound => <option value={compound.name} key={compound.id} />)}</datalist>
            <Button
              size="sm"
              disabled={!species || busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await api<{ count: number }>(
                    `species/${species}/investigate`,
                    send({ refresh: true, compoundName: compoundName.trim() }),
                  );
                  await refresh();
                  setNotice(
                    `${r.count} resultados consultados${compoundName.trim() ? ` para ${compoundName.trim()}` : ""}; descobertas já existentes foram preservadas.`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={14} />
              {busy ? "Investigando…" : compoundName.trim() ? "Investigar planta + composto" : "Investigar espécie"}
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
              {c.pubchemCid && <p><a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${c.pubchemCid}`} target="_blank" rel="noreferrer">PubChem CID {c.pubchemCid} <ArrowUpRight size={13} /></a></p>}
              {c.molecularWeight && <p>Massa molecular: {c.molecularWeight} g/mol</p>}
              {c.inchiKey && <p>InChIKey: <code>{c.inchiKey}</code></p>}
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
              {(() => {
                const linked = data.evidence.filter(e => e.compoundId === c.id);
                return <div className="compound-evidence"><strong>{linked.length} {linked.length === 1 ? "evidência vinculada" : "evidências vinculadas"}</strong>
                  {linked.length ? linked.map(e => <div key={e.id}>
                    <button type="button" className="text-button" onClick={() => onSpecies(e.speciesId)}>{data.species.find(s => s.id === e.speciesId)?.scientificName || "Espécie"}</button>
                    <p>{e.claim}</p>
                    {e.url && <a href={e.url} target="_blank" rel="noreferrer">{e.source || "Fonte"} <ArrowUpRight size={12} /></a>}
                  </div>) : <p>Sem vínculo documentado com uma espécie. Cadastre uma evidência na ficha da planta.</p>}
                </div>;
              })()}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<FlaskConical size={32} />}
          title="Compostos, com suas fontes."
          text="Busque um composto no PubChem ou cadastre-o manualmente. Depois, vincule-o a plantas por evidências, partes analisadas e métodos."
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
          subtitle="Consulte o PubChem ou cadastre manualmente; associe plantas por evidências da espécie."
          onClose={() => setAdding(false)}
        >
          <CompoundForm onSaved={async () => { await refresh(); setAdding(false); }} />
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
