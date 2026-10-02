"use client";
import { useState } from "react";
import { Modal, Field, ErrorText, api, send } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Project, Campaign } from "@/lib/validation/schemas";
export const projectStatuses = { planned: "Planejado", active: "Em andamento", completed: "Concluído", archived: "Arquivado" };
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export function ProjectEditor({ project, campaign, projectId, onClose, onSaved }: {
  project?: Project; campaign?: Campaign; projectId?: string; onClose: () => void; onSaved: (id: string) => Promise<void>;
}) {
  const isCampaign = !!projectId;
  const record = isCampaign ? campaign : project;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Modal title={isCampaign ? (campaign ? "Editar campanha" : "Nova campanha") : (project ? "Editar projeto" : "Novo projeto")} onClose={onClose} wide>
    <ErrorText message={error} />
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      const form = new FormData(e.currentTarget);
      const value: Record<string, unknown> = Object.fromEntries(form);
      const lines = (key: string) => String(form.get(key) || "").split(/[,\n]/).map(v => v.trim()).filter(Boolean);
      if (isCampaign) { value.projectId = projectId; value.team = lines("team"); }
      else { value.members = lines("members"); value.tags = lines("tags"); value.endDate = form.get("endDate") || null;
        value.latitude = form.get("latitude") ? Number(form.get("latitude")) : null; value.longitude = form.get("longitude") ? Number(form.get("longitude")) : null; }
      try {
        const result = await api<{ id: string }>(`${isCampaign ? "campaigns" : "projects"}${record ? `/${record.id}` : ""}`, { ...send(value), method: record ? "PATCH" : "POST" });
        await onSaved(result.id);
      } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
    }}>
      <Field label="Nome"><input name="name" required maxLength={250} defaultValue={record?.name || ""} /></Field>
      {isCampaign ? <>
        <div className="form-grid">
          <Field label="Data da campanha"><input name="date" type="date" required defaultValue={campaign?.date || today()} /></Field>
          <Field label="Equipe" hint="Nomes separados por vírgulas"><input name="team" defaultValue={campaign?.team.join(", ") || ""} /></Field>
        </div>
        <Field label="Área"><textarea name="area" defaultValue={campaign?.area || ""} /></Field>
        <Field label="Objetivo"><textarea name="objective" defaultValue={campaign?.objective || ""} /></Field>
        <Field label="Condições do campo"><textarea name="conditions" defaultValue={campaign?.conditions || ""} /></Field>
      </> : <>
        <Field label="Descrição"><textarea name="description" defaultValue={project?.description || ""} /></Field>
        <div className="form-grid">
          <Field label="Cliente (opcional)"><input name="client" maxLength={500} defaultValue={project?.client || ""} /></Field>
          <Field label="Responsável"><input name="responsible" maxLength={500} defaultValue={project?.responsible || ""} /></Field>
          <Field label="Data inicial"><input name="startDate" type="date" required defaultValue={project?.startDate || today()} /></Field>
          <Field label="Data final (opcional)"><input name="endDate" type="date" defaultValue={project?.endDate || ""} /></Field>
          <Field label="Município / região"><input name="region" maxLength={500} defaultValue={project?.region || ""} /></Field>
          <Field label="Status"><select name="status" defaultValue={project?.status || "active"}>{Object.entries(projectStatuses).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Latitude"><input name="latitude" type="number" step="any" min={-90} max={90} defaultValue={project?.latitude ?? ""} /></Field>
          <Field label="Longitude"><input name="longitude" type="number" step="any" min={-180} max={180} defaultValue={project?.longitude ?? ""} /></Field>
          <Field label="Etiquetas" hint="Separadas por vírgulas"><input name="tags" defaultValue={project?.tags.join(", ") || ""} /></Field>
          <Field label="Membros" hint="Nomes separados por vírgulas; nesta fase são informativos"><input name="members" defaultValue={project?.members.join(", ") || ""} /></Field>
        </div>
        <Field label="Área de interesse"><textarea name="area" defaultValue={project?.area || ""} /></Field>
      </>}
      <Field label="Notas"><textarea name="notes" defaultValue={record?.notes || ""} /></Field>
      <div className="actions"><Button type="submit" disabled={busy}>{busy ? "Salvando…" : isCampaign ? "Salvar campanha" : "Salvar projeto"}</Button><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button></div>
    </form>
  </Modal>;
}
