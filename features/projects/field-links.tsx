"use client";
import { useState } from "react";
import { CustomFields } from "./custom-fields";
import type { SamplingSite, CustomValues } from "@/lib/validation/field";
import { Field } from "@/components/shared";
import type { Project, Campaign } from "@/lib/validation/schemas";
export function FieldLinks({ projects, campaigns, projectId, campaignId, samplingSites = [], samplingSiteId, customValues = {} }: {
  samplingSites?: SamplingSite[]; samplingSiteId?: string | null; customValues?: CustomValues;
  projects: Project[]; campaigns: Campaign[]; projectId?: string | null; campaignId?: string | null;
}) {
  const [project, setProject] = useState(projectId || "");
  const [campaign, setCampaign] = useState(campaignId || "");
  const [site, setSite] = useState(samplingSiteId || "");
  const [values, setValues] = useState<CustomValues>(customValues);
  const definitions = projects.find(p => p.id === project)?.fieldDefinitions || [];
  return <><div className="form-grid">
    <Field label="Projeto"><select name="projectId" value={project} onChange={e => { setProject(e.target.value); setCampaign(""); setSite(""); setValues({}); }}>
      <option value="">Pessoal · sem projeto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select></Field>
    <Field label="Campanha"><select name="campaignId" value={campaign} disabled={!project} onChange={e => setCampaign(e.target.value)}>
      <option value="">Sem campanha</option>{campaign && !campaigns.some(c => c.id === campaign && c.projectId === project) && <option value={campaign}>Campanha indisponível · selecione novamente</option>}
      {campaigns.filter(c => c.projectId === project).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select></Field>
    <Field label="Ponto / parcela"><select name="samplingSiteId" value={site} disabled={!project} onChange={e => setSite(e.target.value)}><option value="">Sem ponto / parcela</option>{samplingSites.filter(s => s.projectId === project && (!s.archived || s.id === site)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
  </div><input type="hidden" name="customValues" value={JSON.stringify(values)} /><CustomFields key={project} definitions={definitions} values={values} onChange={setValues} /></>;
}
