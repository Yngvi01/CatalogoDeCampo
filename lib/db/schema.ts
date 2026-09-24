import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type {
  Species,
  Observation,
  Photo,
  Identification,
  Compound,
  LotusBookmark,
  Evidence,
  Discovery,
  Note,
} from "../validation/schemas";
export const species = sqliteTable("species", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<Species>().notNull(),
});
export const observations = sqliteTable("observations", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  speciesId: text("species_id").references(() => species.id),
  data: text("data", { mode: "json" }).$type<Observation>().notNull(),
});
export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  observationId: text("observation_id")
    .notNull()
    .references(() => observations.id),
  data: text("data", { mode: "json" }).$type<Photo>().notNull(),
});
export const identifications = sqliteTable("identifications", {
  id: text("id").primaryKey(),
  observationId: text("observation_id")
    .notNull()
    .references(() => observations.id),
  data: text("data", { mode: "json" }).$type<Identification>().notNull(),
});
export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  observationId: text("observation_id")
    .notNull()
    .references(() => observations.id),
  data: text("data", { mode: "json" }).notNull(),
});
export const compounds = sqliteTable("compounds", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<Compound>().notNull(),
});
export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<LotusBookmark>().notNull(),
});
export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(),
  speciesId: text("species_id")
    .notNull()
    .references(() => species.id),
  compoundId: text("compound_id").references(() => compounds.id),
  data: text("data", { mode: "json" }).$type<Evidence>().notNull(),
});
export const discoveries = sqliteTable("discoveries", {
  id: text("id").primaryKey(),
  speciesId: text("species_id")
    .notNull()
    .references(() => species.id),
  data: text("data", { mode: "json" }).$type<Discovery>().notNull(),
});
export const research = sqliteTable("research", {
  id: text("id").primaryKey(),
  speciesId: text("species_id")
    .notNull()
    .references(() => species.id),
  data: text("data", { mode: "json" }).notNull(),
});
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
});
export const cache = sqliteTable("cache", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  query: text("query").notNull(),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<Note>().notNull(),
});

// Read-only reference set, separate from the user's catalog and portable backup.
export const curatedExamples = sqliteTable("curated_examples", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
});
