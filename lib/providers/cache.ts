import { professionalAuth, workspaceIdentity } from "../workspace/context";
import { createHash } from "node:crypto";
import { cloud, query as execute } from "../db";
export async function cached<T>(
  provider: string,
  params: unknown,
  fetcher: () => Promise<T>,
  refresh = false,
  ttl = 86400000,
): Promise<T> {
  const query = JSON.stringify(params),
    id = createHash("sha256")
      .update(provider + query)
      .digest("hex");
  const [row] = await execute<{ data: unknown; expires_at: number }>(
    "SELECT data,expires_at FROM cache WHERE id=$1",
    [id],
  );
  if (!refresh && row && Number(row.expires_at) > Date.now())
    return (
      typeof row.data === "string" ? JSON.parse(row.data) : row.data
    ) as T;
  const value = await fetcher();
  if (workspaceIdentity()?.role === "viewer") return value;
  await execute(
    `INSERT INTO cache (id,provider,query,data,created_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(${professionalAuth() ? "organization_id,id" : "id"}) DO UPDATE SET data=excluded.data, created_at=excluded.created_at,expires_at=excluded.expires_at`,
    [
      id,
      provider,
      query,
      cloud ? value : JSON.stringify(value),
      new Date().toISOString(),
      Date.now() + ttl,
    ],
  );
  return value;
}
export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(25000),
    headers: { Accept: "application/json", ...options?.headers },
  });
  if (!response.ok)
    throw new Error(`Serviço externo indisponível (HTTP ${response.status}).`);
  return redactProviderSecrets(await response.json()) as T;
}

// Respostas externas nunca devem preservar credenciais, mesmo se um serviço as ecoar.
export function redactProviderSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    let text = value;
    for (const key of [
      process.env.PLANTNET_API_KEY,
      process.env.PEXELS_API_KEY,
      process.env.SPECIESLINK_API_KEY,
      process.env.CAMPO_PASSWORD,
    ])
      if (key && key.length >= 8) text = text.split(key).join("[redacted]");
    return text;
  }
  if (Array.isArray(value)) return value.map(redactProviderSecrets);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/(apikey|api_key|api-key|password|secret|authorization|access_token)/i.test(
              key,
            ),
        )
        .map(([key, item]) => [key, redactProviderSecrets(item)]),
    );
  return value;
}
