import { cached } from "./cache";

export type PubChemMatch = {
  cid: number;
  name: string;
  formula: string;
  molecularWeight: string;
  inchiKey: string;
  url: string;
};

type Property = {
  CID?: number;
  Title?: string;
  MolecularFormula?: string;
  MolecularWeight?: string;
  InChIKey?: string;
};

export async function searchPubChem(name: string): Promise<PubChemMatch[]> {
  const term = name.trim().replace(/\s+/g, " ");
  if (term.length < 2 || term.length > 120)
    throw new Error("Informe o nome de um composto com 2 a 120 caracteres.");
  return cached("pubchem-compound", { term: term.toLowerCase() }, async () => {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(term)}/property/Title,MolecularFormula,MolecularWeight,InChIKey/JSON`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) return [];
    if (response.status === 429 || response.status === 503)
      throw new Error("PubChem está ocupado. Tente novamente em alguns minutos.");
    if (!response.ok)
      throw new Error(`Não foi possível consultar o PubChem (HTTP ${response.status}).`);
    const data = await response.json() as { PropertyTable?: { Properties?: Property[] } };
    const properties = data.PropertyTable?.Properties;
    if (!Array.isArray(properties))
      throw new Error("O PubChem retornou uma resposta inesperada.");
    return properties.slice(0, 8).filter(p => Number.isSafeInteger(p.CID) && (p.CID || 0) > 0).map(p => ({
      cid: p.CID!,
      name: String(p.Title || term).slice(0, 250),
      formula: String(p.MolecularFormula || "").slice(0, 500),
      molecularWeight: String(p.MolecularWeight || "").slice(0, 100),
      inchiKey: String(p.InChIKey || "").slice(0, 100),
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,
    }));
  }, false, 7 * 86400000);
}
