import { validateDefinitionChanges } from "./field-service";
import { randomUUID } from "node:crypto";
import { transaction } from "@/lib/db";
import { get, put, snapshot } from "@/lib/db/repository";
import { projectInput, projectSchema, campaignInput, campaignSchema, type Project, type Campaign } from "@/lib/validation/schemas";

export async function validateFieldLinks(value: { projectId?: string | null; campaignId?: string | null }) {
  if (value.projectId && !await get<Project>("projects", value.projectId))
    throw new Error("Projeto não encontrado.");
  if (value.campaignId) {
    const campaign = await get<Campaign>("campaigns", value.campaignId);
    if (!value.projectId || campaign?.projectId !== value.projectId)
      throw new Error("A campanha deve pertencer ao projeto selecionado.");
  }
}
export async function saveProject(input: unknown, id?: string) {
  return transaction(async () => {
    const current = id ? await get<Project>("projects", id) : undefined;
    if (id && !current) throw new Error("Projeto não encontrado.");
    const value = projectInput.parse({ ...current, ...(input as Record<string, unknown>) });
    if (current) await validateDefinitionChanges(current, value.fieldDefinitions || []);
    const now = new Date().toISOString();
    const record = projectSchema.parse({ ...value, id: id || randomUUID(), createdAt: current?.createdAt || now, updatedAt: now });
    await put("projects", record);
    return record;
  });
}
export async function saveCampaign(input: unknown, id?: string) {
  return transaction(async () => {
    const current = id ? await get<Campaign>("campaigns", id) : undefined;
    if (id && !current) throw new Error("Campanha não encontrada.");
    const value = campaignInput.parse(input);
    if (current && current.projectId !== value.projectId) throw new Error("A campanha não pode mudar de projeto.");
    await validateFieldLinks({ projectId: value.projectId });
    const now = new Date().toISOString();
    const record = campaignSchema.parse({ ...value, id: id || randomUUID(), createdAt: current?.createdAt || now, updatedAt: now });
    await put("campaigns", record);
    return record;
  });
}
export async function projectData(id: string, filters: { campaignId?: string; from?: string; to?: string; speciesId?: string; samplingSiteId?: string } = {}) {
  const data = await snapshot();
  const project = data.projects.find(p => p.id === id);
  if (!project) throw new Error("Projeto não encontrado.");
  if (filters.campaignId && !data.campaigns.some(c => c.id === filters.campaignId && c.projectId === id))
    throw new Error("Campanha não encontrada neste projeto.");
  if (filters.samplingSiteId && !data.samplingSites.some(s => s.id === filters.samplingSiteId && s.projectId === id)) throw new Error("Ponto ou parcela não encontrado neste projeto.");
  const observations = data.observations.filter(o => o.projectId === id &&
    (!filters.campaignId || o.campaignId === filters.campaignId) &&
    (!filters.from || o.observedAt.slice(0, 10) >= filters.from) &&
    (!filters.to || o.observedAt.slice(0, 10) <= filters.to) &&
    (!filters.speciesId || o.speciesId === filters.speciesId) &&
    (!filters.samplingSiteId || o.samplingSiteId === filters.samplingSiteId));
  const obsIds = new Set(observations.map(o => o.id));
  const speciesIds = new Set(observations.map(o => o.speciesId).filter(Boolean));
  const history = data.history.filter(h => obsIds.has(h.observationId));
  for (const h of history) for (const speciesId of [h.speciesId, h.previousSpeciesId]) if (speciesId) speciesIds.add(speciesId);
  return {
    ...data, projects: [project], campaigns: data.campaigns.filter(c => c.projectId === id && (!filters.campaignId || c.id === filters.campaignId)),
    samplingSites: data.samplingSites.filter(s => s.projectId === id && (!filters.samplingSiteId || s.id === filters.samplingSiteId)),
    observations, species: data.species.filter(s => speciesIds.has(s.id)),
    images: data.images.filter(p => obsIds.has(p.observationId)),
    identifications: data.identifications.filter(i => obsIds.has(i.observationId)), history,
    compounds: [], bookmarks: [], evidence: [], discoveries: [], research: [], settings: [], notes: [],
  };
}
export function projectGeoJSON(data: Awaited<ReturnType<typeof projectData>>) {
  const observations = data.observations
    .filter(o => o.latitude !== null && o.longitude !== null)
    .map(o => ({ type: "Feature", id: o.id, geometry: { type: "Point", coordinates: [o.longitude, o.latitude] },
      properties: { ...o, recordType: "observation", samplingSite: data.samplingSites.find(s => s.id === o.samplingSiteId)?.name || null, species: data.species.find(s => s.id === o.speciesId)?.scientificName || null,
        project: data.projects[0].name, campaign: data.campaigns.find(c => c.id === o.campaignId)?.name || null } }));
  const sites = data.samplingSites.map(site => ({ type: "Feature", id: site.id, geometry: site.geometry,
    properties: { recordType: "sampling_site", name: site.name, kind: site.kind, notes: site.notes, projectId: site.projectId, project: data.projects[0].name, species: null, campaign: null } }));
  return { type: "FeatureCollection", features: [...observations, ...sites] };
}
