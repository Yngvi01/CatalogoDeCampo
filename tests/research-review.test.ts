import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const temp = mkdtempSync(path.join(tmpdir(), "campo-research-review-"));
process.env.CAMPO_DATA_DIR = temp;
const setup = Promise.all([
  import("../features/research/service"),
  import("../lib/db/repository"),
  import("../lib/db/local"),
]);
after(async () => { (await setup)[2].sqlite.close(); rmSync(temp, { recursive: true, force: true }); });

test("a relação LOTUS só entra após revisão explícita, com fonte, sem duplicação", async () => {
  const [research, repo] = await setup;
  const input = {
    lotusId: "LTS0075508", scientificName: "Ilex paraguariensis", compoundName: "caffeine",
    inchiKey: "TEST-KEY", formula: "C8H10N4O2", claim: "A publicação relata cafeína nas folhas de Ilex paraguariensis.",
    type: "publication", source: "Estudo primário", url: "https://doi.org/10.1000/example",
    part: "folhas", method: "cromatografia", reviewed: true,
  };
  await assert.rejects(() => research.reviewLotus({ ...input, reviewed: false }));
  await assert.rejects(() => research.reviewLotus({ ...input, url: "" }));
  assert.equal((await repo.snapshot()).evidence.length, 0);
  const created = await research.reviewLotus(input);
  assert.equal(created.existing, false);
  assert.equal(created.species.group, "plant");
  assert.equal(created.evidence.compoundId, created.compound.id);
  assert.equal(created.evidence.part, "folhas");
  assert.equal(created.evidence.origin, "publication");
  assert.equal((await research.reviewLotus(input)).existing, true);
  const data = await repo.snapshot();
  assert.equal(data.species.length, 1);
  assert.equal(data.compounds.length, 1);
  assert.equal(data.evidence.length, 1);
});

test("efeitos estruturados exigem fonte, preservam texto legado e podem ser excluídos", async () => {
  const [research, repo] = await setup;
  const compound = (await repo.snapshot()).compounds[0];
  const input = { kind: "stimulant", context: "isolated_compound", claim: "O estudo observou estimulação em humanos.",
    type: "human", source: "Estudo clínico", url: "https://doi.org/10.1000/effect" };
  await assert.rejects(() => research.addCompoundEffect(compound.id, { ...input, url: "" }));
  const effect = await research.addCompoundEffect(compound.id, input);
  assert.equal((await repo.snapshot()).compounds[0].effectClaims[0].id, effect.id);
  await assert.rejects(() => research.addCompoundEffect(compound.id, input), /já foram registrados/);
  await research.removeCompoundEffect(compound.id, effect.id);
  assert.equal((await repo.snapshot()).compounds[0].effectClaims.length, 0);
});
