import path from "node:path";
export const cloud = process.env.CAMPO_STORAGE === "supabase";
export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.CAMPO_DATA_DIR || "./data",
);
