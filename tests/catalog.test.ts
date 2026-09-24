import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { zipSync, unzipSync, strToU8 } from "fflate";
const temp = mkdtempSync(path.join(tmpdir(), "campo-test-"));
process.env.CAMPO_DATA_DIR = temp;
const setup = Promise.all([
  import("../features/observations/service"),
  import("../features/backup/service"),
  import("../lib/db/repository"),
  import("../lib/db"),
]);
after(async () => {
  const [, , , { sqlite }] = await setup;
  sqlite.close();
  rmSync(temp, { recursive: true, force: true });
});
async function photoForm() {
  const buffer = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#829954" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const form = new FormData();
  form.set(
    "data",
    JSON.stringify({
      group: "plant",
      region: "São Paulo",
      habitat: "Floresta",
      latitude: -23.5,
      longitude: -46.6,
    }),
  );
  form.append(
    "photos",
    new File([new Uint8Array(buffer)], "planta.jpg", { type: "image/jpeg" }),
  );
  return form;
}
test("Fluxo completo: fotos, identificação, histórico, backup portátil e restauração", async () => {
  const [service, backup, repo, { sqlite }] = await setup;
  await assert.rejects(
    () => service.createObservation(new FormData()),
    /Selecione/,
  );
  const first = await service.createObservation(await photoForm());
  assert.equal(first.observation.code, "CAMPO-000001");
  assert.equal(first.observation.status, "unidentified");
  const second = await service.createObservation(await photoForm());
  assert.equal(second.observation.code, "CAMPO-000002");
  assert.equal(second.duplicates.length, 1);
  const data = repo.snapshot();
  const photo = data.images[0];
  assert.ok(existsSync(path.join(temp, "images", photo.original)));
  const info = await sharp(
    readFileSync(path.join(temp, "images", photo.optimized)),
  ).metadata();
  assert.equal(info.orientation, undefined);
  assert.equal(info.exif, undefined);
  assert.equal(info.width, 80);
  assert.equal(info.height, 120);
  const species = service.confirmIdentification(first.observation.id, {
    scientificName: "Passiflora edulis",
    status: "probable",
    note: "Hipótese inicial",
  });
  service.confirmIdentification(first.observation.id, {
    scientificName: "Passiflora edulis",
    status: "user_identified",
    note: "Características revisadas",
  });
  assert.equal(repo.snapshot().species.length, 1);
  assert.equal(repo.snapshot().history.length, 2);
  assert.equal(repo.snapshot().observations[0].speciesId, species.id);
  assert.throws(
    () =>
      service.confirmIdentification(first.observation.id, {
        scientificName: "Passiflora edulis",
        status: "externally_confirmed",
      }),
    /fonte/,
  );
  const archive = backup.backup();
  const parsed = backup.parseImport(archive);
  assert.equal(parsed.payload.data.observations.length, 2);
  const entries = unzipSync(archive);
  assert.ok(entries["database.sqlite"]);
  assert.ok(entries["manifest.json"]);
  assert.ok(!Object.keys(entries).some((k) => k.includes(".env")));
  const preview = backup.previewImport(archive);
  assert.equal(preview.existing.observations, 2);
  backup.importCatalog(archive, "skip", preview.hash);
  assert.equal(repo.snapshot().observations.length, 2);
  backup.importCatalog(archive, "new", preview.hash);
  let next = repo.snapshot();
  assert.equal(next.observations.length, 4);
  assert.equal(next.species.length, 2);
  assert.equal(next.images.length, 4);
  assert.equal(next.observations[2].code, "CAMPO-000003");
  assert.equal(next.observations[2].speciesId, next.species[1].id);
  assert.notEqual(next.images[2].original, photo.original);
  const restored = backup.importCatalog(archive, "restore", preview.hash);
  assert.ok(restored.recovery);
  assert.ok(existsSync(path.join(temp, "backups", restored.recovery!)));
  assert.deepEqual(repo.snapshot(), parsed.payload.data);
  assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  // A alteração de dados preserva um backup anterior e mantém relações.
  const update = backup.exportCatalog();
  update.data.species[0].notes = "Atualizado";
  const bytes = strToU8(JSON.stringify(update));
  const updatePreview = backup.previewImport(bytes);
  backup.importCatalog(bytes, "update", updatePreview.hash);
  assert.equal(repo.snapshot().species[0].notes, "Atualizado");
  assert.throws(
    () => backup.importCatalog(bytes, "skip", "incorrect"),
    /mudou/,
  );
});
test("Importação rejeita corrupção, path traversal, relações órfãs, versões e URLs perigosas", async () => {
  const [, b] = await setup;
  const zip = b.backup(),
    files = unzipSync(zip);
  files["export.json"] = strToU8("{}");
  assert.throws(() => b.parseImport(zipSync(files)), /Checksum/);
  assert.throws(
    () => b.parseImport(zipSync({ "../escape": strToU8("x") })),
    /caminho/,
  );
  const invalid = b.exportCatalog();
  invalid.data.observations[0].speciesId = "missing";
  assert.throws(
    () => b.parseImport(strToU8(JSON.stringify(invalid))),
    /inexistente/,
  );
  assert.throws(() =>
    b.parseImport(
      strToU8(JSON.stringify({ ...b.exportCatalog(), version: 99 })),
    ),
  );
  const bad = b.exportCatalog();
  bad.data.discoveries.push({
    id: "unsafe",
    speciesId: bad.data.species[0].id,
    title: "Bad URL",
    authors: "",
    year: "",
    doi: "",
    url: "javascript:alert(1)",
    abstract: "",
    query: "",
    source: "x",
    status: "new",
    createdAt: new Date().toISOString(),
  });
  assert.throws(() => b.parseImport(strToU8(JSON.stringify(bad))), /HTTP/);
});
test("CSV neutraliza fórmulas e a busca normaliza acentos", async () => {
  const [service, b, repo] = await setup;
  const { normalize } = await import("../lib/utils");
  assert.equal(normalize("ÁRVORE de São Paulo"), "arvore de sao paulo");
  service.updateSpecies(repo.snapshot().species[0].id, { notes: "=SUM(1,1)" });
  assert.match(b.csv("species"), /"'=SUM\(1,1\)"/);
});
test("Autenticação exige assinatura e CSRF exige mesma origem", async () => {
  const { validToken, token, sameOrigin } = await import("../lib/auth");
  process.env.CAMPO_PASSWORD = "test-password-long";
  assert.equal(validToken(undefined), false);
  assert.equal(validToken(token()), true);
  assert.equal(validToken(`${Date.now() + 100000}.` + "0".repeat(64)), false);
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api", {
        headers: {
          host: "localhost:3000",
          origin: "https://malicious.example",
        },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
    true,
  );
  delete process.env.CAMPO_PASSWORD;
});
