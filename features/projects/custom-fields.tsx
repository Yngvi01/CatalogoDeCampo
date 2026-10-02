"use client";
import { useState } from "react";
import { Field } from "@/components/shared";
import type { FieldDefinition, CustomValues } from "@/lib/validation/field";
export function CustomFields({ definitions, values, onChange }: { definitions: FieldDefinition[]; values: CustomValues; onChange: (values: CustomValues) => void }) {
  const set = (id: string, value: CustomValues[string] | undefined) => {
    const next = { ...values }; if (value === undefined || value === "") delete next[id]; else next[id] = value; onChange(next);
  };
  return <div className="form-grid">{definitions.filter(f => !f.archived).map(field => {
    const value = values[field.id];
    const label = `${field.label}${field.unit ? ` (${field.unit})` : ""}${field.required ? " *" : ""}`;
    if (field.type === "coordinate") return <CoordinateField key={field.id} field={field} value={value} onChange={coordinate => set(field.id, coordinate)} />;
    if (field.type === "multi_select") return <fieldset key={field.id} className="field-choices"><legend>{label}</legend>{field.options.map(option => <label key={option} className="checkbox"><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => { const choices = Array.isArray(value) ? value : []; set(field.id, e.target.checked ? [...choices,option] : choices.filter(v => v !== option)); }} />{option}</label>)}</fieldset>;
    if (field.type === "boolean" || field.type === "select") return <Field key={field.id} label={label}><select required={field.required} value={value === undefined ? "" : String(value)} onChange={e => set(field.id,e.target.value === "" ? undefined : field.type === "boolean" ? e.target.value === "true" : e.target.value)}><option value="">Selecione…</option>{field.type === "boolean" ? <><option value="true">Sim</option><option value="false">Não</option></> : field.options.map(v => <option key={v}>{v}</option>)}</select></Field>;
    if (field.type === "note") return <Field key={field.id} label={label}><textarea required={field.required} maxLength={30000} value={typeof value === "string" ? value : ""} onChange={e => set(field.id,e.target.value)} /></Field>;
    return <Field key={field.id} label={label}><input required={field.required} maxLength={30000} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} step={field.type === "number" ? "any" : undefined} value={typeof value === "string" || typeof value === "number" ? value : ""} onChange={e => set(field.id,e.target.value === "" ? undefined : field.type === "number" ? Number(e.target.value) : e.target.value)} /></Field>;
  })}</div>;
}

function CoordinateField({ field, value, onChange }: { field: FieldDefinition; value?: CustomValues[string]; onChange: (value: CustomValues[string] | undefined) => void }) {
  const initial = typeof value === "object" && !Array.isArray(value) ? value : undefined;
  const [lat, setLat] = useState(initial ? String(initial.latitude) : "");
  const [lon, setLon] = useState(initial ? String(initial.longitude) : "");
  return <div className="form-grid">{(["latitude", "longitude"] as const).map(part => <Field key={part} label={`${field.label}: ${part === "latitude" ? "latitude" : "longitude"}`}>
    <input type="number" step="any" min={part === "latitude" ? -90 : -180} max={part === "latitude" ? 90 : 180} required={field.required || !!(part === "latitude" ? lon : lat)}
      value={part === "latitude" ? lat : lon} onChange={e => {
        const nextLat = part === "latitude" ? e.target.value : lat, nextLon = part === "longitude" ? e.target.value : lon;
        setLat(nextLat); setLon(nextLon); onChange(nextLat && nextLon ? { latitude: Number(nextLat), longitude: Number(nextLon) } : undefined);
      }} />
  </Field>)}</div>;
}
