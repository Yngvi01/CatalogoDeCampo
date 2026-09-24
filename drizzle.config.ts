import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: `${process.env.CAMPO_DATA_DIR || "./data"}/database.sqlite`,
  },
});
