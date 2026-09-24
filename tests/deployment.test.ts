import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "../app/api/[...path]/route";
import { token } from "../lib/auth";

test("Vercel responde JSON sem inicializar armazenamento local e preserva autorização", async () => {
  const previous = {
    vercel: process.env.VERCEL,
    password: process.env.CAMPO_PASSWORD,
  };
  process.env.VERCEL = "1";
  process.env.CAMPO_PASSWORD = "deployment-test-only";
  const context = { params: Promise.resolve({ path: ["catalog"] }) };
  try {
    const unauthorized = await GET(
      new NextRequest("https://campo.example/api/catalog"),
      context,
    );
    assert.equal(unauthorized.status, 401);
    for (const [method, handler] of Object.entries({ GET, POST, PATCH })) {
      const response = await handler(
        new NextRequest("https://campo.example/api/catalog", {
          method,
          headers: {
            cookie: `campo-session=${token()}`,
            origin: "https://campo.example",
            host: "campo.example",
          },
        }),
        context,
      );
      assert.equal(response.status, 503);
      assert.match(response.headers.get("content-type")!, /application\/json/);
      assert.match((await response.json()).error, /SQLite.*Vercel/);
    }
    const forbidden = await POST(
      new NextRequest("https://campo.example/api/catalog", {
        method: "POST",
        headers: {
          cookie: `campo-session=${token()}`,
          origin: "https://other.example",
          host: "campo.example",
        },
      }),
      context,
    );
    assert.equal(forbidden.status, 403);
  } finally {
    if (previous.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous.vercel;
    if (previous.password === undefined) delete process.env.CAMPO_PASSWORD;
    else process.env.CAMPO_PASSWORD = previous.password;
  }
});
