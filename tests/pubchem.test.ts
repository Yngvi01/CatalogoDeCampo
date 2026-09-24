import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "campo-pubchem-"));
process.env.CAMPO_DATA_DIR = dir;
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  (await import("../lib/db/local")).sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});

test("PubChem consulta, limita e armazena somente identificadores químicos", async () => {
  const { searchPubChem } = await import("../lib/providers/pubchem");
  const { compoundSchema } = await import("../lib/validation/schemas");
  const { put, snapshot } = await import("../lib/db/repository");
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    assert.match(String(url), /compound\/name\/psilocybin\/property\//);
    return Response.json({ PropertyTable: { Properties: [{
      CID: 10624, Title: "Psilocybin", MolecularFormula: "C12H17N2O4P",
      MolecularWeight: "284.25", InChIKey: "QVDSEJDULKLHCG-UHFFFAOYSA-N",
    }] } });
  };
  const matches = await searchPubChem(" psilocybin ");
  assert.equal(matches[0].cid, 10624);
  assert.equal(matches[0].formula, "C12H17N2O4P");
  assert.match(matches[0].url, /pubchem\.ncbi\.nlm\.nih\.gov\/compound\/10624/);
  await searchPubChem("psilocybin");
  assert.equal(calls, 1, "consultas repetidas devem usar o cache");
  const compound = compoundSchema.parse({
    id: "pubchem-test", name: matches[0].name, pubchemCid: matches[0].cid,
    molecularWeight: matches[0].molecularWeight, inchiKey: matches[0].inchiKey,
    formula: matches[0].formula, synonyms: [], chemicalClass: "", description: "",
    mechanisms: "", targets: "", effects: "", toxicology: "",
    createdAt: new Date().toISOString(),
  });
  await put("compounds", compound);
  const data = await snapshot();
  assert.equal(data.compounds[0].pubchemCid, 10624);
  assert.equal(data.compounds[0].inchiKey, "QVDSEJDULKLHCG-UHFFFAOYSA-N");
  assert.equal(data.evidence.length, 0, "a busca química não comprova ocorrência em plantas");
});

test("PubChem distingue ausência de resultado e indisponibilidade", async () => {
  const { searchPubChem } = await import("../lib/providers/pubchem");
  await assert.rejects(() => searchPubChem("x"), /2 a 120/);
  globalThis.fetch = async () => new Response(null, { status: 404 });
  assert.deepEqual(await searchPubChem("nome-sem-resultado"), []);
  globalThis.fetch = async () => new Response(null, { status: 429 });
  await assert.rejects(() => searchPubChem("limite-temporario"), /ocupado/);
});
