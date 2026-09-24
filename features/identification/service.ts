import { randomUUID } from "node:crypto";
import { get, list, put } from "@/lib/db/repository";
import { sqlite } from "@/lib/db";
import { plantnet } from "@/lib/providers/plantnet";
import { fungi, compareSources } from "@/lib/providers/biodiversity";
import type { Observation, Photo } from "@/lib/validation/schemas";
export async function identify(id: string, refresh = false) {
  const o = get<Observation>("observations", id);
  if (!o) throw new Error("Observação não encontrada.");
  const photos = list<Photo>("images")
    .filter((p) => p.observationId === id)
    .slice(0, 5);
  const provider = o.group === "plant" ? plantnet : fungi;
  const result = await provider.identify(o, photos, refresh);
  const record = {
    id: randomUUID(),
    observationId: id,
    provider: provider.id,
    ...result,
    imageIds: photos.map((p) => p.id),
    queriedAt: result.queriedAt || new Date().toISOString(),
    selectedName: null,
  };
  sqlite.transaction(() => {
    put("identifications", record);
    const current = get<Observation>("observations", id)!;
    if (current.status === "unidentified" && result.candidates.length) {
      put("history", {
        id: randomUUID(),
        observationId: id,
        previousStatus: current.status,
        status: "candidates",
        previousSpeciesId: current.speciesId,
        speciesId: current.speciesId,
        note: `Candidatos de ${provider.id}; sem confirmação.`,
        createdAt: new Date().toISOString(),
      });
      put("observations", { ...current, status: "candidates" });
    }
  })();
  return record;
}
export async function compare(id: string, name: string, refresh = false) {
  const o = get<Observation>("observations", id);
  if (!o) throw new Error("Observação não encontrada.");
  return compareSources(name, o, refresh);
}
