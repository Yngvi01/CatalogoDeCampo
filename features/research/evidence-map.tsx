"use client";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, evidenceLabels } from "@/components/shared";
import type { Catalog, Evidence } from "@/lib/validation/schemas";
import { normalize } from "@/lib/utils";
import { effectLabels, contextLabels } from "./effects";
import { discoverEvidenceRelations, type DiscoveryFilters } from "./evidence-discovery";
import { ipomoeaTaxonomySource } from "./curated-examples";

const originLabels: Record<Evidence["origin"], string> = {
  personal: "Registro pessoal", automatic: "Consulta automática", publication: "Publicação revisada",
  hypothesis: "Hipótese", confirmed: "Confirmado externamente",
};

export function EvidenceMap({ data, query, onSpecies }: { data: Catalog; query: string; onSpecies: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [filters, setFilters] = useState<Omit<DiscoveryFilters, "query">>({ effect: "all", context: "all", studyType: "all", onlyRs: false, onlySourced: false });
  const updateFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => setFilters(current => ({ ...current, [key]: value }));
  const examples = data.curatedExamples ?? { species: [], compounds: [], evidence: [] };
  const relations = [...discoverEvidenceRelations(data, { ...filters, query }), ...discoverEvidenceRelations(examples, { ...filters, query })];
  const selected = [...data.compounds, ...examples.compounds].find(item => item.id === selectedId);
  const speciesById = new Map([...data.species, ...examples.species].map(item => [item.id, item]));
  const linked = selected ? [...data.evidence, ...examples.evidence].filter(item => item.compoundId === selected.id && speciesById.has(item.speciesId)) : [];
  const grouped = [...new Set(linked.map(item => item.speciesId))].map(id => ({ species: speciesById.get(id)!, evidence: linked.filter(item => item.speciesId === id) }));
  const listed = data.compounds.filter(item => normalize([item.name, item.chemicalClass, ...item.synonyms].join(" ")).includes(normalize(query)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return <section className="evidence-map" aria-label="Mapa de evidências por composto">
    <div className="panel evidence-map-intro"><h2>O que foi relatado, e onde?</h2><p>As relações com espécies e os efeitos estudados aparecem separados. Uma ocorrência registrada num organismo não demonstra um efeito ao consumi-lo.</p></div>
    {!selected && <div className="panel evidence-discovery">
      <h3>Buscar organismos por composto e efeito</h3>
      <p>Combine registros do catálogo e exemplos da literatura para investigar uma relação. Cada fonte responde a uma pergunta diferente.</p>
      <div className="evidence-discovery-filters">
        <label>Efeito
          <select aria-label="Filtrar por efeito" value={filters.effect} onChange={event => updateFilter("effect", event.target.value as DiscoveryFilters["effect"])}>
            <option value="all">Todos os efeitos</option>{Object.entries(effectLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>Contexto do efeito
          <select aria-label="Filtrar por contexto do efeito" value={filters.context} onChange={event => updateFilter("context", event.target.value as DiscoveryFilters["context"])}>
            <option value="all">Todos os contextos</option>{Object.entries(contextLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>Tipo de evidência do efeito
          <select aria-label="Filtrar por tipo de estudo" value={filters.studyType} onChange={event => updateFilter("studyType", event.target.value as DiscoveryFilters["studyType"])}>
            <option value="all">Todos os tipos</option><option value="in_vitro">Estudo in vitro</option><option value="animal">Estudo animal</option><option value="human">Estudo humano</option><option value="review">Revisão</option><option value="meta_analysis">Metanálise</option><option value="traditional">Uso tradicional</option><option value="publication">Publicação sem tipo classificado</option>
          </select>
        </label>
      </div>
      <div className="evidence-discovery-checks">
        <label><input type="checkbox" checked={filters.onlyRs} onChange={event => updateFilter("onlyRs", event.target.checked)} /> Apenas espécies com ficha do RS</label>
        <label><input type="checkbox" checked={filters.onlySourced} onChange={event => updateFilter("onlySourced", event.target.checked)} /> Ocorrência revisada e efeito com fonte</label>
      </div>
      <small>“Ficha do RS” usa a seleção da biblioteca, não um levantamento completo do estado. Os exemplos são casos de estudo, não observações de campo nem comprovação de ocorrência no RS.</small>
      {examples.species.some(item => item.id === "example-ipomoea-violacea") && !filters.onlyRs && !filters.onlySourced && filters.effect === "all" && filters.context === "all" && filters.studyType === "all" && (!query || normalize("Ipomoea violacea").includes(normalize(query))) && <div className="evidence-taxonomy-note">
        <span className="badge">EXEMPLO · IDENTIDADE TAXONÔMICA</span><strong><em>Ipomoea violacea</em> ≠ <em>Ipomoea tricolor</em></strong>
        <p>O nome <em>I. violacea</em> foi aplicado incorretamente à <em>I. tricolor</em> em parte da literatura. O exemplo não atribui alcaloides ergolínicos à verdadeira <em>I. violacea</em>.</p>
        <a href={ipomoeaTaxonomySource.url} target="_blank" rel="noreferrer">{ipomoeaTaxonomySource.title} <ArrowUpRight size={12} /></a>
      </div>}
      <p className="evidence-discovery-count">{relations.length} {relations.length === 1 ? "relação encontrada" : "relações encontradas"}</p>
      {relations.length ? <div className="evidence-relation-list">{relations.map(relation => <article className="evidence-relation" key={`${relation.species.id}:${relation.compound.id}`}>
        <div className="evidence-relation-heading"><div><strong><em>{relation.species.scientificName}</em> → {relation.compound.name}</strong>{relation.species.id.startsWith("example-") && <span className="badge">EXEMPLO</span>}<span className="badge">{relation.species.group === "fungus" ? "FUNGO" : "PLANTA"}</span><span className="badge">{relation.hasBothSources ? "OCORRÊNCIA + EFEITO" : "EVIDÊNCIA INCOMPLETA"}</span></div><Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(relation.compound.id)}>Abrir mapa</Button></div>
        <div className="evidence-relation-sources">
          <div><span className="eyebrow">1 · COMPOSTO NA PLANTA</span>{relation.sourcedOccurrence ? <><p>{relation.sourcedOccurrence.claim}</p><a href={relation.sourcedOccurrence.url} target="_blank" rel="noreferrer">{relation.sourcedOccurrence.source} <ArrowUpRight size={12} /></a></> : <p>Falta uma ocorrência com fonte revisada. {relation.occurrences.length} {relation.occurrences.length === 1 ? "registro disponível" : "registros disponíveis"} no catálogo.</p>}</div>
          <div><span className="eyebrow">2 · EFEITO ESTUDADO</span>{relation.claims.length ? relation.claims.map(claim => <p key={claim.id}><strong>{effectLabels[claim.kind]} · {contextLabels[claim.context]} · {evidenceLabels[claim.type]}</strong><br /><a href={claim.url} target="_blank" rel="noreferrer">{claim.source} <ArrowUpRight size={12} /></a></p>) : <p>Nenhum efeito com fonte corresponde aos filtros.</p>}</div>
        </div>
        <small>Associação para investigar; não confirma composição da amostra nem efeito do uso do organismo. Estudos com extratos ou organismos inteiros não isolam a ação do composto.</small>
      </article>)}</div> : <p className="evidence-discovery-empty">Nenhuma relação corresponde aos filtros. Amplie os critérios ou registre as fontes que faltam.</p>}
    </div>}
    {!selected ? listed.length ? <div className="evidence-index">{listed.map(compound => {
      const occurrences = data.evidence.filter(item => item.compoundId === compound.id);
      return <button type="button" className="panel evidence-index-card" key={compound.id} onClick={() => setSelectedId(compound.id)}>
        <strong>{compound.name}</strong><span>{occurrences.length} {occurrences.length === 1 ? "relação com espécie" : "relações com espécies"} · {(compound.effectClaims || []).length} {(compound.effectClaims || []).length === 1 ? "efeito com fonte" : "efeitos com fonte"}</span>
      </button>;
    })}</div> : <Empty icon={<FlaskConical size={30} />} title="Nenhum composto corresponde à busca." text="Cadastre um composto ou ajuste a busca para explorar suas evidências." /> : <>
      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId("")}><ArrowLeft size={14} /> Todos os compostos</Button>
      <div className="panel evidence-map-title"><span className="eyebrow">MAPA DE EVIDÊNCIAS {selected.id.startsWith("example-") && "· EXEMPLO DA LITERATURA"}</span><h2>{selected.name}</h2><p>{grouped.length} {grouped.length === 1 ? "espécie relacionada" : "espécies relacionadas"} · {linked.length} {linked.length === 1 ? "registro" : "registros"}</p></div>
      <div className="evidence-map-columns">
        <div><h3>Relações com espécies</h3>{grouped.length ? grouped.map(group => <article className="panel evidence-species" key={group.species.id}>
          <div className="evidence-species-heading"><div><span className="badge">{group.species.group === "plant" ? "PLANTA" : "FUNGO"}</span><h4><em>{group.species.scientificName}</em></h4></div>{!group.species.id.startsWith("example-") && <Button type="button" size="sm" variant="outline" onClick={() => onSpecies(group.species.id)}>Abrir ficha</Button>}</div>
          {group.species.notes && <p className="evidence-example-note">{group.species.notes}</p>}
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
