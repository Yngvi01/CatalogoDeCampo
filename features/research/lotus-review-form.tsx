"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, ErrorText, api, send, evidenceLabels } from "@/components/shared";
import { evidenceTypes, type Evidence } from "@/lib/validation/schemas";
import type { LotusHit, LotusTaxon } from "@/lib/providers/lotus";

export function LotusReviewForm({ hit, taxon, onSaved }: { hit: LotusHit; taxon: LotusTaxon; onSaved: () => Promise<void> }) {
  const firstReference = taxon.references.find(item => item.url);
  const [claim, setClaim] = useState("");
  const [type, setType] = useState<Evidence["type"]>("publication");
  const [source, setSource] = useState(firstReference?.label || "");
  const [url, setUrl] = useState(firstReference?.url || "");
  const [part, setPart] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className="review-form" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api("lotus/review", send({ lotusId: hit.lotusId, scientificName: taxon.name, compoundName: hit.name,
        inchiKey: hit.inchiKey, formula: hit.formula, claim, type, source, url, part, method, notes, reviewed }));
      await onSaved();
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }}>
    <p><strong><em>{taxon.name}</em> → {hit.name}</strong> · {hit.formula || "fórmula não informada"}</p>
    <p className="tip">O LOTUS indica a relação, mas não informa nesta busca parte, método ou quantidade. Confira a publicação antes de salvar uma afirmação. A ficha da espécie e o composto serão criados se ainda não existirem.</p>
    <div className="review-links"><a href={hit.url} target="_blank" rel="noreferrer">Ficha LOTUS <ArrowUpRight size={13} /></a>{taxon.references.filter(item => item.url).map(item => <a key={item.url} href={item.url!} target="_blank" rel="noreferrer">{item.label} <ArrowUpRight size={13} /></a>)}</div>
    <Field label="O que a publicação confirma sobre esta relação?"><textarea required minLength={10} value={claim} onChange={event => setClaim(event.target.value)} placeholder="Descreva o achado com precisão, sem inferir efeitos farmacológicos." /></Field>
    <div className="form-grid">
      <Field label="Tipo de evidência"><select value={type} onChange={event => setType(event.target.value as Evidence["type"])}>{evidenceTypes.map(value => <option key={value} value={value}>{evidenceLabels[value]}</option>)}</select></Field>
      <Field label="Fonte / título da publicação"><input required value={source} onChange={event => setSource(event.target.value)} maxLength={500} /></Field>
      <Field label="Link da publicação"><input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://doi.org/..." /></Field>
      <Field label="Parte analisada (se houver)"><input value={part} onChange={event => setPart(event.target.value)} maxLength={500} /></Field>
      <Field label="Método (se houver)"><input value={method} onChange={event => setMethod(event.target.value)} maxLength={500} /></Field>
    </div>
    <Field label="Notas de revisão (opcional)"><textarea value={notes} onChange={event => setNotes(event.target.value)} /></Field>
    <label className="review-confirm"><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> Li a fonte e conferi que ela sustenta a relação entre esta espécie e este composto.</label>
    <ErrorText message={error} />
    <Button disabled={saving || !reviewed}>{saving ? "Salvando…" : "Salvar relação revisada"}</Button>
  </form>;
}
