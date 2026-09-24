import { randomUUID } from "node:crypto";
import { transaction } from "@/lib/db";
import {
  get,
  list,
  put,
  nextCode,
  findSpecies,
  personalContext,
} from "@/lib/db/repository";
import {
  observationInput,
  speciesSchema,
  type Observation,
  type Photo,
  type Species,
  type Identification,
  type Candidate,
  statusSchema,
} from "@/lib/validation/schemas";
import { savePhoto, removePhoto } from "@/lib/storage/photos";
import { z } from "zod";
export async function createObservation(
  form: FormData,
  identification?: {
    candidates: Candidate[];
    provider: string;
    queriedAt: string;
  },
  organs: string[] = [],
) {
  const input = observationInput.parse(
    JSON.parse(String(form.get("data") || "{}")),
  );
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if ((!files.length && !identification) || files.length > 12)
    throw new Error("Selecione entre 1 e 12 fotos.");
  if (files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024)
    throw new Error("O envio não pode superar 100 MB.");
  const id = randomUUID(),
    photos: Photo[] = [];
  try {
    for (const [index, f] of files.entries()) {
      const photo = await savePhoto(f, id);
      photo.organ = organs[index] || "auto";
      photos.push(photo);
    }
    const existingPhotos = await list<Photo>("images");
    const duplicates = photos.filter(
      (p, i) =>
        photos.slice(0, i).some((x) => x.hash === p.hash) ||
        existingPhotos.some((x) => x.hash === p.hash),
    );
    const observation = await transaction(async () => {
      const o: Observation = {
        ...input,
        id,
        code: await nextCode(),
        observedAt: input.observedAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: identification?.candidates.length
          ? "candidates"
          : "unidentified",
        speciesId: null,
      };
      await put("observations", o);
      for (const p of photos) await put("images", p);
      if (identification && identification.provider !== "manual")
        await put("identifications", {
          id: randomUUID(),
          observationId: id,
          ...identification,
          imageIds: photos.map((p) => p.id),
          selectedName: null,
          raw: { source: "preview", photoRetention: "user-selected" },
        });
      return o;
    });
    return { observation, duplicates: duplicates.map((p) => p.id) };
  } catch (error) {
    await Promise.all(photos.map(removePhoto));
    throw error;
  }
}
export async function observationDetail(id: string) {
  const observation = await get<Observation>("observations", id);
  if (!observation) throw new Error("Observação não encontrada.");
  return {
    ...observation,
    photos: (await list<Photo>("images")).filter((p) => p.observationId === id),
    identifications: (await list<Identification>("identifications")).filter(
      (i) => i.observationId === id,
    ),
    history: (await list<{ observationId: string }>("history")).filter(
      (h) => h.observationId === id,
    ),
    context: await personalContext(observation),
  };
}
export const confirmInput = z
  .object({
    scientificName: z.string().min(2).max(250),
    commonNames: z.array(z.string().max(250)).default([]),
    genus: z.string().max(250).default(""),
    family: z.string().max(250).default(""),
    status: z.enum(["probable", "user_identified", "externally_confirmed"]),
    note: z.string().max(10000).default(""),
    identificationId: z.string().optional(),
  })
  .refine(
    (v) => v.status !== "externally_confirmed" || v.note.trim().length > 3,
    "Informe a fonte da confirmação externa.",
  );
export async function confirmIdentification(id: string, input: unknown) {
  const value = confirmInput.parse(input);
  return await transaction(async () => {
    const o = await get<Observation>("observations", id);
    if (!o) throw new Error("Observação não encontrada.");
    const previousSpeciesId = o.speciesId;
    let s = await findSpecies(value.scientificName);
    if (s && s.group !== o.group)
      throw new Error("Esta espécie está cadastrada em outro grupo.");
    if (!s) {
      s = speciesSchema.parse({
        id: randomUUID(),
        scientificName: value.scientificName.trim(),
        acceptedName: value.scientificName.trim(),
        commonNames: value.commonNames,
        synonyms: [],
        group: o.group,
        genus: value.genus,
        family: value.family,
        taxonomy: {},
        description: "",
        diagnostics: "",
        distribution: "",
        habitat: "",
        toxicity: "",
        traditionalUses: "",
        notes: "",
        createdAt: new Date().toISOString(),
      });
      await put("species", s);
    }
    await put("history", {
      id: randomUUID(),
      observationId: id,
      previousStatus: o.status,
      status: value.status,
      previousSpeciesId,
      speciesId: s.id,
      note: value.note,
      createdAt: new Date().toISOString(),
    });
    await put("observations", { ...o, speciesId: s.id, status: value.status });
    if (value.identificationId) {
      const identification = await get<Identification>(
        "identifications",
        value.identificationId,
      );
      if (!identification || identification.observationId !== id)
        throw new Error("Consulta de identificação inválida.");
      await put("identifications", {
        ...identification,
        selectedName: s.scientificName,
      });
    }
    return s;
  });
}
export async function updateSpecies(id: string, input: unknown) {
  return transaction(async () => {
    const current = await get<Species>("species", id);
    if (!current) throw new Error("Espécie não encontrada.");
    const value = speciesSchema
      .omit({ id: true, createdAt: true })
      .partial()
      .parse(input);
    const result = speciesSchema.parse({ ...current, ...value });
    const duplicate = await findSpecies(result.scientificName);
    if (duplicate && duplicate.id !== id)
      throw new Error("Já existe uma espécie com esse nome científico.");
    if (
      (await list<Observation>("observations")).some(
        (o) => o.speciesId === id && o.group !== result.group,
      )
    )
      throw new Error(
        "O grupo deve ser compatível com as observações vinculadas.",
      );
    await put("species", result);
    return result;
  });
}
