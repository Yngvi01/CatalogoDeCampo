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
      async () => {
        const body = new FormData();
        for (const p of photos.slice(0, 5)) {
          body.append(
            "images",
            new Blob([new Uint8Array(await photoBytes(p))], {
              type: "image/jpeg",
            }),
            `${p.id}.jpg`,
          );
          body.append("organs", p.organ || "auto");
        }
        const raw = await fetchJson<PlantResult>(
          `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(process.env.PLANTNET_API_KEY!)}&include-related-images=true&lang=pt`,
          { method: "POST", body },
        );
        const candidates: Candidate[] = (raw.results || [])
          .slice(0, 8)
          .map((r) => ({
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
      },
      refresh,
      30 * 86400000,
    );
  },
};
