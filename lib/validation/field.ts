import { z } from "zod";
const fieldKey = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).refine(key => !["__proto__", "prototype", "constructor"].includes(key), "Nome de campo reservado.");
const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);
const position = z.union([z.tuple([longitude, latitude]), z.tuple([longitude, latitude, z.number().finite()])]);
const ring = z.array(position).min(4).max(10000).refine(points => JSON.stringify(points[0]) === JSON.stringify(points.at(-1)), "Feche o anel do polígono repetindo a primeira coordenada.");
export const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2).max(10000) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(ring).min(1).max(100) }),
]);
export type FieldGeometry = z.infer<typeof geometrySchema>;
export const siteInputSchema = z.object({
  projectId: z.string().min(1).max(100), name: z.string().trim().min(1).max(250),
  geometry: geometrySchema, notes: z.string().max(30000).default(""), archived: z.boolean().default(false),
});
export const siteSchema = siteInputSchema.extend({
  id: z.string().min(1).max(100), kind: z.enum(["point", "line", "polygon"]),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).refine(s => s.kind === ({ Point: "point", LineString: "line", Polygon: "polygon" } as const)[s.geometry.type], "Tipo incompatível com a geometria.");
export type SamplingSite = z.infer<typeof siteSchema>;
export const fieldDefinitionSchema = z.object({
  id: fieldKey, label: z.string().trim().min(1).max(150),
  type: z.enum(["text", "number", "select", "multi_select", "boolean", "date", "coordinate", "note"]),
  options: z.array(z.string().trim().min(1).max(250)).max(60).default([]),
  required: z.boolean().default(false), archived: z.boolean().default(false), unit: z.string().max(50).default(""),
}).refine(f => !["select", "multi_select"].includes(f.type) || f.options.length > 0, "Informe as opções de seleção.")
  .refine(f => new Set(f.options).size === f.options.length, "Não repita opções.");
export const fieldDefinitionsSchema = z.array(fieldDefinitionSchema).max(40)
  .refine(fields => new Set(fields.map(f => f.id)).size === fields.length, "Não repita IDs de campos.");
export const customValuesSchema = z.record(fieldKey, z.union([
  z.string().max(30000), z.number().finite(), z.boolean(), z.array(z.string().max(250)).max(60),
  z.object({ latitude, longitude }),
]));
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type CustomValues = z.infer<typeof customValuesSchema>;
export function validateCustomValues(definitions: FieldDefinition[], values: CustomValues, requireFields = true) {
  for (const [key, value] of Object.entries(values)) {
    const field = definitions.find(f => f.id === key);
    if (!field) throw new Error("Campo extra não pertence ao projeto.");
    const valid = field.type === "number" ? typeof value === "number" :
      field.type === "boolean" ? typeof value === "boolean" :
      field.type === "coordinate" ? typeof value === "object" && !Array.isArray(value) :
      field.type === "multi_select" ? Array.isArray(value) && value.every(v => field.options.includes(v)) :
      field.type === "select" ? typeof value === "string" && field.options.includes(value) :
      field.type === "date" ? z.iso.date().safeParse(value).success : typeof value === "string";
    if (!valid) throw new Error(`Valor inválido para ${field.label}.`);
  }
  if (requireFields) for (const field of definitions.filter(f => f.required && !f.archived)) {
    const value = values[field.id];
    if (value === undefined || value === "" || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length))
      throw new Error(`Preencha ${field.label}.`);
  }
}
export const geoJSONImportSchema = z.union([
  z.object({ type: z.literal("FeatureCollection"), features: z.array(z.object({ type: z.literal("Feature"), geometry: geometrySchema, properties: z.record(z.string(), z.unknown()).nullable().default(null) })).min(1).max(1000) }),
  z.object({ type: z.literal("Feature"), geometry: geometrySchema, properties: z.record(z.string(), z.unknown()).nullable().default(null) }),
  geometrySchema,
]);
