"use client";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, evidenceLabels } from "@/components/shared";
import type { Catalog, Evidence } from "@/lib/validation/schemas";
import { normalize } from "@/lib/utils";
import { effectLabels, contextLabels } from "./effects";

const originLabels: Record<Evidence["origin"], string> = {
  personal: "Registro pessoal", automatic: "Consulta automática", publication: "Publicação revisada",
  hypothesis: "Hipótese", confirmed: "Confirmado externamente",
};

export function EvidenceMap({ data, query, onSpecies }: { data: Catalog; query: string; onSpecies: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const selected = data.compounds.find(item => item.id === selectedId);
  const speciesById = new Map(data.species.map(item => [item.id, item]));
  const linked = selected ? data.evidence.filter(item => item.compoundId === selected.id && speciesById.has(item.speciesId)) : [];
  const grouped = [...new Set(linked.map(item => item.speciesId))].map(id => ({ species: speciesById.get(id)!, evidence: linked.filter(item => item.speciesId === id) }));
  const listed = data.compounds.filter(item => normalize([item.name, item.chemicalClass, ...item.synonyms].join(" ")).includes(normalize(query)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return <section className="evidence-map" aria-label="Mapa de evidências por composto">
    <div className="panel evidence-map-intro"><h2>O que foi relatado, e onde?</h2><p>As relações com espécies e os efeitos estudados aparecem separados. Uma ocorrência registrada numa planta não demonstra um efeito ao consumi-la.</p></div>
    {!selected ? listed.length ? <div className="evidence-index">{listed.map(compound => {
      const occurrences = data.evidence.filter(item => item.compoundId === compound.id);
      return <button type="button" className="panel evidence-index-card" key={compound.id} onClick={() => setSelectedId(compound.id)}>
        <strong>{compound.name}</strong><span>{occurrences.length} {occurrences.length === 1 ? "relação com espécie" : "relações com espécies"} · {(compound.effectClaims || []).length} {(compound.effectClaims || []).length === 1 ? "efeito com fonte" : "efeitos com fonte"}</span>
      </button>;
    })}</div> : <Empty icon={<FlaskConical size={30} />} title="Nenhum composto corresponde à busca." text="Cadastre um composto ou ajuste a busca para explorar suas evidências." /> : <>
      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId("")}><ArrowLeft size={14} /> Todos os compostos</Button>
      <div className="panel evidence-map-title"><span className="eyebrow">MAPA DE EVIDÊNCIAS</span><h2>{selected.name}</h2><p>{grouped.length} {grouped.length === 1 ? "espécie relacionada" : "espécies relacionadas"} · {linked.length} {linked.length === 1 ? "registro" : "registros"}</p></div>
      <div className="evidence-map-columns">
        <div><h3>Relações com espécies</h3>{grouped.length ? grouped.map(group => <article className="panel evidence-species" key={group.species.id}>
          <div className="evidence-species-heading"><div><span className="badge">{group.species.group === "plant" ? "PLANTA" : "FUNGO"}</span><h4><em>{group.species.scientificName}</em></h4></div><Button type="button" size="sm" variant="outline" onClick={() => onSpecies(group.species.id)}>Abrir ficha</Button></div>
          {group.evidence.map(item => <div className="evidence-source" key={item.id}>
            <div className="evidence-source-badges"><span className="badge">{originLabels[item.origin]}</span><span className="badge">{evidenceLabels[item.type]}</span></div>
            <strong>{item.property || "Relação registrada"}</strong><p>{item.claim}</p>
            <dl>
              <div><dt>Parte</dt><dd>{item.part || "Não informada"}</dd></div>
              <div><dt>Método</dt><dd>{item.method || "Não informado"}</dd></div>
              <div><dt>Concentração</dt><dd>{item.concentration ? `${item.concentration}${item.unit ? ` ${item.unit}` : ""}` : "Não informada"}</dd></div>
              <div><dt>Amostra</dt><dd>{item.sampleOrigin || "Não informada"}</dd></div>
            </dl>
            {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.source || "Abrir fonte"} <ArrowUpRight size={13} /></a> : <span className="evidence-missing-source">Sem link de fonte</span>}
          </div>)}
        </article>) : <div className="panel evidence-empty">Nenhuma relação entre este composto e uma espécie foi registrada no catálogo.</div>}</div>
        <div><h3>Efeitos estudados</h3>{(selected.effectClaims || []).length ? selected.effectClaims.map(item => <article className="panel evidence-effect" key={item.id}>
          <div className="evidence-source-badges"><span className="badge">{effectLabels[item.kind]}</span><span className="badge">{contextLabels[item.context]}</span><span className="badge">{evidenceLabels[item.type]}</span></div>
          <p>{item.claim}</p><a href={item.url} target="_blank" rel="noreferrer">{item.source} <ArrowUpRight size={13} /></a>
        </article>) : <div className="panel evidence-empty">Nenhum efeito com fonte foi registrado para este composto.</div>}
        {selected.effects && <p className="evidence-legacy">Anotação anterior, sem fonte estruturada: {selected.effects}</p>}</div>
      </div>
    </>}
  </section>;
}
