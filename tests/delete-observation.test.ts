import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const dir = mkdtempSync(path.join(tmpdir(), "campo-delete-"));
process.env.CAMPO_DATA_DIR = dir;
after(async () => {
  (await import("../lib/db/local")).sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});
async function form() {
  const data = new FormData();
  data.set("data", "{}");
  const bytes = await sharp({
    create: { width: 40, height: 50, channels: 3, background: "#798a51" },
  })
    .jpeg()
    .toBuffer();
  data.append(
    "photos",
    new File([new Uint8Array(bytes)], "leaf.jpg", { type: "image/jpeg" }),
  );
  return data;
}
test("Exclusão remove registro e dependências, preservando espécie, outros registros e arquivos compartilhados", async () => {
  const service = await import("../features/observations/service");
  const repo = await import("../lib/db/repository");
  const { deleteObservation } = await import("../features/observations/delete");
  const first = await service.createObservation(await form());
  const second = await service.createObservation(await form());
  const species = await service.confirmIdentification(first.observation.id, {
    scientificName: "Passiflora edulis",
    status: "probable",
  });
  await service.confirmIdentification(second.observation.id, {
    scientificName: "Passiflora edulis",
    status: "probable",
  });
  const photo = (await service.observationDetail(first.observation.id))
    .photos[0];
  await repo.put("images", {
    ...photo,
    id: randomUUID(),
    observationId: second.observation.id,
  });
  await repo.put("identifications", {
    id: randomUUID(),
    observationId: first.observation.id,
    provider: "test",
    candidates: [],
    imageIds: [photo.id],
    raw: {},
    queriedAt: new Date().toISOString(),
    selectedName: null,
  });
  assert.equal((await deleteObservation(first.observation.id)).pendingFiles, 0);
  const snapshot = await repo.snapshot();
  assert.equal(snapshot.observations.length, 1);
  assert.equal(snapshot.observations[0].id, second.observation.id);
  assert.equal(snapshot.species[0].id, species.id);
  assert.equal(snapshot.identifications.length, 0);
  assert.ok(
    snapshot.history.every((h) => h.observationId === second.observation.id),
  );
  assert.ok(existsSync(path.join(dir, "images", photo.original)));
  await deleteObservation(second.observation.id);
  assert.equal(existsSync(path.join(dir, "images", photo.original)), false);
  assert.equal((await repo.snapshot()).species.length, 1);
  assert.equal((await deleteObservation(first.observation.id)).ok, true);
});
test("Falha no armazenamento deixa limpeza persistente para nova tentativa", async () => {
  const service = await import("../features/observations/service");
  const { deleteObservation, cleanupDeletedPhotos } =
    await import("../features/observations/delete");
  const { get } = await import("../lib/db/repository");
  const { sqlite } = await import("../lib/db/local");
  const saved = await service.createObservation(await form());
  const photo = (await service.observationDetail(saved.observation.id))
    .photos[0];
  const original = path.join(dir, "images", photo.original);
  unlinkSync(original);
  mkdirSync(original);
  assert.equal((await deleteObservation(saved.observation.id)).pendingFiles, 1);
  assert.equal(await get("observations", saved.observation.id), undefined);
  assert.equal(
    (
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM cache WHERE provider='photo-deletion'",
        )
        .get() as { n: number }
    ).n,
    1,
  );
  rmSync(original, { recursive: true });
  assert.equal(await cleanupDeletedPhotos(), 0);
  assert.equal(
    (
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM cache WHERE provider='photo-deletion'",
        )
        .get() as { n: number }
    ).n,
    0,
  );
});
