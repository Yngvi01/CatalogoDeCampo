import { randomUUID } from "node:crypto";
import { transaction } from "@/lib/db";
import { get, put, list } from "@/lib/db/repository";
import type { Project, Observation } from "@/lib/validation/schemas";
import { siteInputSchema, siteSchema, geoJSONImportSchema, validateCustomValues, type SamplingSite, type CustomValues, type FieldDefinition } from "@/lib/validation/field";

export async function validateProjectFields(value: { projectId?: string | null; samplingSiteId?: string | null; customValues?: CustomValues }) {
  if (value.samplingSiteId) {
    const site = await get<SamplingSite>("samplingSites", value.samplingSiteId);
    if (!value.projectId || site?.projectId !== value.projectId)
      throw new Error("O ponto ou parcela deve pertencer ao projeto selecionado.");
  }
  const project = value.projectId ? await get<Project>("projects", value.projectId) : undefined;
  validateCustomValues(project?.fieldDefinitions || [], value.customValues || {});
}
export async function validateDefinitionChanges(project: Project, next: FieldDefinition[]) {
  const observations = (await list<Observation>("observations")).filter(o => o.projectId === project.id);
  for (const field of project.fieldDefinitions || []) {
    const used = observations.some(o => o.customValues?.[field.id] !== undefined);
    if (!used) continue;
    const updated = next.find(f => f.id === field.id);
    if (!updated) throw new Error(`O campo ${field.label} já possui dados. Desative-o em vez de removê-lo.`);
    if (updated.type !== field.type) throw new Error(`Não é possível mudar o tipo de ${field.label}: há registros preenchidos.`);
    for (const observation of observations) {
      const value = observation.customValues?.[field.id];
      if (value !== undefined) validateCustomValues([updated], { [field.id]: value }, false);
    }
  }
}
export async function saveSite(input: unknown, id?: string) {
  return transaction(async () => {
    const value = siteInputSchema.parse(input);
    if (!await get<Project>("projects", value.projectId)) throw new Error("Projeto não encontrado.");
    const current = id ? await get<SamplingSite>("samplingSites", id) : undefined;
    if (id && !current) throw new Error("Ponto ou parcela não encontrado.");
    if (current && current.projectId !== value.projectId) throw new Error("O ponto ou parcela não pode mudar de projeto.");
    const now = new Date().toISOString();
    const record = siteSchema.parse({ ...value, id: id || randomUUID(),
      kind: ({ Point: "point", LineString: "line", Polygon: "polygon" } as const)[value.geometry.type],
      createdAt: current?.createdAt || now, updatedAt: now });
    await put("samplingSites", record);
    return record;
  });
}
export async function importSites(projectId: string, input: unknown) {
  const geo = geoJSONImportSchema.parse(input);
  const features = geo.type === "FeatureCollection" ? geo.features : geo.type === "Feature" ? [geo] : [{ geometry: geo, properties: null }];
  return transaction(async () => {
    const sites: SamplingSite[] = [];
    for (const [index, feature] of features.entries()) {
      const properties = feature.properties || {};
      const name = [properties.name, properties.nome, properties.title].find(v => typeof v === "string" && v.trim());
      sites.push(await saveSite({ projectId, geometry: feature.geometry,
        name: typeof name === "string" ? name.slice(0,250) : `Amostragem ${index + 1}`,
        notes: typeof properties.notes === "string" ? properties.notes.slice(0,30000) : "" }));
    }
    return { sites, count: sites.length };
  });
}
