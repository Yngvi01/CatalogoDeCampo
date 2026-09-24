"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, FlaskConical, Leaf, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ErrorText, Modal } from "@/components/shared";
import { libraryEntries } from "@/features/library/entries";
import type { Catalog, Compound, LotusBookmark } from "@/lib/validation/schemas";
import type { LotusHit, LotusSearch, LotusTaxon } from "@/lib/providers/lotus";
import { normalize } from "@/lib/utils";
import { effectLabels as effectNames, contextLabels } from "./effects";
import { LotusReviewForm } from "./lotus-review-form";

type Mode = "plant" | "compound";
const effectLabels = ["Todos", ...Object.values(effectNames)] as const;
const rsNames = new Set(libraryEntries.filter(entry => entry.scope === "species")
  .flatMap(entry => [entry.scientificName, ...(entry.aliases || [])]).map(normalize));
const isRsSpecies = (taxon: LotusTaxon) => taxon.rank === "species" && rsNames.has(normalize(taxon.name));
const knownCompound = (hit: LotusHit, compounds: Compound[]) => compounds.find(compound =>
  hit.inchiKey && compound.inchiKey && compound.inchiKey === hit.inchiKey)
  || compounds.find(compound => (!hit.inchiKey || !compound.inchiKey) && normalize(compound.name) === normalize(hit.name));
const effectTags = (compound?: Compound) => {
  return [...new Set((compound?.effectClaims || []).map(claim => effectNames[claim.kind]))];
};

function Occurrence({ taxon, onReview, onBookmark, bookmarked, saving }: { taxon: LotusTaxon; onReview: () => void; onBookmark: () => void; bookmarked: boolean; saving: boolean }) {
  return <div className="lotus-taxon">
    <div><em>{taxon.name}</em><span className="badge">{taxon.rank === "species" ? "ESPÉCIE" : "GÊNERO"}</span>{isRsSpecies(taxon) && <span className="badge">FICHA RS</span>}</div>
    <div className="lotus-references">{taxon.references.length ? taxon.references.slice(0, 3).map((reference, index) => reference.url
      ? <a href={reference.url} key={`${reference.label}-${index}`} target="_blank" rel="noreferrer">{reference.label} <ArrowUpRight size={11} /></a>
      : <span key={`${reference.label}-${index}`}>{reference.label}</span>) : <span>Referência: consulte a ficha LOTUS</span>}
      {taxon.references.length > 3 && <small>+ {taxon.references.length - 3} referências na ficha LOTUS</small>}
    </div>
    {taxon.rank === "species" && <div className="lotus-taxon-actions"><Button type="button" size="sm" variant="outline" onClick={onReview}>Revisar esta relação</Button><Button type="button" size="sm" variant="outline" disabled={bookmarked || saving} onClick={onBookmark}>{bookmarked ? "Na lista de revisão" : saving ? "Guardando…" : "Guardar para revisar"}</Button></div>}
  </div>;
}

export function LotusExplorer({ compounds, bookmarks, onReviewed, onBookmarkSaved }: { compounds: Catalog["compounds"]; bookmarks: LotusBookmark[]; onReviewed: () => Promise<void>; onBookmarkSaved: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>("plant");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LotusSearch | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [onlyRs, setOnlyRs] = useState(false);
  const [effect, setEffect] = useState<(typeof effectLabels)[number]>("Todos");
  const [limit, setLimit] = useState(15);
  const [review, setReview] = useState<{ hit: LotusHit; taxon: LotusTaxon } | null>(null);
  const [savingBookmark, setSavingBookmark] = useState("");
  const requestId = useRef(0);
  const search = async (term = query, selectedMode = mode) => {
    const id = ++requestId.current;
    setQuery(term);
    setError("");
    setResult(null);
    setLoading(true);
    setLimit(15);
    try {
      const found = await api<LotusSearch>(`lotus/search?mode=${selectedMode}&q=${encodeURIComponent(term.trim())}`);
      if (id === requestId.current) setResult(found);
    } catch (cause) {
      if (id === requestId.current) setError((cause as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };
  const switchMode = (next: Mode) => {
    requestId.current++;
    setMode(next);
    setQuery("");
    setResult(null);
    setError("");
    setLoading(false);
    setLimit(15);
  };
  const hits = result?.hits.filter(hit => {
    if (effect !== "Todos" && !effectTags(knownCompound(hit, compounds)).includes(effect)) return false;
    return mode !== "compound" || !onlyRs || hit.taxa.some(isRsSpecies);
  }) || [];
  const bookmarkActions = (hit: LotusHit, taxon: LotusTaxon) => ({
    bookmarked: bookmarks.some(item => item.lotusId === hit.lotusId && normalize(item.scientificName) === normalize(taxon.name)),
    saving: savingBookmark === `${hit.lotusId}:${taxon.name}`,
    onReview: () => setReview({ hit, taxon }),
    onBookmark: async () => {
      setError(""); setSavingBookmark(`${hit.lotusId}:${taxon.name}`);
      try {
        await api("lotus/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          lotusId: hit.lotusId, compoundName: hit.name, formula: hit.formula, inchiKey: hit.inchiKey,
          chemicalClass: hit.chemicalClass, scientificName: taxon.name, references: taxon.references,
        }) });
        await onBookmarkSaved();
      } catch (cause) { setError((cause as Error).message); }
      finally { setSavingBookmark(""); }
    },
  });
  return <section className="lotus-explorer" aria-label="Explorar substâncias em plantas">
    <div className="lotus-intro panel"><FlaskConical size={28} /><div><h2>Onde a química encontra a botânica.</h2><p>Pesquise relações planta–composto registradas no LOTUS. Abra as referências e revise o estudo antes de incorporar qualquer afirmação ao seu catálogo.</p></div></div>
    <div className="lotus-modes" aria-label="Direção da busca">
      <button type="button" className={mode === "plant" ? "active" : ""} aria-pressed={mode === "plant"} onClick={() => switchMode("plant")}><Leaf size={16} /> Planta → compostos</button>
      <button type="button" className={mode === "compound" ? "active" : ""} aria-pressed={mode === "compound"} onClick={() => switchMode("compound")}><FlaskConical size={16} /> Composto → plantas</button>
    </div>
    <form className="lotus-search" onSubmit={event => { event.preventDefault(); if (!loading) void search(); }}>
      <label><Search size={18} /><input aria-label={mode === "plant" ? "Nome científico da planta" : "Nome do composto"} value={query} onChange={event => setQuery(event.target.value)} list={mode === "plant" ? "lotus-plants" : undefined} placeholder={mode === "plant" ? "Ex.: Ilex paraguariensis" : "Ex.: caffeine"} /></label>
      <datalist id="lotus-plants">{libraryEntries.map(entry => <option value={entry.scientificName} key={entry.id}>{entry.commonName}</option>)}</datalist>
      <Button disabled={loading || query.trim().length < 2}>{loading ? "Consultando…" : "Buscar relações"}</Button>
    </form>
    <div className="lotus-suggestions"><span>Experimente:</span>{(mode === "plant" ? ["Erythrina falcata", "Ilex paraguariensis", "Baccharis trimera"] : ["caffeine", "linalool", "quercetin"]).map(item => <button type="button" key={item} onClick={() => void search(item)}>{item}</button>)}</div>
    {mode === "compound" && <label className="lotus-rs-filter"><input type="checkbox" checked={onlyRs} onChange={event => setOnlyRs(event.target.checked)} /> Mostrar apenas espécies com ficha na biblioteca do RS</label>}
    <div className="lotus-effect-filter"><span>Efeito de interesse:</span>{effectLabels.map(label => <button type="button" key={label} className={effect === label ? "active" : ""} aria-pressed={effect === label} onClick={() => setEffect(label)}>{label}</button>)}</div>
    <p className="lotus-caveat">Os filtros de efeito usam apenas registros estruturados com fonte feitos nos compostos do seu catálogo; o LOTUS não atribui efeitos farmacológicos a estas relações. Parte analisada, método e concentração não vêm nesta consulta: confira a publicação. Resultado em nível de gênero não confirma cada espécie. Ausência de registro não prova ausência do composto.</p>
    <ErrorText message={error} />
    {error && <a className="text-button" href={`https://lotus.naturalproducts.net/search?query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">Consultar diretamente no LOTUS <ArrowUpRight size={14} /></a>}
    {result && <>
      <p className="lotus-count">{hits.length} {hits.length === 1 ? "composto com relação" : "compostos com relações"} para <strong>{result.query}</strong>{effect !== "Todos" && <> · filtro “{effect}” baseado em anotações locais</>}</p>
      {hits.length ? <div className="lotus-grid">{hits.slice(0, limit).map(hit => {
        const local = knownCompound(hit, compounds);
        const taxa = mode === "compound" && onlyRs ? hit.taxa.filter(isRsSpecies) : hit.taxa;
        return <article className="panel lotus-hit" key={hit.lotusId}>
          <div className="lotus-hit-heading"><div><span className="eyebrow">LOTUS · {hit.lotusId}</span><h3>{hit.name}</h3><p>{hit.formula || "Fórmula não informada"}{hit.chemicalClass && <> · {hit.chemicalClass}</>}</p></div><a href={hit.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${hit.name} no LOTUS`}><ArrowUpRight size={18} /></a></div>
          {local?.effectClaims?.map(claim => <p className="lotus-local-effect" key={claim.id}>{effectNames[claim.kind]} · {contextLabels[claim.context]} · <a href={claim.url} target="_blank" rel="noreferrer">{claim.source}</a></p>)}
          {local?.effects && <p className="lotus-local-effect">Anotação anterior, sem fonte estruturada: {local.effects}</p>}
          <div className="lotus-occurrences"><strong>{taxa.length} {taxa.length === 1 ? "táxon relacionado" : "táxons relacionados"}</strong>{taxa.slice(0, mode === "compound" ? 12 : 5).map(taxon => <Occurrence key={taxon.name} taxon={taxon} {...bookmarkActions(hit, taxon)} />)}{taxa.length > (mode === "compound" ? 12 : 5) && <details><summary>Ver mais {taxa.length - (mode === "compound" ? 12 : 5)} táxons</summary>{taxa.slice(mode === "compound" ? 12 : 5).map(taxon => <Occurrence key={taxon.name} taxon={taxon} {...bookmarkActions(hit, taxon)} />)}</details>}</div>
        </article>;
      })}</div> : <div className="panel lotus-empty">Nenhuma relação corresponde à busca e aos filtros. Amplie a busca ou consulte o artigo original.</div>}
      {hits.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(value => value + 15)}>Mostrar mais compostos</Button>}
    </>}
    {review && <Modal title="Revisar relação do LOTUS" subtitle="A incorporação depende da publicação" onClose={() => setReview(null)} wide>
      <LotusReviewForm key={`${review.hit.lotusId}-${review.taxon.name}`} hit={review.hit} taxon={review.taxon} onSaved={async () => { await onReviewed(); setReview(null); }} />
    </Modal>}
  </section>;
}
