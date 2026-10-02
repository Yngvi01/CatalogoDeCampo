import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";
for (const f of process.env.CAMPO_E2E ? [] : [".env.local", ".env"])
  try {
    loadEnvFile(f);
  } catch {}
const mode = process.argv[2] || "dev",
  lan = process.argv.includes("--lan");
if (lan && !process.env.CAMPO_PASSWORD && process.env.CAMPO_AUTH !== "supabase") {
  console.error(
    "Defina CAMPO_PASSWORD em .env.local antes de iniciar na rede local.",
  );
  process.exit(1);
}
const child = spawn(
  "pnpm",
  ["exec", "next", mode, "--hostname", lan ? "0.0.0.0" : "127.0.0.1"],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
