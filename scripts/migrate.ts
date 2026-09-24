import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
async function main() {
  if (process.env.CAMPO_STORAGE === "supabase")
    throw new Error(
      "Aplique supabase/migrations com o Supabase CLI (db push). Não execute migrations SQLite na nuvem.",
    );
  await import("../lib/db/local");
  console.log("Banco local pronto e migrations aplicadas.");
}
main();
