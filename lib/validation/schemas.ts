import { z } from "zod";
export const groupSchema = z.enum(["plant", "fungus"]);
export const statusSchema = z.enum([
  "unidentified",
  "candidates",
  "probable",
  "user_identified",
  "externally_confirmed",
]);
const httpUrl = z
  .url()
  .refine((v) => /^https?:\/\//.test(v), "Use uma URL HTTP ou HTTPS.");
const short = z.string().max(500);
const long = z.string().max(30000);
const id = z.string().min(1).max(100);
const time = z.iso.datetime();
export const morphologySchema = z.record(
  z.string().max(60),
  z.string().max(1000),
);
export const observationInput = z
  .object({
    group: groupSchema.default("plant"),
    observedAt: time.optional(),
    region: short.default(""),
    habitat: short.default(""),
    substrate: short.default(""),
    vegetation: short.default(""),
    light: short.default(""),
    altitude: z.number().min(-500).max(10000).nullable().default(null),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    notes: long.default(""),
    morphology: morphologySchema.default({}),
  })
  .refine(
    (v) => (v.latitude === null) === (v.longitude === null),
    "Informe latitude e longitude juntas.",
  );
export const speciesSchema = z.object({
  id,
  scientificName: z.string().min(2).max(250),
  acceptedName: short,
  commonNames: z.array(short),
  synonyms: z.array(short),
  group: groupSchema,
  genus: short,
  family: short,
  taxonomy: morphologySchema,
  description: long,
  diagnostics: long,
  distribution: long,
  habitat: long,
  toxicity: long,
  traditionalUses: long,
  notes: long,
  createdAt: time,
});
export const observationSchema = z.object({
  id,
  code: z.string().regex(/^CAMPO-\d{6,}$/),
  group: groupSchema,
  observedAt: time,
  createdAt: time,
  region: short,
  habitat: short,
  substrate: short,
  vegetation: short,
  light: short,
  altitude: z.number().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  notes: long,
  morphology: morphologySchema,
  status: statusSchema,
  speciesId: id.nullable(),
});
export const imageSchema = z.object({
  id,
  observationId: id,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  original: z.string().regex(/^[a-f0-9-]+\.(jpg|png|webp|tiff|heif)$/),
  optimized: z.string().regex(/^[a-f0-9-]+-opt\.jpg$/),
  thumbnail: z.string().regex(/^[a-f0-9-]+-thumb\.jpg$/),
  mime: short,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  organ: short,
  createdAt: time,
});
export const candidateSchema = z.object({
  scientificName: short,
  genus: short,
  family: short,
  commonNames: z.array(short),
  score: z.number().nullable(),
  referenceImages: z
    .array(z.object({ url: httpUrl, author: short, license: short }))
    .default([]),
});
export const identificationSchema = z.object({
  id,
  observationId: id,
  provider: short,
  candidates: z.array(candidateSchema),
  imageIds: z.array(id),
  queriedAt: time,
  raw: z.unknown(),
  selectedName: short.nullable(),
});
export const historySchema = z.object({
  id,
  observationId: id,
  previousStatus: statusSchema,
  status: statusSchema,
  previousSpeciesId: id.nullable(),
  speciesId: id.nullable(),
  note: long,
  createdAt: time,
});
export const compoundSchema = z.object({
  id,
  name: z.string().min(1).max(250),
  pubchemCid: z.number().int().positive().nullable().optional(),
  molecularWeight: z.string().max(100).optional(),
  inchiKey: z.string().max(100).optional(),
  synonyms: z.array(short),
  chemicalClass: short,
  formula: short,
  description: long,
  mechanisms: long,
  targets: short,
  effects: long,
  toxicology: long,
  createdAt: time,
});
export const evidenceTypes = [
  "personal",
  "anecdotal",
  "traditional",
  "observation",
  "in_vitro",
  "animal",
  "human",
  "review",
  "meta_analysis",
] as const;
export const evidenceSchema = z.object({
  id,
  speciesId: id,
  compoundId: id.nullable(),
  property: short,
  claim: z.string().min(1).max(30000),
  type: z.enum(evidenceTypes),
  origin: z.enum([
    "personal",
    "automatic",
    "publication",
    "hypothesis",
    "confirmed",
  ]),
  source: short,
  url: z.union([z.url().refine((v) => /^https?:\/\//.test(v)), z.literal("")]),
  part: short,
  concentration: short,
  unit: short,
  range: short,
  method: short,
  sampleOrigin: short,
  notes: long,
  createdAt: time,
});
export const discoverySchema = z.object({
  id,
  speciesId: id,
  title: short,
  authors: long,
  year: short,
  doi: short,
  url: httpUrl,
  abstract: long,
  query: long,
  source: short,
  status: z.enum([
    "new",
    "relevant",
    "investigate",
    "inconclusive",
    "discarded",
    "incorporated",
  ]),
  createdAt: time,
});
export const researchSchema = z.object({
  id,
  speciesId: id,
  query: long,
  provider: short,
  createdAt: time,
  resultCount: z.number().int().nonnegative(),
});
export const settingsSchema = z.object({
  id: z.enum(["preferences"]),
  value: z.object({
    locale: z.literal("pt-BR").optional(),
    theme: z.enum(["dark", "light"]).optional(),
  }),
});
export const noteInputSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à página.").max(200),
  content: z.string().max(100000),
  tags: z.array(z.string().trim().min(1).max(50)).max(12).default([]),
});
export const noteSchema = noteInputSchema.extend({
  id,
  archived: z.boolean(),
  createdAt: time,
  updatedAt: time,
});
export const noteUpdateSchema = noteInputSchema.partial().extend({
  tags: noteInputSchema.shape.tags.removeDefault().optional(),
  archived: z.boolean().optional(),
  expectedUpdatedAt: time,
});
export const exportDataSchema = z.object({
  species: z.array(speciesSchema),
  observations: z.array(observationSchema),
  images: z.array(imageSchema),
  identifications: z.array(identificationSchema),
  history: z.array(historySchema),
  compounds: z.array(compoundSchema),
  evidence: z.array(evidenceSchema),
  discoveries: z.array(discoverySchema),
  research: z.array(researchSchema),
  settings: z.array(settingsSchema),
  notes: z.array(noteSchema),
});
// v1 não tinha caderno. v2 exige notes, evitando perdas silenciosas em leitores antigos.
export const exportSchema = z.discriminatedUnion("version", [
  z.object({
    format: z.literal("campo-catalogo"),
    version: z.literal(1),
    exportedAt: time,
    data: exportDataSchema.extend({ notes: z.array(noteSchema).default([]) }),
  }),
  z.object({
    format: z.literal("campo-catalogo"),
    version: z.literal(2),
    exportedAt: time,
    data: exportDataSchema,
  }),
]);
export type Note = z.infer<typeof noteSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Photo = z.infer<typeof imageSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Identification = z.infer<typeof identificationSchema>;
export type Compound = z.infer<typeof compoundSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Discovery = z.infer<typeof discoverySchema>;
export type ExportData = z.infer<typeof exportDataSchema>;
export type Catalog = {
  species: Species[];
  observations: (Observation & { photos: Photo[] })[];
  compounds: Compound[];
  evidence: Evidence[];
  discoveries: Discovery[];
  notes: Note[];
  plantnetConfigured: boolean;
  passwordConfigured: boolean;
  storageMode: "local" | "supabase";
};
