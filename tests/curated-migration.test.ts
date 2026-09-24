import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const temp = mkdtempSync(path.join(tmpdir(), "campo-curated-migration-"));
process.env.CAMPO_DATA_DIR = temp;
const setup = Promise.all([import("../lib/db/repository"), import("../lib/db/local")]);
after(async () => { (await setup)[1].sqlite.close(); rmSync(temp, { recursive: true, force: true }); });

test("migration remove exemplos antigos sem alterar o catálogo pessoal ou o backup", async () => {
  const [repo, local] = await setup;
  const personal = await repo.snapshot();
  assert.deepEqual([personal.species.length, personal.compounds.length, personal.evidence.length], [0, 0, 0]);
  assert.equal((local.sqlite.prepare("SELECT COUNT(*) AS total FROM curated_examples").get() as { total: number }).total, 0);
  assert.equal("curatedExamples" in await repo.catalog(), false);
});
