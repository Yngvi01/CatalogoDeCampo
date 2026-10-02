import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { strToU8 } from "fflate";
import { geometrySchema, validateCustomValues } from "../lib/validation/field";
const temp = mkdtempSync(path.join(tmpdir(), "campo-field-"));
process.env.CAMPO_DATA_DIR = temp; process.env.CAMPO_STORAGE = "local";
const setup = Promise.all([import("../features/projects/service"), import("../features/projects/field-service"), import("../features/observations/quick-service"), import("../features/backup/service"), import("../lib/db/repository")]);
after(async () => { (await import("../lib/db/local")).sqlite.close(); rmSync(temp, { recursive: true, force: true }); });
const definitions = [
  { id: "dap", label: "DAP", type: "number" as const, required: true, archived: false, unit: "cm", options: [] },
  { id: "phenology", label: "Fenologia", type: "multi_select" as const, required: false, archived: false, unit: "", options: ["Flor","Fruto"] },
  { id: "adult", label: "Adulto", type: "boolean" as const, required: true, archived: false, unit: "", options: [] },
];
const polygon = { type: "Polygon", coordinates: [[[-50,-29],[-50.1,-29],[-50.1,-29.1],[-50,-29]]] };
async function capture(data: unknown, clientId = randomUUID(), scientificName = "", photo = false) {
  const form = new FormData(); form.set("data", JSON.stringify({ clientId, data, scientificName }));
  if (photo) { const bytes = await sharp({ create: { width: 30, height: 40, channels: 3, background: "#689944" } }).png().toBuffer(); form.append("photos", new File([new Uint8Array(bytes)], "leaf.png", { type: "image/png" })); }
  return form;
}

test("Geometrias e formulários rejeitam coordenadas inválidas, tipos errados e escolhas ausentes", () => {
  assert.ok(geometrySchema.safeParse(polygon).success);
  assert.ok(geometrySchema.safeParse({ type: "LineString", coordinates: [[-50,-29],[-50.1,-29.1]] }).success);
  assert.equal(geometrySchema.safeParse({ type: "Point", coordinates: [200,90] }).success, false);
  assert.equal(geometrySchema.safeParse({ type: "Point", coordinates: [-50,NaN] }).success, false);
  assert.equal(geometrySchema.safeParse({ type: "Polygon", coordinates: [[[-50,-29],[-50.1,-29],[-50.1,-29.1],[-49,-29]]] }).success, false);
  assert.equal(geometrySchema.safeParse({ type: "GeometryCollection", geometries: [] }).success, false);
  assert.throws(() => validateCustomValues(definitions,{ dap: "32", adult: false }), /DAP/);
  assert.throws(() => validateCustomValues(definitions,{ dap: 32, adult: false, phenology: ["Outro"] }), /Fenologia/);
  assert.throws(() => validateCustomValues(definitions,{ dap: 32 }), /Adulto/);
  assert.throws(() => validateCustomValues(definitions,{ dap: 32, adult: false, unknown: 1 }), /não pertence/);
  assert.doesNotThrow(() => validateCustomValues(definitions,{ dap: 0, adult: false, phenology: ["Flor"] }));
});

test("GeoJSON é importado atomicamente e observações só aceitam locais do próprio projeto", async () => {
  const [projects, field, quick, , repo] = await setup;
  const project = await projects.saveProject({ name: "Flora", startDate: "2026-10-02", fieldDefinitions: definitions });
  const other = await projects.saveProject({ name: "Outro", startDate: "2026-10-02" });
  const imported = await field.importSites(project.id, { type: "FeatureCollection", features: [
    { type: "Feature", geometry: polygon, properties: { name: "Parcela 1" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-50,-29] }, properties: { name: "Ponto 1" } },
  ] });
  assert.equal(imported.count, 2); assert.equal(imported.sites[0].kind,"polygon");
  await assert.rejects(() => field.importSites(project.id, { type: "FeatureCollection", features: [
    { type: "Feature", geometry: polygon, properties: null }, { type: "Feature", geometry: { type: "Point", coordinates: [-500,0] } },
  ] }));
  assert.equal((await repo.snapshot()).samplingSites.length,2);
  await assert.rejects(async () => quick.createQuickObservation(await capture({ projectId: other.id, samplingSiteId: imported.sites[0].id })), /pertencer/);
  await assert.rejects(async () => quick.createQuickObservation(await capture({ projectId: project.id })), /DAP/);
  const recorded = await quick.createQuickObservation(await capture({ projectId: project.id, samplingSiteId: imported.sites[0].id,
    latitude: -29, longitude: -50, customValues: { dap: 32.4, adult: false, phenology: ["Flor"] } }));
  assert.equal(recorded.observation.samplingSiteId, imported.sites[0].id);
  await assert.rejects(() => projects.saveProject({ ...project, fieldDefinitions: definitions.slice(1) },project.id), /Desative/);
  await assert.rejects(() => projects.saveProject({ ...project, fieldDefinitions: definitions.map(f => f.id === "dap" ? { ...f, type: "text" } : f) },project.id), /mudar o tipo/);
  await assert.rejects(() => projects.saveProject({ ...project, fieldDefinitions: definitions.map(f => f.id === "phenology" ? { ...f, options: ["Fruto"] } : f) },project.id), /Fenologia/);
  await projects.saveProject({ ...project, fieldDefinitions: definitions.map(f => ({ ...f, archived: true })) },project.id);
  assert.equal((await repo.snapshot()).observations[0].customValues?.dap,32.4);
  const data = await projects.projectData(project.id, { samplingSiteId: imported.sites[0].id });
  assert.equal(data.samplingSites.length,1); assert.equal(data.observations.length,1);
  assert.equal(projects.projectGeoJSON(data).features.length,2);
});

test("Coleta rápida confirma identificação manual, deduplica reenvios concorrentes e reverte fotos em falhas", async () => {
  const [, , quick, , repo] = await setup;
  const id = randomUUID();
  const [a,b] = await Promise.all([quick.createQuickObservation(await capture({ region: "Trilha" },id,"Mimosa scabrella",true)), quick.createQuickObservation(await capture({ region: "Trilha" },id,"Mimosa scabrella",true))]);
  assert.equal(a.observation.id,b.observation.id); assert.equal([a.replayed,b.replayed].filter(Boolean).length,1);
  assert.equal((await repo.snapshot()).observations.filter(o => o.id === id).length,1);
  assert.equal((await repo.snapshot()).images.filter(p => p.observationId === id).length,1);
  assert.equal(a.observation.status,"user_identified");
  const filesBefore = readdirSync(path.join(temp,"images")).sort();
  const failedId = randomUUID();
  await assert.rejects(async () => quick.createQuickObservation(await capture({ group: "fungus" },failedId,"Mimosa scabrella",true)), /outro grupo/);
  assert.equal((await repo.snapshot()).observations.some(o => o.id === failedId),false);
  assert.deepEqual(readdirSync(path.join(temp,"images")).sort(),filesBefore);
});

test("Backup 4 preserva geometrias e campos extras ao duplicar/restaurar e lê formatos anteriores", async () => {
  const [, , , backup, repo] = await setup;
  const original = await repo.snapshot(), archive = await backup.backup(), preview = await backup.previewImport(archive);
  assert.equal(backup.parseImport(archive).payload.version,4);
  await backup.importCatalog(archive,"new",preview.hash);
  const next = await repo.snapshot(), duplicate = next.observations[original.observations.length];
  assert.notEqual(duplicate.samplingSiteId,original.observations[0].samplingSiteId);
  assert.equal(next.samplingSites.find(s => s.id === duplicate.samplingSiteId)?.projectId,duplicate.projectId);
  assert.deepEqual(duplicate.customValues,original.observations[0].customValues);
  await backup.importCatalog(archive,"restore",preview.hash);
  assert.deepEqual(await repo.snapshot(),original);
  const exported = await backup.exportCatalog();
  const legacy = JSON.parse(JSON.stringify(exported)); legacy.version = 3; delete legacy.data.samplingSites;
  legacy.data.projects.forEach((p: Record<string,unknown>) => { delete p.fieldDefinitions; });
  legacy.data.observations.forEach((o: Record<string,unknown>) => { delete o.samplingSiteId; delete o.customValues; });
  assert.deepEqual(backup.parseImport(strToU8(JSON.stringify(legacy))).payload.data.samplingSites,[]);
  legacy.version = 4; assert.throws(() => backup.parseImport(strToU8(JSON.stringify(legacy))));
});
