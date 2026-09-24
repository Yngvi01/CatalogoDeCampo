import { z } from "zod";
import { cached, redactProviderSecrets } from "./cache";
import { query } from "../db";
import type { NaturePhotosResponse } from "@/features/nature/types";

const pexelsUrl = (host: string) => z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === host;
});
const photoSchema = z.object({
  id: z.number().int().positive(),
  url: pexelsUrl("www.pexels.com"),
  image: pexelsUrl("images.pexels.com"),
  alt: z.string().max(2000),
  photographer: z.string().min(1).max(300),
});
const photosSchema = z.array(photoSchema).min(1).max(80);
let pending: Promise<NaturePhotosResponse> | undefined;
let retryAfter = 0;

async function fallback(): Promise<NaturePhotosResponse> {
  const [row] = await query<{ data: unknown }>(
    "SELECT data FROM cache WHERE provider = $1 ORDER BY created_at DESC LIMIT 1",
    ["pexels-nature"],
  ).catch(() => []);
  try {
    const photos = photosSchema.parse(typeof row?.data === "string" ? JSON.parse(row.data) : row?.data);
    return { photos };
  } catch { return { photos: [] }; }
}

export async function getNaturePhotos(): Promise<NaturePhotosResponse> {
  if (!process.env.PEXELS_API_KEY) return { photos: [] };
  if (pending) return pending;
  if (Date.now() < retryAfter) return fallback();
  pending = (async () => {
    try {
      const photos = await cached("pexels-nature", { version: 2 }, async () => {
        const page = 1 + Math.floor(Date.now() / 86400000) % 10;
        const batches = await Promise.all(["plants", "forest landscape"].map(async (term) => {
          const params = new URLSearchParams({ query: term, orientation: "landscape", per_page: "40", page: String(page), locale: "pt-BR" });
          const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
            headers: { Authorization: process.env.PEXELS_API_KEY!, Accept: "application/json" },
            signal: AbortSignal.timeout(8000), cache: "no-store",
          });
          if (!response.ok) throw new Error("Pexels indisponível.");
          const raw = z.object({ photos: z.array(z.object({
            id: z.number(), url: z.string(), photographer: z.string(),
            alt: z.string().optional(), src: z.object({ original: pexelsUrl("images.pexels.com") }),
          })).max(80) }).parse(redactProviderSecrets(await response.json()));
          return raw.photos.flatMap((photo) => {
            const parsed = photoSchema.safeParse({ id: photo.id, url: photo.url, image: `${photo.src.original.split("?")[0]}?auto=compress&w=1600`,
              alt: photo.alt || "Fotografia de natureza", photographer: photo.photographer });
            return parsed.success ? [parsed.data] : [];
          });
        }));
        return photosSchema.parse([...new Map(batches.flat().map(photo => [photo.id, photo])).values()]);
      }, false, 86400000);
      return { photos: photosSchema.parse(photos) };
    } catch {
      retryAfter = Date.now() + 15 * 60 * 1000;
      return fallback();
    }
  })();
  try { return await pending; } finally { pending = undefined; }
}
