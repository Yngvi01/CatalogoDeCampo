import type { Candidate, Observation, Photo } from "../validation/schemas";
export interface IdentificationProvider {
  id: string;
  identify(
    observation: Observation,
    photos: Photo[],
    refresh?: boolean,
  ): Promise<{ candidates: Candidate[]; raw: unknown; queriedAt?: string }>;
}
export interface TaxonomyProvider {
  id: string;
  taxonomy(name: string, refresh?: boolean): Promise<SourceResult>;
}
export interface OccurrenceProvider {
  id: string;
  occurrences(
    name: string,
    observation: Observation,
    refresh?: boolean,
  ): Promise<SourceResult>;
}
export interface LiteratureProvider {
  id: string;
  search(
    names: string[],
    topics: string[],
    refresh?: boolean,
  ): Promise<Paper[]>;
}
export type SourceResult = {
  provider: string;
  url: string;
  queriedAt: string;
  status: "ok" | "unavailable" | "manual";
  data: unknown;
  message?: string;
};
export type Paper = {
  id: string;
  title: string;
  authors: string;
  year: string;
  doi: string;
  url: string;
  abstract: string;
  query: string;
};
