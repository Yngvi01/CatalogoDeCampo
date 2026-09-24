import { randomUUID, createHash } from "node:crypto";
import { get, list, put } from "@/lib/db/repository";
import { query, transaction } from "@/lib/db";
import { europePMC, researchTopics } from "@/lib/providers/europe-pmc";
import {
  evidenceSchema,
  discoverySchema,
  compoundSchema,
  speciesSchema,
  effectClaimSchema,
  lotusBookmarkSchema,
  evidenceTypes,
  type Species,
  type Discovery,
  type Compound,
  type LotusBookmark,
} from "@/lib/validation/schemas";
import { normalize } from "@/lib/utils";
import { z } from "zod";

const lotusReviewInput = z.object({
  lotusId: z.string().regex(/^LTS\d{5,12}$/),
  scientificName: z.string().trim().min(3).max(250).refine(name => /^\S+\s+\S+/.test(name) && !/\bspp?\.?$/i.test(name), "Revise uma espécie, não apenas um gênero."),
  compoundName: z.string().trim().min(1).max(250),
  inchiKey: z.string().max(100),
  formula: z.string().max(500),
  claim: z.string().trim().min(10).max(30000),
  type: z.enum(evidenceTypes),
  source: z.string().trim().min(2).max(500),
  url: z.url().refine(url => /^https:\/\//.test(url)),
  part: z.string().max(500).default(""),
  concentration: z.string().max(500).default(""),
  unit: z.string().max(500).default(""),
  range: z.string().max(500).default(""),
  method: z.string().max(500).default(""),
  sampleOrigin: z.string().max(500).default(""),
  notes: z.string().max(30000).default(""),
  reviewed: z.literal(true),
});

const bookmarkInput = lotusBookmarkSchema.omit({ id: true, createdAt: true });

export async function saveLotusBookmark(input: unknown) {
  const value = bookmarkInput.parse(input);
  if (!/^\S+\s+\S+/.test(value.scientificName) || /\bspp?\.?$/i.test(value.scientificName))
    throw new Error("Guarde uma relação com espécie identificada, não somente um gênero.");
  return transaction(async () => {
    const bookmarks = await list<LotusBookmark>("bookmarks");
    const existing = bookmarks.find(item => item.lotusId === value.lotusId && normalize(item.scientificName) === normalize(value.scientificName));
    if (existing) return { bookmark: existing, existing: true };
    if (bookmarks.length >= 500) throw new Error("A lista de revisão chegou ao limite de 500 relações.");
    const bookmark = lotusBookmarkSchema.parse({ ...value, id: randomUUID(), createdAt: new Date().toISOString() });
    await put("bookmarks", bookmark);
    return { bookmark, existing: false };
  });
}

export async function removeLotusBookmark(id: string) {
  return transaction(async () => {
    if (!await get("bookmarks", id)) throw new Error("Relação pendente não encontrada.");
    await query("DELETE FROM bookmarks WHERE id = $1", [id]);
    return { ok: true };
  });
}

async function clearReviewedBookmark(lotusId: string, scientificName: string) {
  const bookmarks = await list<LotusBookmark>("bookmarks");
  for (const item of bookmarks)
    if (item.lotusId === lotusId && normalize(item.scientificName) === normalize(scientificName))
      await query("DELETE FROM bookmarks WHERE id = $1", [item.id]);
}

export async function reviewLotus(input: unknown) {
  const value = lotusReviewInput.parse(input);
  return transaction(async () => {
    const species = (await list<Species>("species")).find(item => item.group === "plant" && (normalize(item.scientificName) === normalize(value.scientificName)
      || normalize(item.acceptedName) === normalize(value.scientificName)));
    const existingCompounds = await list<Compound>("compounds");
    const compound = existingCompounds.find(item => value.inchiKey && item.inchiKey === value.inchiKey)
      || existingCompounds.find(item => (!value.inchiKey || !item.inchiKey) && normalize(item.name) === normalize(value.compoundName));
    const now = new Date().toISOString();
    const plant = species || speciesSchema.parse({
      id: randomUUID(), scientificName: value.scientificName, acceptedName: "", commonNames: [], synonyms: [],
      group: "plant", genus: value.scientificName.split(" ")[0], family: "", taxonomy: {},
      description: "", diagnostics: "", distribution: "", habitat: "", toxicity: "", traditionalUses: "", notes: "", createdAt: now,
    });
    const chemical = compound || compoundSchema.parse({
      id: randomUUID(), name: value.compoundName, inchiKey: value.inchiKey, formula: value.formula,
      synonyms: [], chemicalClass: "", description: "", mechanisms: "", targets: "", effects: "", toxicology: "", createdAt: now,
    });
    const duplicate = (await list<z.infer<typeof evidenceSchema>>("evidence")).find(item =>
      item.speciesId === plant.id && item.compoundId === chemical.id && item.url === value.url && normalize(item.claim) === normalize(value.claim));
    if (duplicate) {
      await clearReviewedBookmark(value.lotusId, value.scientificName);
      return { species: plant, compound: chemical, evidence: duplicate, existing: true };
    }
    const evidence = evidenceSchema.parse({
      id: randomUUID(), speciesId: plant.id, compoundId: chemical.id, property: "composição química",
      claim: value.claim, type: value.type, origin: "publication", source: value.source, url: value.url,
      part: value.part, concentration: value.concentration, unit: value.unit, range: value.range,
      method: value.method, sampleOrigin: value.sampleOrigin,
      notes: [value.notes, `Relação localizada no LOTUS: https://lotus.naturalproducts.net/compound/lotus_id/${value.lotusId}`].filter(Boolean).join("\n"),
      createdAt: now,
    });
    if (!species) await put("species", plant);
    if (!compound) await put("compounds", chemical);
    await put("evidence", evidence);
    await clearReviewedBookmark(value.lotusId, value.scientificName);
    return { species: plant, compound: chemical, evidence, existing: false };
  });
}

export async function addCompoundEffect(compoundId: string, input: unknown) {
  const fields = effectClaimSchema.omit({ id: true, createdAt: true }).parse(input);
  return transaction(async () => {
    const current = await get<Compound>("compounds", compoundId);
    if (!current) throw new Error("Composto não encontrado.");
    const claims = current.effectClaims || [];
    if (claims.some(item => item.kind === fields.kind && item.url === fields.url && normalize(item.claim) === normalize(fields.claim)))
      throw new Error("Este efeito e fonte já foram registrados.");
    const claim = effectClaimSchema.parse({ ...fields, id: randomUUID(), createdAt: new Date().toISOString() });
    await put("compounds", compoundSchema.parse({ ...current, effectClaims: [...claims, claim] }));
    return claim;
  });
}

export async function removeCompoundEffect(compoundId: string, claimId: string) {
  return transaction(async () => {
    const current = await get<Compound>("compounds", compoundId);
    if (!current) throw new Error("Composto não encontrado.");
    const claims = current.effectClaims || [];
    if (!claims.some(item => item.id === claimId)) throw new Error("Registro de efeito não encontrado.");
    await put("compounds", compoundSchema.parse({ ...current, effectClaims: claims.filter(item => item.id !== claimId) }));
    return { ok: true };
  });
}
export async function investigate(id: string, refresh = false, compoundName = "") {
  const s = await get<Species>("species", id);
  if (!s) throw new Error("Espécie não encontrada.");
  const compound = compoundName.trim().replace(/\s+/g, " ");
  if (compound.length > 120 || (compound.length > 0 && compound.length < 2))
    throw new Error("Informe um composto com 2 a 120 caracteres.");
  const papers = await europePMC.search(
    [s.acceptedName || s.scientificName, ...s.synonyms],
    compound ? [compound] : researchTopics,
    refresh,
  );
  await transaction(async () => {
    for (const p of papers) {
      const did = createHash("sha256")
        .update(id + p.id)
        .digest("hex");
      if (await get("discoveries", did)) continue;
      await put(
        "discoveries",
        discoverySchema.parse({
          ...p,
          id: did,
          speciesId: id,
          source: "Europe PMC",
          status: "new",
          createdAt: new Date().toISOString(),
        }),
      );
    }
    await put("research", {
      id: randomUUID(),
      speciesId: id,
      query:
        papers[0]?.query || [s.scientificName, ...(compound ? [compound] : researchTopics)].join(" | "),
      provider: "europe-pmc",
      createdAt: new Date().toISOString(),
      resultCount: papers.length,
    });
  });
  return { count: papers.length };
}
export async function incorporate(id: string, input: unknown) {
  return transaction(async () => {
    const d = await get<Discovery>("discoveries", id);
    if (!d) throw new Error("Descoberta não encontrada.");
    if (d.status === "incorporated")
      throw new Error("Esta descoberta já foi incorporada à ficha.");
    const evidence = evidenceSchema.parse({
      ...(input as object),
      id: randomUUID(),
      speciesId: d.speciesId,
      source: d.title,
      url: d.url,
      origin: "publication",
      createdAt: new Date().toISOString(),
    });
    await transaction(async () => {
      await put("evidence", evidence);
      await put("discoveries", { ...d, status: "incorporated" });
    });
    return evidence;
  });
}
