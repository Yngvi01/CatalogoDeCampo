import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
const dir = mkdtempSync(path.join(tmpdir(), "campo-preview-"));
process.env.CAMPO_DATA_DIR = dir;
process.env.PLANTNET_API_KEY = "preview-test-key";
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  (await import("../lib/db/local")).sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});
test("Identifica sem persistir fotos; só guarda a seleção explícita, inclusive nenhuma", async () => {
  const { previewIdentification, saveIdentifiedObservation, readReceipt } =
    await import("../features/identification/preview");
  const { snapshot } = await import("../lib/db/repository");
  const { sqlite } = await import("../lib/db/local");
  const files: File[] = [];
  for (const color of ["#718652", "#996854"]) {
    const bytes = await sharp({
      create: { width: 100, height: 80, channels: 3, background: color },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    files.push(
      new File([new Uint8Array(bytes)], `${files.length}.jpg`, {
        type: "image/jpeg",
      }),
    );
  }
  const hashes = await Promise.all(
    files.map(async (f) =>
      createHash("sha256")
        .update(Buffer.from(await f.arrayBuffer()))
        .digest("hex"),
    ),
  );
  const before = await snapshot();
  const form = new FormData();
  form.set(
    "data",
    JSON.stringify({ group: "plant", notes: "Consulta sem salvar" }),
  );
  form.set("hashes", JSON.stringify(hashes));
  files.forEach((f) => form.append("photos", f));
  globalThis.fetch = async (_url, options) => {
    const images = (options!.body as FormData).getAll("images") as File[];
    assert.equal(images.length, 2);
    for (const image of images)
      assert.equal(
        (await sharp(Buffer.from(await image.arrayBuffer())).metadata()).exif,
        undefined,
      );
    return Response.json({
      results: [
        {
          score: 0.85,
          species: { scientificNameWithoutAuthor: "Passiflora edulis" },
        },
      ],
    });
  };
  const preview = await previewIdentification(form);
  assert.equal(preview.candidates[0].scientificName, "Passiflora edulis");
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(readdirSync(path.join(dir, "images")), []);
  assert.equal(
    (sqlite.prepare("select count(*) as n from cache").get() as { n: number })
      .n,
    0,
  );
  assert.throws(() => readReceipt(preview.receipt + "tampered"));
  const selection = new FormData();
  selection.append("photos", files[1]);
  const saved = await saveIdentifiedObservation(selection, preview.receipt);
  const data = await snapshot();
  assert.equal(data.images.length, 1);
  assert.equal(data.images[0].hash, hashes[1]);
  assert.equal(data.identifications[0].imageIds.length, 1);
  assert.equal(saved.observation.status, "candidates");
  const without = await saveIdentifiedObservation(
    new FormData(),
    preview.receipt,
  );
  const next = await snapshot();
  assert.equal(next.images.length, 1);
  assert.deepEqual(
    next.identifications.find((i) => i.observationId === without.observation.id)
      ?.imageIds,
    [],
  );
  const invalid = new FormData();
  invalid.append("photos", new File(["different"], "other.jpg"));
  await assert.rejects(
    saveIdentifiedObservation(invalid, preview.receipt),
    /apenas fotos/,
  );
  globalThis.fetch = async () => {
    throw new Error("provider unavailable");
  };
  await assert.rejects(previewIdentification(form), /provider unavailable/);
  assert.deepEqual(await snapshot(), next);
});
