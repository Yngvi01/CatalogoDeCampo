import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";

const temp = mkdtempSync(path.join(tmpdir(), "campo-notebook-"));
process.env.CAMPO_DATA_DIR = temp;
const setup = Promise.all([
  import("../features/notebook/service"),
  import("../features/backup/service"),
  import("../lib/db/repository"),
  import("../lib/db/local"),
]);
after(async () => {
  (await setup)[3].sqlite.close();
  rmSync(temp, { recursive: true, force: true });
});

test("Caderno preserva texto e etiquetas e impede sobrescrita por outra janela", async () => {
  const [notes, , repo] = await setup;
  await assert.rejects(
    async () => await notes.createNote({ title: " ", content: "Rascunho" }),
  );
  const created = await notes.createNote({
    title: "Árvore e percepção",
    content: "Uma primeira ideia.\n\nOutra pergunta.",
    tags: ["Filosofia", "filosófia", "campo"],
  });
  assert.deepEqual(created.tags, ["Filosofia", "campo"]);
  const edited = await notes.updateNote(created.id, {
    title: "Uma leitura do campo",
    expectedUpdatedAt: created.updatedAt,
  });
  assert.equal(edited.content, created.content);
  assert.deepEqual(edited.tags, created.tags);
  assert.notEqual(edited.updatedAt, created.updatedAt);
  await assert.rejects(
    async () =>
      await notes.updateNote(created.id, {
        content: "Texto desatualizado",
        expectedUpdatedAt: created.updatedAt,
      }),
    notes.NoteConflictError,
  );
  const archived = await notes.updateNote(created.id, {
    archived: true,
    expectedUpdatedAt: edited.updatedAt,
  });
  assert.deepEqual(archived.tags, created.tags);
  assert.equal(archived.content, created.content);
  const restored = await notes.updateNote(created.id, {
    archived: false,
    expectedUpdatedAt: archived.updatedAt,
  });
  assert.equal(restored.id, created.id);
  assert.deepEqual((await repo.snapshot()).notes, [restored]);
});

test("JSON e ZIP incluem páginas; mesclagem, duplicação e restauração preservam o caderno", async () => {
  const [notes, backup, repo] = await setup;
  const original = (await repo.snapshot()).notes[0];
  const json = await backup.exportCatalog();
  assert.equal(json.version, 4);
  assert.deepEqual(json.data.notes, [original]);
  const zip = await backup.backup();
  const preview = await backup.previewImport(zip);
  assert.equal(preview.counts.notes, 1);
  assert.equal(preview.existing.notes, 1);
  await backup.importCatalog(zip, "skip", preview.hash);
  assert.equal((await repo.snapshot()).notes.length, 1);
  await backup.importCatalog(zip, "new", preview.hash);
  assert.equal((await repo.snapshot()).notes.length, 2);
  assert.notEqual((await repo.snapshot()).notes[1].id, original.id);
  assert.equal((await repo.snapshot()).notes[1].content, original.content);
  await notes.updateNote(original.id, {
    content: "Alteração após o backup",
    expectedUpdatedAt: original.updatedAt,
  });
  const restored = await backup.importCatalog(zip, "restore", preview.hash);
  assert.deepEqual((await repo.snapshot()).notes, [original]);
  const recovery = backup.parseImport(
    readFileSync(path.join(temp, "backups", restored.recovery!)),
  );
  assert.equal(recovery.payload.data.notes.length, 2);
  assert.ok(
    recovery.payload.data.notes.some(
      (note) => note.content === "Alteração após o backup",
    ),
  );
  const change = await backup.exportCatalog();
  change.data.notes[0].content = "Importação revisada";
  const bytes = strToU8(JSON.stringify(change));
  await backup.importCatalog(
    bytes,
    "update",
    (await backup.previewImport(bytes)).hash,
  );
  assert.equal((await repo.snapshot()).notes[0].content, "Importação revisada");
});

test("Backups v1 continuam importáveis; v2 incompleto e versões divergentes são rejeitados", async () => {
  const [, backup, repo] = await setup;
  const current = await backup.exportCatalog();
  const { notes: omitted, ...oldData } = current.data;
  assert.equal(omitted.length, 1);
  const old = { ...current, version: 1, data: oldData };
  assert.deepEqual(
    backup.parseImport(strToU8(JSON.stringify(old))).payload.data.notes,
    [],
  );
  assert.throws(() =>
    backup.parseImport(strToU8(JSON.stringify({ ...current, data: oldData }))),
  );
  const files = unzipSync(await backup.backup());
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  manifest.version = 1;
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  assert.throws(() => backup.parseImport(zipSync(files)), /Versões/);
  files["export.json"] = strToU8(JSON.stringify(old));
  delete manifest.notes;
  manifest.checksums["export.json"] = createHash("sha256")
    .update(files["export.json"])
    .digest("hex");
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const legacyZip = zipSync(files);
  const preview = await backup.previewImport(legacyZip);
  assert.equal(preview.counts.notes, 0);
  await backup.importCatalog(legacyZip, "skip", preview.hash);
  assert.equal((await repo.snapshot()).notes.length, 1);
  const result = await backup.importCatalog(legacyZip, "restore", preview.hash);
  assert.equal((await repo.snapshot()).notes.length, 0);
  assert.equal(
    backup.parseImport(
      readFileSync(path.join(temp, "backups", result.recovery!)),
    ).payload.data.notes.length,
    1,
  );
});
