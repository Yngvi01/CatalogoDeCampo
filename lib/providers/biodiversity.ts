import type {
  TaxonomyProvider,
  OccurrenceProvider,
  SourceResult,
  IdentificationProvider,
} from "./types";
import { cached, fetchJson } from "./cache";
import { list } from "../db/repository";
import type { Observation, Species, Candidate } from "../validation/schemas";
import { normalize, distanceKm } from "../utils";
const gbifBase = "https://api.gbif.org/v1";
const floraDataset = "aacd816d-662c-49d2-ad1a-97e66e2a2908";
type Taxon = {
  key: number;
  scientificName: string;
  canonicalName?: string;
  acceptedKey?: number;
  accepted?: string;
  kingdom?: string;
  family?: string;
  genus?: string;
  taxonomicStatus?: string;
  rank?: string;
  matchType?: string;
  confidence?: number;
};
const result = (
  provider: string,
  url: string,
  data: unknown,
): SourceResult => ({
  provider,
  url,
  data,
  status: "ok",
  queriedAt: new Date().toISOString(),
});
export const gbif: TaxonomyProvider & OccurrenceProvider = {
  id: "gbif",
  async taxonomy(name, refresh) {
    return cached(
      "gbif-taxonomy",
      { name },
      async () => {
        const url = `${gbifBase}/species/match?name=${encodeURIComponent(name)}&strict=true`;
        return result("GBIF", url, await fetchJson<Taxon>(url));
      },
      refresh,
    );
  },
  async occurrences(name, o, refresh) {
    return cached(
      "gbif-occurrences",
      {
        name,
        lat: o.latitude,
        lon: o.longitude,
        month: new Date(o.observedAt).getUTCMonth() + 1,
      },
      async () => {
        const params = new URLSearchParams({
          scientificName: name,
          hasCoordinate: "true",
          limit: "5",
        });
        if (o.latitude !== null && o.longitude !== null) {
          params.set(
            "decimalLatitude",
            `${Math.max(-90, o.latitude - 0.25)},${Math.min(90, o.latitude + 0.25)}`,
          );
          params.set(
            "decimalLongitude",
            `${Math.max(-180, o.longitude - 0.25)},${Math.min(180, o.longitude + 0.25)}`,
          );
        } else params.set("country", "BR");
        const url = `${gbifBase}/occurrence/search?${params}`;
        const all = await fetchJson<{ count: number; results: unknown[] }>(url);
        params.set("month", String(new Date(o.observedAt).getUTCMonth() + 1));
        const seasonal = await fetchJson<{ count: number }>(
          `${gbifBase}/occurrence/search?${params}`,
        );
        return result("GBIF", url, {
          count: all.count,
          seasonalCount: seasonal.count,
          scope: o.latitude === null ? "Brasil" : "Caixa geográfica ±0,25°",
          records: all.results,
        });
      },
      refresh,
    );
  },
};
export const flora: TaxonomyProvider = {
  id: "flora-funga-brasil",
  async taxonomy(name, refresh) {
    return cached(
      "flora",
      { name },
      async () => {
        const url = `${gbifBase}/species/search?datasetKey=${floraDataset}&q=${encodeURIComponent(name)}&limit=10`;
        const data = await fetchJson<{ results: Taxon[] }>(url);
        const exact = data.results.filter(
          (t) =>
            normalize(t.canonicalName || t.scientificName) === normalize(name),
        );
        const taxon = exact[0];
        const details = taxon
          ? await Promise.all([
              fetchJson<unknown>(
                `${gbifBase}/species/${taxon.acceptedKey || taxon.key}/synonyms`,
              ),
              fetchJson<unknown>(
                `${gbifBase}/species/${taxon.acceptedKey || taxon.key}/distributions`,
              ),
            ])
          : [];
        return result("Flora e Funga do Brasil · via GBIF", url, {
          taxon: taxon || null,
          synonyms: details[0] || null,
          distribution: details[1] || null,
          message: taxon
            ? "Nome encontrado na lista oficial. Consulte a distribuição para verificar ocorrência nativa ou introduzida."
            : "Sem correspondência exata; isto não demonstra ausência no Brasil.",
        });
      },
      refresh,
    );
  },
};
export const inaturalist: TaxonomyProvider & OccurrenceProvider = {
  id: "inaturalist",
  async taxonomy(name, refresh) {
    return cached(
      "inaturalist-taxa",
      { name },
      async () => {
        const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&per_page=5`;
        return result("iNaturalist", url, await fetchJson<unknown>(url));
      },
      refresh,
    );
  },
  async occurrences(name, o, refresh) {
    return cached(
      "inaturalist-occurrences",
      {
        name,
        lat: o.latitude,
        lon: o.longitude,
        month: new Date(o.observedAt).getUTCMonth() + 1,
      },
      async () => {
        const tax = await fetchJson<{
          results: { id: number; name: string }[];
        }>(
          `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&per_page=5`,
        );
        const exact = tax.results.find(
          (t) => normalize(t.name) === normalize(name),
        );
        if (!exact)
          return result("iNaturalist", "https://www.inaturalist.org", {
            count: null,
            seasonalCount: null,
            message: "Táxon exato não encontrado.",
          });
        const params = new URLSearchParams({
          taxon_id: String(exact.id),
          quality_grade: "research",
          per_page: "5",
        });
        if (o.latitude !== null && o.longitude !== null) {
          params.set("lat", String(o.latitude));
          params.set("lng", String(o.longitude));
          params.set("radius", "25");
        } else params.set("place_id", "6878");
        const url = `https://api.inaturalist.org/v1/observations?${params}`;
        const data = await fetchJson<{
          total_results: number;
          results: unknown[];
        }>(url);
        params.set("month", String(new Date(o.observedAt).getUTCMonth() + 1));
        const seasonal = await fetchJson<{ total_results: number }>(
          `https://api.inaturalist.org/v1/observations?${params}`,
        );
        return result("iNaturalist", url, {
          count: data.total_results,
          seasonalCount: seasonal.total_results,
          scope: o.latitude === null ? "Brasil" : "Raio de 25 km",
          records: data.results,
        });
      },
      refresh,
    );
  },
};
export const specieslink: OccurrenceProvider = {
  id: "specieslink",
  async occurrences(name, o, refresh) {
    const portal = `https://specieslink.net/search/?scientificName=${encodeURIComponent(name)}`;
    if (!process.env.SPECIESLINK_API_KEY)
      return {
        provider: "speciesLink",
        url: portal,
        status: "manual",
        queriedAt: new Date().toISOString(),
        data: null,
        message:
          "Consulte o portal ou configure SPECIESLINK_API_KEY para consultar a API do CRIA.",
      };
    return cached(
      "specieslink",
      { name, lat: o.latitude, lon: o.longitude },
      async () => {
        const params = new URLSearchParams({
          scientificname: name,
          limit: "5",
          offset: "0",
          country: "Brazil",
        });
        if (o.latitude !== null && o.longitude !== null)
          params.set(
            "bbox",
            [
              Math.max(-180, o.longitude - 0.25),
              Math.max(-90, o.latitude - 0.25),
              Math.min(180, o.longitude + 0.25),
              Math.min(90, o.latitude + 0.25),
            ].join(" "),
          );
        params.set("apikey", process.env.SPECIESLINK_API_KEY!);
        const raw = await fetchJson<{
          numberMatched?: number;
          features?: unknown[];
        }>(`https://specieslink.net/ws/1.0/search?${params}`);
        return result("speciesLink", portal, {
          count: raw.numberMatched ?? null,
          scope: o.latitude === null ? "Brasil" : "Caixa geográfica ±0,25°",
          records: raw.features || [],
          message:
            "Registros de coleções científicas. Sazonalidade não consultada nesta fonte.",
        });
      },
      refresh,
    );
  },
};
export const fungi: IdentificationProvider = {
  id: "fungi-context",
  async identify(o, _photos, refresh) {
    if (o.group !== "fungus")
      throw new Error("Provider exclusivo para fungos.");
    const observations = list<Observation>("observations").filter(
      (p) => p.id !== o.id && p.group === "fungus" && p.speciesId,
    );
    const species = list<Species>("species");
    const matches = observations
      .map((p) => ({
        p,
        reasons: [
          p.region && normalize(p.region) === normalize(o.region)
            ? "mesma região"
            : "",
          p.habitat && normalize(p.habitat) === normalize(o.habitat)
            ? "mesmo habitat"
            : "",
          p.substrate && normalize(p.substrate) === normalize(o.substrate)
            ? "mesmo substrato"
            : "",
          new Date(p.observedAt).getMonth() ===
          new Date(o.observedAt).getMonth()
            ? "mesmo mês"
            : "",
          p.latitude !== null &&
          p.longitude !== null &&
          o.latitude !== null &&
          o.longitude !== null &&
          distanceKm(p.latitude, p.longitude, o.latitude, o.longitude) < 25
            ? "até 25 km"
            : "",
          ...Object.entries(o.morphology)
            .filter(
              ([k, v]) =>
                v && normalize(p.morphology[k] || "") === normalize(v),
            )
            .map(([k]) => `morfologia: ${k}`),
        ].filter(Boolean),
      }))
      .filter((m) => m.reasons.length >= 2);
    const ids = [...new Set(matches.map((m) => m.p.speciesId))];
    const candidates: Candidate[] = ids
      .map((id) => species.find((s) => s.id === id))
      .filter((s): s is Species => !!s)
      .map((s) => ({
        scientificName: s.scientificName,
        genus: s.genus,
        family: s.family,
        commonNames: s.commonNames,
        score: null,
        referenceImages: [],
      }));
    let nearby: unknown = {
      message: "Informe coordenadas para buscar registros próximos.",
    };
    if (o.latitude !== null && o.longitude !== null) {
      const params = new URLSearchParams({
        iconic_taxa: "Fungi",
        quality_grade: "research",
        lat: String(o.latitude),
        lng: String(o.longitude),
        radius: "25",
        month: String(new Date(o.observedAt).getUTCMonth() + 1),
        per_page: "8",
      });
      const url = `https://api.inaturalist.org/v1/observations/species_counts?${params}`;
      try {
        const result = await cached(
          "fungi-nearby",
          { lat: o.latitude, lon: o.longitude, month: params.get("month") },
          () =>
            fetchJson<{
              results: {
                count: number;
                taxon: {
                  name: string;
                  rank: string;
                  preferred_common_name?: string;
                };
              }[];
            }>(url),
          refresh,
        );
        nearby = {
          provider: "iNaturalist",
          url,
          queriedAt: new Date().toISOString(),
          scope: "25 km, mesmo mês, observações de grau de pesquisa",
          records: result.results,
        };
        for (const r of result.results)
          if (
            r.taxon.rank === "species" &&
            !candidates.some(
              (c) => normalize(c.scientificName) === normalize(r.taxon.name),
            )
          )
            candidates.push({
              scientificName: r.taxon.name,
              genus: r.taxon.name.split(" ")[0],
              family: "",
              commonNames: r.taxon.preferred_common_name
                ? [r.taxon.preferred_common_name]
                : [],
              score: null,
              referenceImages: [],
            });
      } catch {
        nearby = {
          provider: "iNaturalist",
          url,
          message: "Fonte indisponível. Histórico pessoal preservado.",
        };
      }
    }
    return {
      candidates,
      raw: {
        method:
          "Histórico pessoal: pelo menos dois critérios de contexto iguais. Candidatos adicionais são espécies registradas no iNaturalist a até 25 km, no mesmo mês. Não analisa fotos; proximidade não confirma identidade.",
        nearby,
        matches: matches.map((m) => ({
          code: m.p.code,
          speciesId: m.p.speciesId,
          reasons: m.reasons,
        })),
      },
    };
  },
};
export async function compareSources(
  name: string,
  o: Observation,
  refresh = false,
) {
  const tasks = [
    () => gbif.taxonomy(name, refresh),
    () => flora.taxonomy(name, refresh),
    () => gbif.occurrences(name, o, refresh),
    () => inaturalist.occurrences(name, o, refresh),
    () => specieslink.occurrences(name, o, refresh),
  ];
  const responses = await Promise.allSettled(tasks.map((t) => t()));
  return responses.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : ({
          provider: [
            "GBIF taxonomia",
            "Flora e Funga",
            "GBIF ocorrências",
            "iNaturalist",
            "speciesLink",
          ][i],
          url: "",
          status: "unavailable",
          queriedAt: new Date().toISOString(),
          data: null,
          message: "Não foi possível consultar esta fonte. Tente atualizar.",
        } satisfies SourceResult),
  );
}
