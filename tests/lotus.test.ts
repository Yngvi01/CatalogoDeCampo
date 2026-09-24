import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "campo-lotus-"));
process.env.CAMPO_DATA_DIR = dir;
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  (await import("../lib/db/local")).sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});

const data = { naturalProducts: [
  { lotus_id: "LTS0115831", traditional_name: "erythratidine", molecular_formula: "C19H23NO4",
    inchikey: "EXAMPLE-ONE", chemicalTaxonomyNPclassifierClass: "Indolizidine alkaloids",
    taxonomyReferenceObjects: {
      "10$x$x$1002/CBER$x$x$19520850621": { "GBIF Backbone Taxonomy": [
        { species: "Erythrina falcata", genus: "Erythrina", kingdom: "Plantae" },
      ] },
      "10$x$x$1021/NP50054A024": { "GBIF Backbone Taxonomy": [
        { species: "Erythrina variegata", genus: "Erythrina", kingdom: "Plantae" },
      ] },
    } },
  { lotus_id: "LTS0075508", traditional_name: "caffeine", molecular_formula: "C8H10N4O2",
    taxonomyReferenceObjects: {
      "10$x$x$1016/example": { "GBIF Backbone Taxonomy": [
        { species: "Ilex paraguariensis", genus: "Ilex", kingdom: "Plantae" },
        { species: "Cordyceps militaris", genus: "Cordyceps", kingdom: "Fungi" },
      ] },
    } },
] };

test("LOTUS separa espécie exata de outros membros do gênero e preserva a referência", async () => {
  const { parseLotus } = await import("../lib/providers/lotus");
  const exact = parseLotus(data, "plant", "Erythrina falcata");
  assert.equal(exact.hits.length, 1);
  assert.equal(exact.hits[0].taxa.length, 1);
  assert.equal(exact.hits[0].taxa[0].name, "Erythrina falcata");
  assert.equal(exact.hits[0].taxa[0].references[0].url, "https://doi.org/10.1002%2FCBER.19520850621");
  const genus = parseLotus(data, "plant", "Erythrina spp.");
  assert.equal(genus.hits[0].taxa.length, 2);
  assert.equal(parseLotus(data, "plant", "Passiflora alata").hits.length, 0);
});

test("busca por composto retorna apenas táxons vegetais e não acrescenta efeitos", async () => {
  const { parseLotus } = await import("../lib/providers/lotus");
  const result = parseLotus({ naturalProducts: [data.naturalProducts[1]] }, "compound", "caffeine");
  assert.equal(result.hits.length, 1);
  assert.deepEqual(result.hits[0].taxa.map(taxon => taxon.name), ["Ilex paraguariensis"]);
  assert.equal(result.hits[0].chemicalClass, "");
  assert.equal("effects" in result.hits[0], false);
  assert.throws(() => parseLotus({}, "plant", "Ilex paraguariensis"), /resposta inesperada/);
});

test("consultas LOTUS repetidas reutilizam o cache sem guardar a resposta extensa", async () => {
  const { searchLotus } = await import("../lib/providers/lotus");
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    assert.match(String(url), /query=Erythrina%20falcata/);
    return Response.json(data);
  };
  const first = await searchLotus("plant", "Erythrina falcata");
  const second = await searchLotus("plant", "Erythrina falcata");
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  assert.equal(first.hits.length, 1);
});
