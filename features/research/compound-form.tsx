"use client";
import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, ErrorText, api, send } from "@/components/shared";
import type { PubChemMatch } from "@/lib/providers/pubchem";

type Values = {
  name: string; synonyms: string; chemicalClass: string; formula: string;
  description: string; mechanisms: string; targets: string; effects: string; toxicology: string;
};
const empty: Values = {
  name: "", synonyms: "", chemicalClass: "", formula: "", description: "",
  mechanisms: "", targets: "", effects: "", toxicology: "",
};

export function CompoundForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PubChemMatch[] | null>(null);
  const [selected, setSelected] = useState<PubChemMatch | null>(null);
  const [values, setValues] = useState<Values>(empty);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const setField = (field: keyof Values, value: string) => {
    setValues(current => ({ ...current, [field]: value }));
    if (field === "name" || field === "formula") setSelected(null);
  };
  const search = async () => {
    setSearching(true);
    setError("");
    setMatches(null);
    try {
      setMatches(await api<PubChemMatch[]>(`pubchem/search?q=${encodeURIComponent(query.trim())}`));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSearching(false);
    }
  };
  return <div className="compound-editor">
    <div className="pubchem-search">
      <Field label="Buscar composto no PubChem">
        <input value={query} onChange={event => { setQuery(event.target.value); setMatches(null); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (query.trim().length >= 2 && !searching) void search(); } }} placeholder="Ex.: cafeína, psilocibina, linalol" />
      </Field>
      <Button type="button" variant="outline" disabled={searching || query.trim().length < 2} onClick={search}><Search size={15} /> {searching ? "Buscando…" : "Buscar"}</Button>
    </div>
    {matches && <div className="pubchem-results" aria-live="polite">
      {matches.length ? <><p>Selecione o registro químico correspondente. Nomes semelhantes podem representar compostos diferentes.</p>
        {matches.map(match => <button type="button" className={selected?.cid === match.cid ? "selected" : ""} key={match.cid} onClick={() => {
          setSelected(match);
          setValues(current => ({ ...current, name: match.name, formula: match.formula }));
        }}><strong>{match.name}</strong><span>CID {match.cid} · {match.formula || "Fórmula não informada"}{match.molecularWeight ? ` · ${match.molecularWeight} g/mol` : ""}</span></button>)}</>
        : <p>Nenhum composto encontrado com esse nome. Você ainda pode cadastrar manualmente.</p>}
    </div>}
    {selected && <p className="pubchem-selected">Registro selecionado: <a href={selected.url} target="_blank" rel="noreferrer">PubChem CID {selected.cid} <ArrowUpRight size={13} /></a>{selected.inchiKey && <> · InChIKey {selected.inchiKey}</>}</p>}
    <p className="tip">O PubChem descreve o composto; não confirma sua presença em uma planta nem seus efeitos em pessoas. Vincule espécie, parte analisada e publicação por uma evidência separada.</p>
    <form onSubmit={async event => {
      event.preventDefault();
      setSaving(true);
      setError("");
      try {
        await api("compounds", send({ ...values, pubchemCid: selected?.cid ?? null,
          molecularWeight: selected?.molecularWeight || "", inchiKey: selected?.inchiKey || "",
          synonyms: values.synonyms.split(";").map(value => value.trim()).filter(Boolean) }));
        await onSaved();
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setSaving(false);
      }
    }}>
      <div className="form-grid">
        {([
          ["name", "Nome"], ["synonyms", "Sinônimos (;)"], ["chemicalClass", "Classe química"],
          ["formula", "Fórmula"], ["targets", "Alvos"],
        ] as const).map(([field, label]) => <Field label={label} key={field}><input value={values[field]} onChange={event => setField(field, event.target.value)} required={field === "name"} /></Field>)}
      </div>
      {([
        ["description", "Descrição"], ["mechanisms", "Mecanismos"],
        ["toxicology", "Toxicologia"],
      ] as const).map(([field, label]) => <Field label={label} key={field}><textarea value={values[field]} onChange={event => setField(field, event.target.value)} /></Field>)}
      <ErrorText message={error} />
      <Button disabled={saving}>{saving ? "Salvando…" : "Salvar composto"}</Button>
    </form>
  </div>;
}
