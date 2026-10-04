"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Empty, Loading } from "@/components/shared";
import { FolderOpen, Plus, ArrowLeft } from "lucide-react";
import { dateLabel, normalize, statuses } from "@/lib/utils";
import type { Catalog, Campaign } from "@/lib/validation/schemas";
import { SitesPanel } from "./sites-panel";
import { FieldDefinitionEditor } from "./field-definition-editor";
import { ProjectEditor, projectStatuses } from "./project-editor";
const FieldMap = dynamic(() => import("@/features/map/field-map"), { ssr: false, loading: () => <Loading /> });
export function ProjectsPanel({ data, query, refresh, onObservation, onNew }: {
  data: Catalog; query: string; refresh: () => Promise<void>; onObservation: (id: string) => void;
  onNew: (projectId: string, campaignId?: string) => void;
}) {
  const [fieldEditor, setFieldEditor] = useState(false);
  const [samplingSiteId, setSamplingSiteId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [editor, setEditor] = useState<"new" | "project" | "campaign" | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>();
  const [campaignId, setCampaignId] = useState(""), [from, setFrom] = useState(""), [to, setTo] = useState(""), [speciesId, setSpeciesId] = useState("");
  const project = data.projects.find(p => p.id === projectId);
  const sites = data.samplingSites.filter(s => s.projectId === projectId);
  const campaigns = data.campaigns.filter(c => c.projectId === projectId);
  const all = data.observations.filter(o => o.projectId === projectId);
  const observations = all.filter(o => (!campaignId || o.campaignId === campaignId) && (!from || o.observedAt.slice(0,10) >= from) && (!to || o.observedAt.slice(0,10) <= to) && (!speciesId || o.speciesId === speciesId) && (!samplingSiteId || o.samplingSiteId === samplingSiteId));
  const species = data.species.filter(s => all.some(o => o.speciesId === s.id));
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries({ campaignId, from, to, speciesId, samplingSiteId })) if (value) exportParams.set(key, value);
  return <section className="projects-panel">
    {!project ? <>
      <div className="section-heading"><h2>Projetos de campo</h2><Button onClick={() => setEditor("new")}><Plus size={16} /> Novo projeto</Button></div>
      {!data.projects.length ? <Empty icon={<FolderOpen size={34} />} title="Organize seu próximo trabalho de campo" text="Reúna campanhas e observações em um projeto. Seu catálogo pessoal continua disponível." /> :
        <div className="cards">{data.projects.filter(p => normalize([p.name,p.client,p.region,...p.tags].join(" ")).includes(normalize(query))).map(p => <button key={p.id} className="panel project-card" onClick={() => { setSamplingSiteId(""); setProjectId(p.id); setCampaignId(""); setFrom(""); setTo(""); setSpeciesId(""); }}>
          <span className="pill">{projectStatuses[p.status]}</span><h3>{p.name}</h3><p>{p.region || "Região não informada"}</p><p>{p.client}</p>
          <small>{data.observations.filter(o => o.projectId === p.id).length} observações · {data.campaigns.filter(c => c.projectId === p.id).length} campanhas</small>
        </button>)}</div>}
      {!!data.projects.length && !data.projects.some(p => normalize([p.name,p.client,p.region,...p.tags].join(" ")).includes(normalize(query))) && <p>Nenhum projeto encontrado.</p>}
    </> : <>
      <div className="actions"><Button variant="ghost" onClick={() => setProjectId(null)}><ArrowLeft size={16} /> Todos os projetos</Button><Button variant="outline" onClick={() => setEditor("project")}>Editar projeto</Button><Button onClick={() => onNew(project.id, campaignId || undefined)}><Plus size={16} /> Identificar e registrar</Button></div>
      <div className="actions"><a className="text-button" href={`/collect.html?project=${project.id}${campaignId ? `&campaign=${campaignId}` : ""}`}>Coletar offline neste projeto</a><Button variant="outline" onClick={() => setFieldEditor(true)}>Configurar formulário</Button></div>
      <section className="panel project-summary"><span className="pill">{projectStatuses[project.status]}</span><h2>{project.name}</h2><p>{project.description}</p>
        <dl><div><dt>Local</dt><dd>{project.region || "Não informado"}</dd></div><div><dt>Período</dt><dd>{dateLabel(project.startDate+"T12:00:00Z")} → {project.endDate ? dateLabel(project.endDate+"T12:00:00Z") : "Em aberto"}</dd></div><div><dt>Responsável</dt><dd>{project.responsible || "Não informado"}</dd></div><div><dt>Cliente</dt><dd>{project.client || "Não informado"}</dd></div><div><dt>Membros</dt><dd>{project.members.join(", ") || "Não informados"}</dd></div></dl>
        {project.area && <p>Área de interesse: {project.area}</p>}{project.latitude !== null && <p>Coordenadas: {project.latitude}, {project.longitude}</p>}{project.tags.length > 0 && <p>Etiquetas: {project.tags.join(", ")}</p>}{project.notes && <p>{project.notes}</p>}
      </section>
      <div className="stats-grid">{[
        ["Observações",all.length], ["Espécies",species.length], ["Campanhas",campaigns.length],
        ["Pendentes de identificação",all.filter(o => ["unidentified","candidates","probable"].includes(o.status)).length],
        ["Confirmadas externamente",all.filter(o => o.status === "externally_confirmed").length],
      ].map(([label,value]) => <div key={label} className="stat panel"><small>{label}</small><strong>{value}</strong></div>)}</div>
      <div className="section-heading"><h2>Campanhas</h2><Button variant="outline" onClick={() => { setEditingCampaign(undefined); setEditor("campaign"); }}><Plus size={16} /> Nova campanha</Button></div>
      {!campaigns.length && <p>Nenhuma campanha criada. Observações também podem pertencer diretamente ao projeto.</p>}
      <div className="cards">{campaigns.map(c => <article key={c.id} className="panel project-card"><h3>{c.name}</h3><p>{dateLabel(c.date+"T12:00:00Z")} · {all.filter(o => o.campaignId === c.id).length} observações</p><p>{c.objective}</p><p>{c.team.join(", ")}</p>{c.area && <p>Área: {c.area}</p>}{c.conditions && <p>Condições: {c.conditions}</p>}{c.notes && <p>{c.notes}</p>}<div className="actions"><Button variant="outline" onClick={() => { setEditingCampaign(c); setEditor("campaign"); }}>Editar campanha</Button><Button variant="outline" onClick={() => onNew(project.id,c.id)}>Identificar nesta campanha</Button></div></article>)}</div>
      <SitesPanel project={project} sites={sites} refresh={refresh} />
      <div className="section-heading"><h2>Observações e exportações</h2><span>{observations.length} registros</span></div>
      <div className="form-grid">
        <label className="field"><span>Filtrar ponto / parcela</span><select value={samplingSiteId} onChange={e => setSamplingSiteId(e.target.value)}><option value="">Todos os locais</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field"><span>Filtrar campanha</span><select value={campaignId} onChange={e => setCampaignId(e.target.value)}><option value="">Todas as campanhas</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field"><span>Filtrar espécie</span><select value={speciesId} onChange={e => setSpeciesId(e.target.value)}><option value="">Todas as espécies</option>{species.map(s => <option key={s.id} value={s.id}>{s.scientificName}</option>)}</select></label>
        <label className="field"><span>Data de início</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="field"><span>Data de término</span><input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <div className="actions project-exports">{["csv","geojson","json","zip"].map(format => <a key={format} className="text-button" href={`/api/projects/${project.id}/export?${exportParams.toString()}&format=${format}`}>Exportar {format.toUpperCase()}</a>)}</div>
      <p className="muted">GeoJSON inclui os registros com coordenadas e os locais de amostragem. ZIP inclui fotos; JSON inclui apenas os metadados.</p>
      <FieldMap samplingSites={sites.filter(s => !samplingSiteId || s.id === samplingSiteId)} showList={false} observations={observations} species={data.species} onOpen={onObservation} />
      {!observations.length && <p>Nenhuma observação neste recorte. Use “Registrar no projeto” ou vincule um registro existente em “Editar dados”.</p>}
      <div className="project-records">{observations.map(o => <button key={o.id} className="panel project-record" onClick={() => onObservation(o.id)}><strong>{o.code}</strong><span>{data.species.find(s => s.id === o.speciesId)?.scientificName || "Não identificado"}</span><small>{dateLabel(o.observedAt)} · {statuses[o.status]}</small></button>)}</div>
    </>}
    {fieldEditor && project && <FieldDefinitionEditor project={project} onClose={() => setFieldEditor(false)} onSaved={refresh} />}
    {editor && <ProjectEditor key={editingCampaign?.id || editor} project={editor === "project" ? project : undefined} projectId={editor === "campaign" ? project?.id : undefined} campaign={editor === "campaign" ? editingCampaign : undefined} onClose={() => setEditor(null)} onSaved={async id => { await refresh(); setEditor(null); if (editor === "new") setProjectId(id); }} />}
  </section>;
}
