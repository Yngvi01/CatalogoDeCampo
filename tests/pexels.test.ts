import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("Pexels: cache compartilhado, URLs seguras e fallback sem novas consultas", async () => {
  const temp = mkdtempSync(path.join(tmpdir(), "campo-pexels-"));
  process.env.CAMPO_DATA_DIR = temp;
  process.env.CAMPO_STORAGE = "local";
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.PEXELS_API_KEY;
  const { getNaturePhotos } = await import("../lib/providers/pexels");
  const { query, closeDatabase } = await import("../lib/db");
  try {
    delete process.env.PEXELS_API_KEY;
    assert.deepEqual(await getNaturePhotos(), { photos: [] });
    process.env.PEXELS_API_KEY = "test-pexels-secret";
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      assert.equal(new Headers(options?.headers).get("Authorization"), "test-pexels-secret");
      return Response.json({ photos: [
        { id: 1, url: "https://www.pexels.com/photo/1/", photographer: "Photographer", alt: "Forest", src: { landscape: "https://images.pexels.com/photos/1/test.jpg" } },
        { id: 2, url: "javascript:alert(1)", photographer: "Unsafe", src: { landscape: "https://untrusted.example/photo.jpg" } },
      ] });
    };
    const [first, parallel] = await Promise.all([getNaturePhotos(), getNaturePhotos()]);
    assert.equal(calls, 2);
    assert.equal(first.photos.length, 1);
    assert.deepEqual(first, parallel);
    assert.deepEqual(await getNaturePhotos(), first);
    assert.equal(calls, 2);
    assert.equal(JSON.stringify(first).includes("test-pexels-secret"), false);
    await query("UPDATE cache SET expires_at = $1 WHERE provider = $2", [0, "pexels-nature"]);
    globalThis.fetch = async () => { calls++; return new Response("Unavailable", { status: 429 }); };
    assert.deepEqual(await getNaturePhotos(), first);
    const failedCalls = calls;
    assert.deepEqual(await getNaturePhotos(), first);
    assert.equal(calls, failedCalls);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey) process.env.PEXELS_API_KEY = oldKey;
    else delete process.env.PEXELS_API_KEY;
    await closeDatabase();
    rmSync(temp, { recursive: true, force: true });
  }
});
