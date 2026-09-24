import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
const temp = mkdtempSync(path.join(tmpdir(), "campo-providers-"));
process.env.CAMPO_DATA_DIR = temp;
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  (await import("../lib/db/local")).sqlite.close();
  rmSync(temp, { recursive: true, force: true });
  delete process.env.PLANTNET_API_KEY;
  delete process.env.SPECIESLINK_API_KEY;
});
test("Pl@ntNet: cache, fotos sem EXIF, candidatos permanentes e confirmação manual", async () => {
  const { createObservation } =
    await import("../features/observations/service");
  const { identify } = await import("../features/identification/service");
  const { snapshot } = await import("../lib/db/repository");
  const { plantnet } = await import("../lib/providers/plantnet");
  const f = new FormData();
  f.set("data", "{}");
  f.append(
    "photos",
    new File(
      [
        new Uint8Array(
          await sharp({
            create: {
              width: 30,
              height: 20,
              channels: 3,
              background: "#819853",
            },
          })
            .jpeg()
            .withMetadata()
            .toBuffer(),
        ),
      ],
      "leaf.jpg",
    ),
  );
  const { observation } = await createObservation(f);
  await assert.rejects(() => identify(observation.id), /PLANTNET_API_KEY/);
  process.env.PLANTNET_API_KEY = "mock-secret-plantnet";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const form = options!.body as FormData;
    const file = (await form.get("images")) as File;
    assert.equal(
      (await sharp(Buffer.from(await file.arrayBuffer())).metadata()).exif,
      undefined,
    );
    return Response.json({
      api_key: "mock-secret-plantnet",
      query: { private: "mock-secret-plantnet" },
      results: [
        {
          score: 0.81,
          species: {
            scientificNameWithoutAuthor: "Passiflora edulis",
            family: { scientificNameWithoutAuthor: "Passifloraceae" },
            genus: { scientificNameWithoutAuthor: "Passiflora" },
            commonNames: ["Maracujá"],
          },
        },
      ],
    });
  };
  const result = await identify(observation.id);
  assert.equal(result.candidates[0].score, 0.81);
  assert.equal((await snapshot()).observations[0].status, "candidates");
  assert.equal((await snapshot()).species.length, 0);
  assert.equal((await snapshot()).identifications.length, 1);
  assert.ok(!JSON.stringify(await snapshot()).includes("mock-secret-plantnet"));
  await identify(observation.id);
  assert.equal(calls, 1);
  await identify(observation.id, true);
  assert.equal(calls, 2);
  await assert.rejects(
    () => plantnet.identify({ ...observation, group: "fungus" }, []),
    /somente para plantas/,
  );
  globalThis.fetch = originalFetch;
});
test("Fungos usam contexto geográfico, sem score visual; speciesLink não expõe credenciais", async () => {
  const { fungi, specieslink } = await import("../lib/providers/biodiversity");
  const { snapshot } = await import("../lib/db/repository");
  const observation = {
    ...(await snapshot()).observations[0],
    group: "fungus" as const,
    latitude: -23.5,
    longitude: -46.6,
  };
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes("iconic_taxa=Fungi"));
    return Response.json({
      results: [
        { count: 4, taxon: { name: "Schizophyllum commune", rank: "species" } },
      ],
    });
  };
  const r = await fungi.identify(observation, []);
  assert.equal(r.candidates[0].scientificName, "Schizophyllum commune");
  assert.equal(r.candidates[0].score, null);
  assert.match(JSON.stringify(r.raw), /iNaturalist/);
  assert.equal(
    (await specieslink.occurrences("Passiflora edulis", observation)).status,
    "manual",
  );
  process.env.SPECIESLINK_API_KEY = "mock-secret-specieslink";
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes("apikey=mock-secret-specieslink"));
    return Response.json({ numberMatched: 3, features: [] });
  };
  const records = await specieslink.occurrences(
    "Passiflora edulis",
    observation,
  );
  assert.ok(!JSON.stringify(records).includes("mock-secret-specieslink"));
  assert.equal((records.data as { count: number }).count, 3);
  globalThis.fetch = originalFetch;
});
test("Descobertas são deduplicadas e exigem incorporação explícita", async () => {
  const { confirmIdentification } =
    await import("../features/observations/service");
  const { investigate, incorporate } =
    await import("../features/research/service");
  const { snapshot } = await import("../lib/db/repository");
  const species = await confirmIdentification(
    (await snapshot()).observations[0].id,
    {
      scientificName: "Passiflora edulis",
      status: "probable",
    },
  );
  globalThis.fetch = async () =>
    Response.json({
      resultList: {
        result: [
          {
            id: "12345",
            source: "MED",
            title: "Chemical composition of Passiflora edulis",
            authorString: "Example et al.",
            pubYear: "2024",
            doi: "10.1234/example",
            abstractText: "<p>Laboratory analysis.</p>",
          },
        ],
      },
    });
  await investigate(species.id);
  await investigate(species.id);
  assert.equal((await snapshot()).discoveries.length, 1);
  assert.equal((await snapshot()).research.length, 2);
  assert.equal((await snapshot()).evidence.length, 0);
  assert.equal((await snapshot()).species[0].description, "");
  const d = (await snapshot()).discoveries[0];
  await incorporate(d.id, {
    property: "chemical composition",
    claim: "Artigo a revisar; amostra específica.",
    type: "in_vitro",
    compoundId: null,
    part: "folha",
    concentration: "",
    unit: "",
    range: "",
    method: "",
    sampleOrigin: "",
    notes: "",
  });
  assert.equal((await snapshot()).discoveries[0].status, "incorporated");
  assert.equal((await snapshot()).evidence.length, 1);
  globalThis.fetch = originalFetch;
});
