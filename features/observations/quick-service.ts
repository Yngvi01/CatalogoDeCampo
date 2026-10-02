import { removePhoto } from "@/lib/storage/photos";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { get, list } from "@/lib/db/repository";
import { observationInput, type Observation, type Photo } from "@/lib/validation/schemas";
import { createObservation, confirmIdentification } from "./service";
export const quickInput = z.object({ clientId: z.uuid(), data: observationInput,
  scientificName: z.union([z.literal(""), z.string().trim().min(2).max(250)]).default("") });
/** Stable client ID + the repository transaction serialize retries, including concurrent requests. */
export async function createQuickObservation(form: FormData) {
  const input = quickInput.parse(JSON.parse(String(form.get("data") || "{}")));
  const photos = form.getAll("photos").filter((file): file is File => file instanceof File && file.size > 0);
  if (photos.length > 5 || photos.some(file => file.size > 20 * 1024 * 1024)) throw new Error("Use até 5 fotos de 20 MB cada.");
  let createdPhotos: Photo[] = [];
  try { return await transaction(async () => {
    const existing = await get<Observation>("observations", input.clientId);
    if (existing) return { observation: existing, replayed: true };
    form.set("data", JSON.stringify(input.data));
    const result = await createObservation(form, undefined, [], { id: input.clientId, allowNoPhotos: true });
    createdPhotos = (await list<Photo>("images")).filter(p => p.observationId === input.clientId);
    if (input.scientificName) await confirmIdentification(result.observation.id, {
      scientificName: input.scientificName, status: "user_identified", note: "Identificação anotada pelo usuário na coleta rápida.",
    });
    return { observation: (await get<Observation>("observations", input.clientId))!, replayed: false };
  }); } catch (error) { await Promise.all(createdPhotos.map(removePhoto)); throw error; }
}
