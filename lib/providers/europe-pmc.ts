import type { LiteratureProvider } from "./types";
import { cached, fetchJson } from "./cache";
export const researchTopics = [
  "alkaloids",
  "chemical composition",
  "psychoactive",
  "psychedelic",
  "sedative",
  "anxiolytic",
  "stimulant",
  "tryptamine",
  "ergoline",
  "beta-carboline",
  "toxicity",
];
type Article = {
  id: string;
  source: string;
  title?: string;
  authorString?: string;
  pubYear?: string;
  doi?: string;
  abstractText?: string;
};
export const europePMC: LiteratureProvider = {
  id: "europe-pmc",
  async search(names, topics, refresh) {
    const escape = (s: string) => s.replace(/["\\()]/g, " ");
    const query = `(${names
      .slice(0, 8)
      .map((n) => `"${escape(n)}"`)
      .join(
        " OR ",
      )}) AND (${topics.map((t) => `"${escape(t)}"`).join(" OR ")})`;
    return cached(
      "europe-pmc",
      { query },
      async () => {
        const params = new URLSearchParams({
          query,
          format: "json",
          resultType: "core",
          pageSize: "40",
        });
        const data = await fetchJson<{ resultList?: { result?: Article[] } }>(
          `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`,
        );
        return (data.resultList?.result || []).map((r) => ({
          id: `${r.source}-${r.id}`,
          title: r.title || "Sem título",
          authors: r.authorString || "",
          year: r.pubYear || "",
          doi: r.doi || "",
          url: r.doi
            ? `https://doi.org/${encodeURIComponent(r.doi)}`
            : `https://europepmc.org/article/${r.source}/${r.id}`,
          abstract: (r.abstractText || "").replace(/<[^>]*>/g, ""),
          query,
        }));
      },
      refresh,
    );
  },
};
