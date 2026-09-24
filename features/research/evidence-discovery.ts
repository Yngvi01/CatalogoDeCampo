import { libraryEntries } from "@/features/library/entries";
import type { Catalog, EffectClaim, Evidence, Species, Compound } from "@/lib/validation/schemas";
import { normalize } from "@/lib/utils";
import { effectLabels } from "./effects";

export type DiscoveryFilters = {
  query: string;
  effect: EffectClaim["kind"] | "all";
  context: EffectClaim["context"] | "all";
  studyType: EffectClaim["type"] | "all";
  onlyRs: boolean;
  onlySourced: boolean;
};

export type EvidenceRelation = {
  species: Species;
  compound: Compound;
  occurrences: Evidence[];
  claims: EffectClaim[];
  sourcedOccurrence: Evidence | undefined;
  hasBothSources: boolean;
};

const rsSpeciesNames = new Set(libraryEntries.filter(entry => entry.scope === "species")
  .flatMap(entry => [entry.scientificName, ...(entry.aliases || [])]).map(normalize));

export const hasRsLibraryEntry = (species: Species) =>
  [species.scientificName, species.acceptedName, ...species.synonyms].some(name => rsSpeciesNames.has(normalize(name)));

// A URL on an automatic or personal note is not a reviewed occurrence claim.
const reviewedSource = (item: Evidence) => Boolean(item.url && item.source &&
  (item.origin === "publication" || item.origin === "confirmed"));

export function discoverEvidenceRelations(data: Pick<Catalog, "species" | "compounds" | "evidence">, filters: DiscoveryFilters): EvidenceRelation[] {
  const speciesById = new Map(data.species.map(item => [item.id, item]));
  const compoundsById = new Map(data.compounds.map(item => [item.id, item]));
  const byPair = new Map<string, EvidenceRelation>();

  for (const occurrence of data.evidence) {
    if (!occurrence.compoundId) continue;
    const species = speciesById.get(occurrence.speciesId);
    const compound = compoundsById.get(occurrence.compoundId);
    if (!species || !compound) continue;
    const key = `${species.id}:${compound.id}`;
    let relation = byPair.get(key);
    if (!relation) {
      relation = { species, compound, occurrences: [], claims: [], sourcedOccurrence: undefined, hasBothSources: false };
      byPair.set(key, relation);
    }
    relation.occurrences.push(occurrence);
  }

  return [...byPair.values()].filter(relation => {
    if (filters.onlyRs && !hasRsLibraryEntry(relation.species)) return false;
    if (filters.query && !normalize([
      relation.species.scientificName, relation.species.acceptedName, ...relation.species.commonNames,
      relation.compound.name, relation.compound.chemicalClass, ...relation.compound.synonyms,
      ...Object.entries(effectLabels).filter(([kind]) => relation.compound.effectClaims.some(claim => claim.kind === kind)).map(([, label]) => label),
    ].join(" ")).includes(normalize(filters.query))) return false;
    relation.claims = relation.compound.effectClaims.filter(claim =>
      (filters.effect === "all" || claim.kind === filters.effect) &&
      (filters.context === "all" || claim.context === filters.context) &&
      (filters.studyType === "all" || claim.type === filters.studyType));
    if ((filters.effect !== "all" || filters.context !== "all" || filters.studyType !== "all") && !relation.claims.length) return false;
    relation.sourcedOccurrence = relation.occurrences.find(reviewedSource);
    relation.hasBothSources = Boolean(relation.sourcedOccurrence && relation.claims.length);
    return !filters.onlySourced || relation.hasBothSources;
  }).sort((a, b) => Number(b.hasBothSources) - Number(a.hasBothSources) ||
    a.species.scientificName.localeCompare(b.species.scientificName, "pt-BR") ||
    a.compound.name.localeCompare(b.compound.name, "pt-BR"));
}
