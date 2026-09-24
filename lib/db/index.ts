import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.CAMPO_DATA_DIR || "./data",
);
mkdirSync(path.join(dataDir, "images"), { recursive: true });
const globalDb = globalThis as unknown as { campoSqlite?: Database.Database };
export const sqlite =
  globalDb.campoSqlite ?? new Database(path.join(dataDir, "database.sqlite"));
globalDb.campoSqlite = sqlite;
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
export const db = drizzle(sqlite, { schema });
migrate(db, {
  migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
});
