"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, ErrorText, api, send, evidenceLabels } from "@/components/shared";
import { effectKinds, effectContexts, evidenceTypes, type EffectClaim } from "@/lib/validation/schemas";
import { effectLabels, contextLabels } from "./effects";

export function EffectForm({ compoundId, onSaved }: { compoundId: string; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<EffectClaim["kind"]>("sedative");
  const [context, setContext] = useState<EffectClaim["context"]>("unspecified");
  const [type, setType] = useState<EffectClaim["type"]>("publication");
  const [claim, setClaim] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className="review-form" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api(`compounds/${compoundId}/effects`, send({ kind, context, type, claim, source, url }));
      await onSaved();
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }}>
    <p className="tip">Descreva o que a fonte realmente estudou. Um efeito de extrato ou uso tradicional não prova o mesmo efeito do composto isolado.</p>
    <div className="form-grid">
      <Field label="Efeito"><select value={kind} onChange={event => setKind(event.target.value as EffectClaim["kind"])}>{effectKinds.map(value => <option key={value} value={value}>{effectLabels[value]}</option>)}</select></Field>
      <Field label="Contexto estudado"><select value={context} onChange={event => setContext(event.target.value as EffectClaim["context"])}>{effectContexts.map(value => <option key={value} value={value}>{contextLabels[value]}</option>)}</select></Field>
      <Field label="Tipo de evidência"><select value={type} onChange={event => setType(event.target.value as EffectClaim["type"])}>{evidenceTypes.map(value => <option key={value} value={value}>{evidenceLabels[value]}</option>)}</select></Field>
      <Field label="Fonte / título"><input required value={source} onChange={event => setSource(event.target.value)} maxLength={500} /></Field>
    </div>
    <Field label="Link da fonte"><input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://doi.org/..." /></Field>
    <Field label="Afirmação verificável"><textarea required minLength={5} value={claim} onChange={event => setClaim(event.target.value)} placeholder="Ex.: o estudo observou..." /></Field>
    <ErrorText message={error} />
    <Button disabled={saving}>{saving ? "Salvando…" : "Registrar efeito"}</Button>
  </form>;
}
