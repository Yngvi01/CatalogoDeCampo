"use client";
import { useState } from "react";
import { Modal, Field, ErrorText, api, send } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/validation/schemas";
import type { SamplingSite } from "@/lib/validation/field";
const types = { Point: "Ponto", LineString: "Trilha / linha", Polygon: "Parcela / área" };
export function SitesPanel({ project, sites, refresh }: { project: Project; sites: SamplingSite[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<SamplingSite | "new" | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false);
  return <section className="panel sites-panel">
    <div className="section-heading"><h2>Pontos, trilhas e parcelas</h2><Button variant="outline" onClick={() => setEditing("new")}>Novo ponto / área</Button></div>
    <ErrorText message={error} />{notice && <p role="status">{notice}</p>}
    {!sites.length && <p>Nenhum local de amostragem. Crie um ponto ou importe linhas e áreas em GeoJSON.</p>}
    <div className="project-records">{sites.map(site => <div key={site.id} className="project-record"><strong>{site.name}</strong><span>{types[site.geometry.type]}{site.archived ? " · desativado" : ""}</span><Button size="sm" variant="ghost" onClick={() => setEditing(site)}>Editar {site.name}</Button></div>)}</div>
    <form onSubmit={async e => { e.preventDefault(); const importForm = e.currentTarget; if (!file) return; setBusy(true); setError(""); setNotice(""); try {
      if (file.size > 2 * 1024 * 1024) throw new Error("GeoJSON deve ter até 2 MB.");
      const result = await api<{ count: number }>(`projects/${project.id}/import-geojson`, send(JSON.parse(await file.text())));
      await refresh(); setNotice(`${result.count} local(is) de amostragem importado(s).`); setFile(null); importForm.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>
      <Field label="Arquivo GeoJSON" hint="Até 2 MB; Point, LineString e Polygon; coordenadas na ordem longitude, latitude"><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      <Button type="submit" variant="outline" disabled={busy || !file}>{busy ? "Importando…" : "Importar GeoJSON"}</Button>
    </form>
    {editing && <SiteEditor key={editing === "new" ? "new" : editing.id} project={project} site={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={async () => { await refresh(); setEditing(null); }} />}
  </section>;
}
function SiteEditor({ project, site, onClose, onSaved }: { project: Project; site?: SamplingSite; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<keyof typeof types>(site?.geometry.type || "Point");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const coordinate = site?.geometry.type === "Point" ? site.geometry.coordinates : undefined;
  return <Modal title={site ? "Editar local de amostragem" : "Novo local de amostragem"} subtitle={project.name} onClose={onClose}>
    <ErrorText message={error} /><form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError(""); try {
      const geometry = type === "Point" ? { type, coordinates: [Number(form.get("longitude")), Number(form.get("latitude"))] } : JSON.parse(String(form.get("geometry")));
      if (geometry.type !== type) throw new Error("A geometria deve corresponder ao tipo selecionado.");
      await api(`sampling-sites${site ? `/${site.id}` : ""}`, { ...send({ projectId: project.id, name: form.get("name"), notes: form.get("notes"), archived: form.get("archived") === "on", geometry }), method: site ? "PATCH" : "POST" }); await onSaved();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>
      <Field label="Nome do local"><input name="name" required maxLength={250} defaultValue={site?.name || ""} /></Field>
      <Field label="Tipo de amostragem"><select value={type} onChange={e => setType(e.target.value as keyof typeof types)}>{Object.entries(types).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {type === "Point" ? <div className="form-grid"><Field label="Latitude do ponto"><input type="number" name="latitude" step="any" min={-90} max={90} required defaultValue={coordinate?.[1] ?? ""} /></Field><Field label="Longitude do ponto"><input type="number" name="longitude" step="any" min={-180} max={180} required defaultValue={coordinate?.[0] ?? ""} /></Field></div> : <Field label="Geometria GeoJSON" hint="Objeto geometry com type e coordinates; longitude antes de latitude"><textarea name="geometry" required rows={8} defaultValue={site && site.geometry.type === type ? JSON.stringify(site.geometry,null,2) : ""} placeholder={type === "LineString" ? '{"type":"LineString","coordinates":[[-50,-29],[-50.1,-29.1]]}' : '{"type":"Polygon","coordinates":[[[-50,-29],[-50.1,-29],[-50.1,-29.1],[-50,-29]]]}' } /></Field>}
      <Field label="Notas do local"><textarea name="notes" defaultValue={site?.notes || ""} maxLength={30000} /></Field>
      <label className="checkbox"><input type="checkbox" name="archived" defaultChecked={site?.archived || false} />Desativado (preservar vínculos existentes)</label>
      <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar local"}</Button>
    </form>
  </Modal>;
}
