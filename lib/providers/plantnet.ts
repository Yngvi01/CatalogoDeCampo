import type { IdentificationProvider } from "./types";
import { cached, fetchJson } from "./cache";
import { photoBytes } from "../storage/photos";
import type { Candidate } from "../validation/schemas";
type PlantResult = {
  results?: {
    score: number;
    species: {
      scientificNameWithoutAuthor: string;
      genus?: { scientificNameWithoutAuthor: string };
      family?: { scientificNameWithoutAuthor: string };
      commonNames?: string[];
    };
    images?: { url?: { m?: string }; author?: string; license?: string }[];
  }[];
};
export const plantnet: IdentificationProvider = {
  id: "plantnet",
  async identify(o, photos, refresh) {
    if (o.group !== "plant")
      throw new Error("Pl@ntNet é utilizado somente para plantas.");
    if (!process.env.PLANTNET_API_KEY)
      throw new Error(
        "Configure PLANTNET_API_KEY no .env.local para identificar plantas. O registro e a confirmação manual continuam disponíveis.",
      );
    return cached(
      "plantnet",
      photos.map((p) => ({ hash: p.hash, organ: p.organ })),
      async () =>
        identifyPlantBytes(
          await Promise.all(photos.slice(0, 5).map(photoBytes)),
          photos.slice(0, 5).map((p) => p.organ),
        ),
      refresh,
      30 * 86400000,
    );
  },
};

export async function identifyPlantBytes(
  images: Uint8Array[],
  organs: string[] = [],
) {
  if (!process.env.PLANTNET_API_KEY)
    throw new Error(
      "Pl@ntNet não configurado. Você pode continuar com identificação manual.",
    );
  if (!images.length || images.length > 5)
    throw new Error("Envie entre 1 e 5 fotos para identificar.");

  const body = new FormData();
  for (const [index, bytes] of images.entries()) {
    body.append(
      "images",
      new Blob([new Uint8Array(bytes)], {
        type: "image/jpeg",
      }),
      `${index}.jpg`,
    );
    body.append("organs", organs[index] || "auto");
  }
  const raw = await fetchJson<PlantResult>(
    `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(process.env.PLANTNET_API_KEY!)}&include-related-images=true&lang=pt`,
    { method: "POST", body },
  );
  const candidates: Candidate[] = (raw.results || []).slice(0, 8).map((r) => ({
    scientificName: r.species.scientificNameWithoutAuthor,
    genus: r.species.genus?.scientificNameWithoutAuthor || "",
    family: r.species.family?.scientificNameWithoutAuthor || "",
    commonNames: r.species.commonNames || [],
    score: r.score,
    referenceImages: (r.images || [])
      .filter((i) => i.url?.m)
      .slice(0, 2)
      .map((i) => ({
        url: i.url!.m!,
        author: i.author || "",
        license: i.license || "",
      })),
  }));
  return { candidates, raw, queriedAt: new Date().toISOString() };
}
