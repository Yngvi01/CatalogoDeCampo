import { randomUUID } from "node:crypto";
import { sqlite } from "@/lib/db";
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
  statusSchema,
} from "@/lib/validation/schemas";
import { savePhoto, removePhoto } from "@/lib/storage/photos";
import { z } from "zod";
export async function createObservation(form: FormData) {
  const input = observationInput.parse(
    JSON.parse(String(form.get("data") || "{}")),
  );
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length || files.length > 12)
    throw new Error("Selecione entre 1 e 12 fotos.");
  if (files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024)
    throw new Error("O envio não pode superar 100 MB.");
  const id = randomUUID(),
    photos: Photo[] = [];
  try {
    for (const f of files) photos.push(await savePhoto(f, id));
    const duplicates = photos.filter(
      (p, i) =>
        photos.slice(0, i).some((x) => x.hash === p.hash) ||
        list<Photo>("images").some((x) => x.hash === p.hash),
    );
    const observation = sqlite.transaction(() => {
      const o: Observation = {
        ...input,
        id,
        code: nextCode(),
        observedAt: input.observedAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: "unidentified",
        speciesId: null,
      };
      put("observations", o);
      photos.forEach((p) => put("images", p));
      return o;
    })();
    return { observation, duplicates: duplicates.map((p) => p.id) };
  } catch (error) {
    await Promise.all(photos.map(removePhoto));
    throw error;
  }
}
export function observationDetail(id: string) {
  const observation = get<Observation>("observations", id);
  if (!observation) throw new Error("Observação não encontrada.");
  return {
    ...observation,
    photos: list<Photo>("images").filter((p) => p.observationId === id),
    identifications: list<Identification>("identifications").filter(
      (i) => i.observationId === id,
    ),
    history: list<{ observationId: string }>("history").filter(
      (h) => h.observationId === id,
    ),
    context: personalContext(observation),
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
export function confirmIdentification(id: string, input: unknown) {
  const value = confirmInput.parse(input);
  return sqlite.transaction(() => {
    const o = get<Observation>("observations", id);
    if (!o) throw new Error("Observação não encontrada.");
    const previousSpeciesId = o.speciesId;
    let s = findSpecies(value.scientificName);
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
      put("species", s);
    }
    put("history", {
      id: randomUUID(),
      observationId: id,
      previousStatus: o.status,
      status: value.status,
      previousSpeciesId,
      speciesId: s.id,
      note: value.note,
      createdAt: new Date().toISOString(),
    });
    put("observations", { ...o, speciesId: s.id, status: value.status });
    if (value.identificationId) {
      const identification = get<Identification>(
        "identifications",
        value.identificationId,
      );
      if (!identification || identification.observationId !== id)
        throw new Error("Consulta de identificação inválida.");
      put("identifications", {
        ...identification,
        selectedName: s.scientificName,
      });
    }
    return s;
  })();
}
export function updateSpecies(id: string, input: unknown) {
  const current = get<Species>("species", id);
  if (!current) throw new Error("Espécie não encontrada.");
  const value = speciesSchema
    .omit({ id: true, createdAt: true })
    .partial()
    .parse(input);
  const result = speciesSchema.parse({ ...current, ...value });
  const duplicate = findSpecies(result.scientificName);
  if (duplicate && duplicate.id !== id)
    throw new Error("Já existe uma espécie com esse nome científico.");
  if (
    list<Observation>("observations").some(
      (o) => o.speciesId === id && o.group !== result.group,
    )
  )
    throw new Error(
      "O grupo deve ser compatível com as observações vinculadas.",
    );
  put("species", result);
  return result;
}
