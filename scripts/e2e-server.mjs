import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
const testDataDir = mkdtempSync(path.join(tmpdir(), "campo-browser-"));
const child = spawn(process.execPath, ["scripts/serve.mjs", "start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CAMPO_E2E: "1",
    CAMPO_DATA_DIR: testDataDir,
    PORT: "3002",
    CAMPO_PASSWORD: "campo-test-only",
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  rmSync(testDataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
