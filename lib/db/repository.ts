import { cloud, query, transaction } from "./index";
import {
  exportDataSchema,
  type ExportData,
  type Observation,
  type Species,
} from "../validation/schemas";
import { normalize } from "../utils";
export const tableNames = [
  "species",
  "observations",
  "images",
  "identifications",
  "history",
  "compounds",
  "bookmarks",
  "evidence",
  "discoveries",
  "research",
  "settings",
  "notes",
] as const;
export type TableName = (typeof tableNames)[number];
export async function list<T>(table: TableName): Promise<T[]> {
  const rows = await query<{ data: string | T }>(
    `SELECT data FROM ${table} ORDER BY ${cloud ? "position" : "rowid"}`,
  );
  return rows.map((r) =>
    typeof r.data === "string" ? (JSON.parse(r.data) as T) : r.data,
  );
}
export async function get<T>(
  table: TableName,
  id: string,
): Promise<T | undefined> {
  const [r] = await query<{ data: string | T }>(
    `SELECT data FROM ${table} WHERE id = $1`,
    [id],
  );
  return r
    ? typeof r.data === "string"
      ? JSON.parse(r.data)
      : r.data
    : undefined;
}
export async function put(
  table: TableName,
  record: { id: string; [key: string]: unknown },
) {
  const columns = ["id", "data"];
  const values: unknown[] = [
    record.id,
    cloud ? record : JSON.stringify(record),
  ];
  if (table === "observations") {
    columns.push("code", "species_id");
    values.push(record.code, record.speciesId);
  }
  if (["images", "identifications", "history"].includes(table)) {
    columns.push("observation_id");
    values.push(record.observationId);
  }
  if (["evidence", "discoveries", "research"].includes(table)) {
    columns.push("species_id");
    values.push(record.speciesId);
  }
  if (table === "evidence") {
    columns.push("compound_id");
    values.push(record.compoundId);
  }
  await transaction(async () => {
    await query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT(id) DO UPDATE SET ${columns
        .slice(1)
        .map((c) => `${c}=excluded.${c}`)
        .join(",")}`,
      values,
    );
  });
}
export async function snapshot(): Promise<ExportData> {
  return transaction(async () => {
    const entries = await Promise.all(
      tableNames.map(async (name) => [name, await list(name)]),
    );
    return exportDataSchema.parse(Object.fromEntries(entries));
  });
}
export async function nextCode() {
  const rows = await list<Observation>("observations");
  const next =
    Math.max(0, ...rows.map((o) => Number(o.code.slice(6)) || 0)) + 1;
  return `CAMPO-${String(next).padStart(6, "0")}`;
}
export async function catalog() {
  const data = await snapshot();
  return {
    species: data.species,
    observations: data.observations
      .map((o) => ({
        ...o,
        photos: data.images.filter((p) => p.observationId === o.id),
      }))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
    compounds: data.compounds,
    bookmarks: data.bookmarks,
    evidence: data.evidence,
    discoveries: data.discoveries,
    notes: data.notes,
    plantnetConfigured: !!process.env.PLANTNET_API_KEY,
    passwordConfigured: !!process.env.CAMPO_PASSWORD,
    storageMode: cloud ? "supabase" : "local",
  };
}
export async function findSpecies(name: string) {
  return (await list<Species>("species")).find(
    (s) => normalize(s.scientificName) === normalize(name),
  );
}
export async function personalContext(observation: Observation) {
  return (await list<Observation>("observations"))
    .filter((o) => o.id !== observation.id && o.speciesId)
    .map((o) => ({
      observation: o,
      sameRegion:
        !!o.region && normalize(o.region) === normalize(observation.region),
      sameMonth:
        new Date(o.observedAt).getMonth() ===
        new Date(observation.observedAt).getMonth(),
      sameHabitat:
        !!o.habitat && normalize(o.habitat) === normalize(observation.habitat),
      sameSubstrate:
        !!o.substrate &&
        normalize(o.substrate) === normalize(observation.substrate),
      morphologyMatches: Object.entries(observation.morphology)
        .filter(
          ([k, v]) => v && normalize(o.morphology[k] || "") === normalize(v),
        )
        .map(([k]) => k),
    }));
}
