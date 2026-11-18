import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/route";

test("atualização de senha de recuperação não exige e-mail", async () => {
  const keys = ["CAMPO_AUTH", "CAMPO_STORAGE", "SUPABASE_URL", "SUPABASE_ANON_KEY"] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.CAMPO_AUTH = "supabase";
  process.env.CAMPO_STORAGE = "supabase";
  process.env.SUPABASE_URL = "https://auth-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  try {
    const request = new NextRequest("http://localhost/api/auth", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" },
      body: JSON.stringify({ action: "updatePassword", password: "nova-senha-de-teste-123" }),
    });
    const response = await POST(request);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.notEqual(body.error, "Informe um e-mail válido.");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
