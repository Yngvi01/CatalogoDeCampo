import { test } from "node:test";
import assert from "node:assert/strict";
import type { Catalog, Compound, Evidence, Species } from "../lib/validation/schemas";
import { discoverEvidenceRelations, type DiscoveryFilters } from "../features/research/evidence-discovery";
import { curatedExamples } from "../features/research/curated-examples";

const species = (id: string, scientificName: string): Species => ({
  id, scientificName, acceptedName: "", commonNames: [], synonyms: [], group: "plant", genus: "", family: "",
  taxonomy: {}, description: "", diagnostics: "", distribution: "", habitat: "", toxicity: "",
  traditionalUses: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z",
});
const compound: Compound = {
  id: "caffeine", name: "caffeine", synonyms: [], chemicalClass: "Alcaloide", formula: "", description: "",
  mechanisms: "", targets: "", effects: "", toxicology: "", createdAt: "2026-01-01T00:00:00.000Z",
  effectClaims: [
    { id: "human", kind: "stimulant", context: "isolated_compound", type: "human", claim: "Efeito estudado em humanos.", source: "Estudo A", url: "https://example.org/a", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "animal", kind: "sedative", context: "extract", type: "animal", claim: "Extrato estudado em animais.", source: "Estudo B", url: "https://example.org/b", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
};
const occurrence = (id: string, speciesId: string, origin: Evidence["origin"], url: string): Evidence => ({
  id, speciesId, compoundId: compound.id, property: "", claim: "Composto relatado nesta espécie.", type: "publication",
  origin, source: "Fonte botânica", url, part: "", concentration: "", unit: "", range: "", method: "",
  sampleOrigin: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z",
});
const catalog = {
  species: [species("mate", "Ilex paraguariensis"), species("tea", "Camellia sinensis")],
  compounds: [compound],
  evidence: [occurrence("reviewed", "mate", "publication", "https://example.org/mate"),
    occurrence("unreviewed", "tea", "personal", "https://example.org/tea")],
} as Catalog;
const filters: DiscoveryFilters = { query: "", effect: "all", context: "all", studyType: "all", onlyRs: false, onlySourced: false };

test("busca cruzada separa ocorrência revisada de anotação pessoal e respeita contexto do estudo", () => {
  const all = discoverEvidenceRelations(catalog, filters);
  assert.equal(all.length, 2);
  assert.equal(all[0].species.scientificName, "Ilex paraguariensis");
  assert.equal(all[0].hasBothSources, true);
  assert.equal(all[1].hasBothSources, false);
  assert.equal(all[1].sourcedOccurrence, undefined);

  const human = discoverEvidenceRelations(catalog, { ...filters, effect: "stimulant", context: "isolated_compound", studyType: "human", onlyRs: true, onlySourced: true });
  assert.equal(human.length, 1);
  assert.deepEqual(human[0].claims.map(claim => claim.id), ["human"]);
  assert.equal(discoverEvidenceRelations(catalog, { ...filters, effect: "sedative", studyType: "human" }).length, 0);
  assert.equal(discoverEvidenceRelations(catalog, { ...filters, onlyRs: true }).length, 1);
  assert.equal(discoverEvidenceRelations(catalog, { ...filters, onlySourced: true }).length, 1);
  assert.equal(discoverEvidenceRelations(catalog, { ...filters, query: "Ilex" }).length, 1);
});

test("exemplos distinguem fungo, lacunas e a identificação taxonômica de Ipomoea", () => {
  const all = discoverEvidenceRelations(curatedExamples, filters);
  assert.equal(all.length, 4);
  assert.equal(all.find(item => item.species.scientificName === "Amanita muscaria")?.species.group, "fungus");
  assert.equal(all.find(item => item.compound.id === "example-galactomannan")?.hasBothSources, false);
  assert.equal(all.some(item => item.species.scientificName === "Ipomoea violacea"), false);
  assert.equal(curatedExamples.species.find(item => item.scientificName === "Ipomoea violacea")?.notes.includes("I. tricolor"), true);
  assert.deepEqual(discoverEvidenceRelations(curatedExamples, { ...filters, effect: "sedative" }).map(item => item.species.scientificName), ["Amanita muscaria"]);
  assert.deepEqual(discoverEvidenceRelations(curatedExamples, { ...filters, effect: "psychedelic", studyType: "human" }).map(item => item.compound.id), ["example-dmt"]);
  assert.deepEqual(discoverEvidenceRelations(curatedExamples, { ...filters, onlyRs: true }).map(item => item.compound.id).sort(), ["example-dmt", "example-galactomannan"]);
});
