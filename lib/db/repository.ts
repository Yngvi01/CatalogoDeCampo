import { db, sqlite } from "./index";
import * as tables from "./schema";
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
  "evidence",
  "discoveries",
  "research",
  "settings",
] as const;
export type TableName = (typeof tableNames)[number];
export function list<T>(table: TableName): T[] {
  return (
    sqlite.prepare(`SELECT data FROM ${table}`).all() as { data: string }[]
  ).map((r) => JSON.parse(r.data) as T);
}
export function get<T>(table: TableName, id: string): T | undefined {
  const r = sqlite.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as
    | { data: string }
    | undefined;
  return r ? JSON.parse(r.data) : undefined;
}
export function put(
  table: TableName,
  record: { id: string; [key: string]: unknown },
) {
  const columns = ["id", "data"];
  const values: unknown[] = [record.id, JSON.stringify(record)];
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
  sqlite
    .prepare(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${columns
        .slice(1)
        .map((c) => `${c}=excluded.${c}`)
        .join(",")}`,
    )
    .run(...values);
}
export function snapshot(): ExportData {
  const data = Object.fromEntries(tableNames.map((n) => [n, list(n)]));
  return exportDataSchema.parse(data);
}
export function nextCode() {
  const r = sqlite
    .prepare(
      "SELECT MAX(CAST(SUBSTR(code,7) AS INTEGER)) AS n FROM observations",
    )
    .get() as { n: number | null };
  return `CAMPO-${String((r.n || 0) + 1).padStart(6, "0")}`;
}
export function catalog() {
  const photos = db
    .select()
    .from(tables.images)
    .all()
    .map((r) => r.data);
  return {
    species: db
      .select()
      .from(tables.species)
      .all()
      .map((r) => r.data),
    observations: db
      .select()
      .from(tables.observations)
      .all()
      .map((r) => ({
        ...r.data,
        photos: photos.filter((p) => p.observationId === r.id),
      }))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
    compounds: list("compounds"),
    evidence: list("evidence"),
    discoveries: list("discoveries"),
    plantnetConfigured: !!process.env.PLANTNET_API_KEY,
    passwordConfigured: !!process.env.CAMPO_PASSWORD,
  };
}
export function findSpecies(name: string) {
  return list<Species>("species").find(
    (s) => normalize(s.scientificName) === normalize(name),
  );
}
export function personalContext(observation: Observation) {
  return list<Observation>("observations")
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
