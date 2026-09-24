import { z } from "zod";
import { cached } from "./cache";
import { query } from "../db";
import {
  localReflections,
  type ReflectionsResponse,
} from "@/features/reflections/quotes";

const quotesSchema = z
  .array(
    z.object({
      text: z.string().trim().min(1).max(1200),
      author: z.string().trim().min(1).max(200),
    }),
  )
  .min(1)
  .max(100);
const entrySchema = z.object({
  q: z.string().trim().min(1).max(1200),
  a: z.string().trim().min(1).max(200),
});
let pending: Promise<ReflectionsResponse> | undefined;
let retryAfter = 0;

async function fallback(): Promise<ReflectionsResponse> {
  const [row] = await query<{ data: unknown }>(
    "SELECT data FROM cache WHERE provider = $1 ORDER BY created_at DESC LIMIT 1",
    ["zenquotes"],
  ).catch(() => []);
  if (row) {
    try {
      const result = quotesSchema.safeParse(
        typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      );
      if (result.success) return { quotes: result.data, source: "zenquotes" };
    } catch {
      /* Cache inválido não impede a abertura da página. */
    }
  }
  return { quotes: localReflections, source: "campo" };
}

export async function getReflections(): Promise<ReflectionsResponse> {
  if (pending) return pending;
  if (Date.now() < retryAfter) return fallback();
  pending = (async () => {
    try {
      const quotes = await cached(
        "zenquotes",
        {},
        async () => {
          const response = await fetch("https://zenquotes.io/api/quotes", {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          });
          if (!response.ok) throw new Error("ZenQuotes indisponível.");
          const raw: unknown = await response.json();
          if (!Array.isArray(raw)) throw new Error("Resposta inválida.");
          const seen = new Set<string>();
          const quotes = raw.slice(0, 100).flatMap((item) => {
            const entry = entrySchema.safeParse(item);
            if (!entry.success || /zenquotes/i.test(entry.data.a)) return [];
            const { q, a } = entry.data;
            const key = `${q}\0${a}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [{ text: q, author: a }];
          });
          return quotesSchema.parse(quotes);
        },
        false,
        24 * 60 * 60 * 1000,
      );
      return {
        quotes: quotesSchema.parse(quotes),
        source: "zenquotes" as const,
      };
    } catch {
      // Uma indisponibilidade não dispara novas consultas a cada visita.
      retryAfter = Date.now() + 15 * 60 * 1000;
      return fallback();
    }
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
