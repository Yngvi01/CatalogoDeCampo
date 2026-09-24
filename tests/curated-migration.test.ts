import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { curatedExamples } from "../features/research/curated-examples";

const temp = mkdtempSync(path.join(tmpdir(), "campo-curated-migration-"));
process.env.CAMPO_DATA_DIR = temp;
const setup = Promise.all([import("../lib/db/repository"), import("../lib/db/local")]);
after(async () => { (await setup)[1].sqlite.close(); rmSync(temp, { recursive: true, force: true }); });

test("migration mantém exemplos na referência, sem alterar o catálogo pessoal ou o backup", async () => {
  const [repo] = await setup;
  const personal = await repo.snapshot();
  assert.deepEqual([personal.species.length, personal.compounds.length, personal.evidence.length], [0, 0, 0]);
  assert.deepEqual((await repo.catalog()).curatedExamples, curatedExamples);
});
