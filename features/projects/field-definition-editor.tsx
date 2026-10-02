"use client";
import { useState } from "react";
import { Modal, Field, ErrorText, api, send } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/validation/schemas";
import type { FieldDefinition } from "@/lib/validation/field";
export const fieldTypes = { text: "Texto", number: "Número", select: "Seleção", multi_select: "Múltipla seleção", boolean: "Verdadeiro/falso", date: "Data", coordinate: "Coordenada", note: "Observação" };
export function FieldDefinitionEditor({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => Promise<void> }) {
  const [definitions, setDefinitions] = useState<FieldDefinition[]>(project.fieldDefinitions || []);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const change = (id: string, value: Partial<FieldDefinition>) => setDefinitions(all => all.map(field => field.id === id ? { ...field, ...value } : field));
  return <Modal title="Formulário de campo" subtitle={project.name} onClose={onClose} wide>
    <p>Adicione campos ao projeto. Desative campos antigos para preservar os dados já preenchidos.</p>
    <ErrorText message={error} />
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try {
      await api(`projects/${project.id}/fields`, { ...send({ definitions: definitions.map(field => ({ ...field, options: field.options.map(option => option.trim()).filter(Boolean) })), expectedUpdatedAt: project.updatedAt }), method: "PATCH" });
      await onSaved(); onClose();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>
      {definitions.map((field, index) => <fieldset key={field.id} className="panel field-definition"><legend>Campo {index+1}</legend><div className="form-grid">
        <Field label={`Nome do campo ${index+1}`}><input required maxLength={150} value={field.label} onChange={e => change(field.id,{ label: e.target.value })} /></Field>
        <Field label={`Tipo do campo ${index+1}`}><select value={field.type} onChange={e => change(field.id,{ type: e.target.value as FieldDefinition["type"] })}>{Object.entries(fieldTypes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label={`Unidade do campo ${index+1}`}><input maxLength={50} value={field.unit} onChange={e => change(field.id,{ unit: e.target.value })} placeholder="Ex.: cm" /></Field>
      </div>
      {["select","multi_select"].includes(field.type) && <Field label={`Opções do campo ${index+1}`} hint="Uma opção por linha"><textarea required value={field.options.join("\n")} onChange={e => change(field.id,{ options: e.target.value.split("\n") })} /></Field>}
      <div className="actions"><label className="checkbox"><input type="checkbox" checked={field.required} onChange={e => change(field.id,{ required: e.target.checked })} />Obrigatório</label><label className="checkbox"><input type="checkbox" checked={field.archived} onChange={e => change(field.id,{ archived: e.target.checked })} />Desativado</label><Button variant="ghost" type="button" onClick={() => setDefinitions(all => all.filter(f => f.id !== field.id))}>Remover campo {index+1}</Button></div></fieldset>)}
      <div className="actions"><Button type="button" variant="outline" disabled={definitions.length >= 40} onClick={() => setDefinitions(all => [...all,{ id: crypto.randomUUID(), label: "", type: "text", options: [], required: false, archived: false, unit: "" }])}>Adicionar campo</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar formulário"}</Button></div>
    </form>
  </Modal>;
}
