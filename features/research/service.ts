import { randomUUID, createHash } from "node:crypto";
import { get, put } from "@/lib/db/repository";
import { transaction } from "@/lib/db";
import { europePMC, researchTopics } from "@/lib/providers/europe-pmc";
import {
  evidenceSchema,
  discoverySchema,
  type Species,
  type Discovery,
} from "@/lib/validation/schemas";
export async function investigate(id: string, refresh = false) {
  const s = await get<Species>("species", id);
  if (!s) throw new Error("Espécie não encontrada.");
  const papers = await europePMC.search(
    [s.acceptedName || s.scientificName, ...s.synonyms],
    researchTopics,
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
        papers[0]?.query || [s.scientificName, ...researchTopics].join(" | "),
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
