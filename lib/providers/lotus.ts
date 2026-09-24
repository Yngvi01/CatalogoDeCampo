import { cached } from "./cache";

export type LotusReference = { label: string; url: string | null };
export type LotusTaxon = {
  name: string;
  rank: "species" | "genus";
  references: LotusReference[];
};
export type LotusHit = {
  lotusId: string;
  name: string;
  formula: string;
  inchiKey: string;
  chemicalClass: string;
  url: string;
  taxa: LotusTaxon[];
};
export type LotusSearch = {
  mode: "plant" | "compound";
  query: string;
  totalProducts: number;
  hits: LotusHit[];
};

type UpstreamTaxon = {
  species?: string | null;
  genus?: string | null;
  organism_value?: string | null;
  kingdom?: string | null;
};
type UpstreamProduct = {
  lotus_id?: string;
  traditional_name?: string;
  iupac_name?: string;
  molecular_formula?: string;
  inchikey?: string;
  chemicalTaxonomyNPclassifierClass?: string;
  taxonomyReferenceObjects?: Record<string, Record<string, UpstreamTaxon[]>>;
};

const clean = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const validLotusId = (value: string) => /^LTS\d{5,12}$/.test(value);
const doi = (raw: string): LotusReference => {
  const label = raw.replaceAll("$x$x$", ".");
  return /^10\.\d{4,9}\/[^\s]+$/i.test(label)
    ? { label: `DOI ${label}`, url: `https://doi.org/${encodeURIComponent(label)}` }
    : { label: "Referência no LOTUS", url: null };
};

function taxaFor(product: UpstreamProduct): LotusTaxon[] {
  const names = new Map<string, { name: string; rank: "species" | "genus"; refs: Map<string, LotusReference> }>();
  for (const [reference, systems] of Object.entries(product.taxonomyReferenceObjects || {})) {
    const records = systems["GBIF Backbone Taxonomy"] || systems.NCBI || systems.iNaturalist || Object.values(systems)[0] || [];
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (!record || !/^(plantae|viridiplantae|archaeplastida)$/i.test(String(record.kingdom || ""))) continue;
      const species = String(record.species || "").trim();
      const genus = String(record.genus || "").trim();
      const name = species || genus;
      if (!name) continue;
      const key = clean(name);
      const item = names.get(key) || { name, rank: species ? "species" as const : "genus" as const, refs: new Map() };
      item.refs.set(reference, doi(reference));
      names.set(key, item);
    }
  }
  return [...names.values()].map(item => ({
    name: item.name,
    rank: item.rank,
    references: [...item.refs.values()].slice(0, 8),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseLotus(data: unknown, mode: "plant" | "compound", query: string): LotusSearch {
  const products = (data as { naturalProducts?: unknown })?.naturalProducts;
  if (!Array.isArray(products)) throw new Error("O LOTUS retornou uma resposta inesperada.");
  const target = clean(query).replace(/ spp\.?$/, "");
  const genusQuery = mode === "plant" && (clean(query).endsWith(" spp.") || !target.includes(" "));
  const hits: LotusHit[] = [];
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const product = raw as UpstreamProduct;
    const id = String(product.lotus_id || "");
    if (!validLotusId(id)) continue;
    let taxa = taxaFor(product);
    if (mode === "plant") taxa = taxa.filter(taxon => genusQuery
      ? clean(taxon.name) === target || clean(taxon.name).startsWith(`${target} `)
      : taxon.rank === "species" && clean(taxon.name) === target);
    if (!taxa.length) continue;
    hits.push({
      lotusId: id,
      name: String(product.traditional_name || product.iupac_name || id).slice(0, 250),
      formula: String(product.molecular_formula || "").slice(0, 100),
      inchiKey: String(product.inchikey || "").slice(0, 100),
      chemicalClass: String(product.chemicalTaxonomyNPclassifierClass || "").slice(0, 250),
      url: `https://lotus.naturalproducts.net/compound/lotus_id/${id}`,
      taxa,
    });
  }
  return { mode, query, totalProducts: products.length, hits: hits.slice(0, 150) };
}

async function limitedJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (response.status === 404) return { naturalProducts: [] };
  if (!response.ok) throw new Error(`LOTUS indisponível (HTTP ${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("LOTUS retornou uma resposta vazia.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 25 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("A busca no LOTUS retornou dados demais. Experimente um nome mais específico.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("O LOTUS retornou JSON inválido. Tente novamente."); }
}

export async function searchLotus(mode: "plant" | "compound", query: string): Promise<LotusSearch> {
  const term = query.trim().replace(/\s+/g, " ");
  if (term.length < 2 || term.length > 120) throw new Error("Informe um nome com 2 a 120 caracteres.");
  const upstreamTerm = mode === "plant" ? term.replace(/ spp\.?$/i, "") : term;
  try {
    return await cached("lotus-occurrence", { mode, term: clean(term) }, async () =>
      parseLotus(await limitedJson(`https://lotus.naturalproducts.net/api/search/simple?query=${encodeURIComponent(upstreamTerm)}`), mode, term),
    false, 14 * 86400000);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
      throw new Error("LOTUS demorou para responder. Tente novamente ou consulte o site da fonte.");
    throw error;
  }
}
