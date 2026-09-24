import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonResponse } from "../lib/http/response";

test("Respostas vazias, HTML e JSON truncado geram erros legíveis com status HTTP", async () => {
  for (const body of ["", "<html>Internal server error</html>", '{"error":']) {
    await assert.rejects(
      readJsonResponse(new Response(body, { status: 502 })),
      /O servidor retornou uma resposta .*HTTP 502/,
    );
  }
});

test("Preserva erros JSON da API e dados válidos, sem depender do formato do erro", async () => {
  await assert.rejects(
    readJsonResponse(
      Response.json({ error: "Armazenamento indisponível." }, { status: 503 }),
    ),
    /Armazenamento indisponível/,
  );
  await assert.rejects(
    readJsonResponse(Response.json(null, { status: 500 })),
    /HTTP 500/,
  );
  assert.deepEqual(await readJsonResponse(Response.json({ notes: [] })), {
    notes: [],
  });
});
