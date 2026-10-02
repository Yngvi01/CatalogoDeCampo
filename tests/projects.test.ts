import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, unzipSync } from "fflate";
import { NextRequest } from "next/server";
const temp = mkdtempSync(path.join(tmpdir(), "campo-projects-"));
process.env.CAMPO_DATA_DIR = temp;
process.env.CAMPO_STORAGE = "local";
delete process.env.CAMPO_PASSWORD;
const setup = Promise.all([import("../features/projects/service"), import("../features/observations/service"), import("../features/backup/service"), import("../lib/db/repository"), import("../lib/server/api-handlers")]);
after(async () => { await (await import("../lib/db/local")).sqlite.close(); rmSync(temp, { recursive: true, force: true }); });

test("Projetos preservam o modo pessoal, validam campanhas e exportam recortes sem outros dados", async () => {
  const [projects, observations, backup, repo, api] = await setup;
  const p = await projects.saveProject({ name: "Inventário", startDate: "2026-10-01", members: ["Igor"], region: "Canela" });
  const other = await projects.saveProject({ name: "Outro cliente", startDate: "2026-10-01" });
  const c = await projects.saveCampaign({ projectId: p.id, name: "Primavera", date: "2026-10-02" });
  const otherCampaign = await projects.saveCampaign({ projectId: other.id, name: "Outro campo", date: "2026-10-02" });
  await assert.rejects(() => projects.saveProject({ name: "Inválido", startDate: "2026-10-03", endDate: "2026-10-01" }));
  await assert.rejects(() => projects.saveCampaign({ projectId: "missing", name: "Inválido", date: "2026-10-02" }));
  await assert.rejects(() => projects.validateFieldLinks({ projectId: p.id, campaignId: otherCampaign.id }), /pertencer/);
  await assert.rejects(() => projects.validateFieldLinks({ campaignId: c.id }), /pertencer/);
  await assert.rejects(() => projects.saveCampaign({ ...c, projectId: other.id }, c.id), /mudar/);
  const create = async (data: unknown) => { const f = new FormData(); f.set("data", JSON.stringify(data)); return (await observations.createObservation(f, { provider: "manual", candidates: [], queriedAt: new Date().toISOString() })).observation; };
  const personal = await create({ notes: "Pessoal" });
  const field = await create({ projectId: p.id, campaignId: c.id, region: "Canela", latitude: -29.3, longitude: -50.8, observedAt: "2026-10-02T12:00:00Z", notes: "=SUM(1,1)" });
  await create({ projectId: p.id, observedAt: "2026-10-01T12:00:00Z" });
  await create({ projectId: other.id, campaignId: otherCampaign.id });
  await assert.rejects(() => create({ projectId: p.id, campaignId: otherCampaign.id }), /pertencer/);
  const s = await observations.confirmIdentification(field.id, { scientificName: "Mimosa scabrella", status: "user_identified" });
  const subset = await projects.projectData(p.id, { campaignId: c.id, from: "2026-10-02", to: "2026-10-02", speciesId: s.id });
  assert.deepEqual(subset.observations.map(o => o.id), [field.id]);
  assert.equal(subset.projects.length, 1); assert.equal(subset.campaigns.length, 1); assert.equal(subset.species[0].id, s.id);
  const geo = projects.projectGeoJSON(subset);
  assert.deepEqual(geo.features[0].geometry.coordinates, [-50.8, -29.3]);
  assert.equal(geo.features[0].properties.species, "Mimosa scabrella");
  assert.equal(geo.features[0].properties.project, "Inventário");
  assert.match(await backup.csv("observations", subset), /'=SUM/);
  assert.equal(projects.projectGeoJSON(await projects.projectData(p.id)).features.length, 1);
  await assert.rejects(() => projects.projectData(p.id, { campaignId: otherCampaign.id }), /neste projeto/);
  const zip = await backup.backup(subset);
  assert.equal(unzipSync(zip)["database.sqlite"], undefined);
  assert.equal(backup.parseImport(zip).payload.data.observations.length, 1);
  const patch = (value: unknown) => api.PATCH(new NextRequest(`http://localhost/api/observations/${personal.id}`, { method: "PATCH", headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(value) }), { params: Promise.resolve({ path: ["observations", personal.id] }) });
  assert.equal((await patch({ projectId: p.id, campaignId: otherCampaign.id })).status, 400);
  assert.equal((await patch({ projectId: p.id, campaignId: c.id })).status, 200);
  assert.equal((await repo.get<typeof personal>("observations", personal.id))?.campaignId, c.id);
  assert.equal((await patch({ projectId: null, campaignId: null })).status, 200);
  const response = await api.GET(new NextRequest(`http://localhost/api/projects/${p.id}/export?format=geojson&campaignId=${c.id}`), { params: Promise.resolve({ path: ["projects", p.id, "export"] }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).features.length, 1);
});

test("Backup atual remapeia projetos e campanhas; formatos antigos continuam aceitos", async () => {
  const [, , backup, repo] = await setup;
  const archive = await backup.backup();
  const before = await repo.snapshot();
  const preview = await backup.previewImport(archive);
  await backup.importCatalog(archive, "new", preview.hash);
  const after = await repo.snapshot();
  assert.equal(after.projects.length, before.projects.length * 2);
  const newObservation = after.observations[before.observations.length + 1];
  assert.notEqual(newObservation.projectId, before.observations[1].projectId);
  assert.equal(after.campaigns.find(c => c.id === newObservation.campaignId)?.projectId, newObservation.projectId);
  await backup.importCatalog(archive, "restore", preview.hash);
  assert.deepEqual(await repo.snapshot(), before);
  const invalid = await backup.exportCatalog(); invalid.data.observations[1].campaignId = before.campaigns[1].id;
  assert.throws(() => backup.parseImport(strToU8(JSON.stringify(invalid))), /outro projeto/);
  const current = await backup.exportCatalog();
  const legacy = structuredClone(current) as unknown as { version: number; data: Record<string, unknown> };
  legacy.version = 2; delete legacy.data.projects; delete legacy.data.campaigns;
  (legacy.data.observations as Record<string,unknown>[]).forEach(o => { delete o.projectId; delete o.campaignId; });
  assert.deepEqual(backup.parseImport(strToU8(JSON.stringify(legacy))).payload.data.projects, []);
  legacy.version = 3;
  assert.throws(() => backup.parseImport(strToU8(JSON.stringify(legacy))));
});


test("A migration profissional preserva observações legadas e suas coordenadas", async () => {
  const { default: Database } = await import("better-sqlite3");
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  try {
    for (const file of readdirSync("lib/db/migrations").filter(f => /^000[0-5]_.*\.sql$/.test(f)).sort())
      database.exec(readFileSync(path.join("lib/db/migrations", file), "utf8"));
    const legacy = JSON.stringify({ id: "legacy", code: "CAMPO-000001", latitude: -29.3, longitude: -50.8 });
    database.prepare("INSERT INTO observations (id, code, species_id, data) VALUES (?, ?, ?, ?)").run("legacy", "CAMPO-000001", null, legacy);
    database.exec(readFileSync("lib/db/migrations/0006_field_projects.sql", "utf8"));
    const row = database.prepare("SELECT * FROM observations WHERE id = ?").get("legacy") as Record<string,unknown>;
    assert.equal(row.data, legacy); assert.equal(row.project_id, null); assert.equal(row.campaign_id, null);
    assert.equal((database.prepare("SELECT count(*) AS total FROM projects").get() as { total: number }).total, 0);
    database.exec(readFileSync("lib/db/migrations/0007_field_sampling.sql", "utf8"));
    const upgraded = database.prepare("SELECT * FROM observations WHERE id = ?").get("legacy") as Record<string, unknown>;
    assert.equal(upgraded.data, legacy); assert.equal(upgraded.sampling_site_id, null);
  } finally { database.close(); }
});
