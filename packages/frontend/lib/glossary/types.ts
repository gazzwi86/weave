/** One glossary term row, shared shape for both search and browse results. */
export interface GlossaryTermRow {
  iri: string;
  prefLabel: string;
  definition: string | null;
  /** Punned `owl:Class` typing (decision B1, TASK-001) -- "also a class". */
  isOwlClass: boolean;
}

export interface GlossaryBrowseRow extends GlossaryTermRow {
  broaderIris: string[];
  narrowerIris: string[];
}

export type GlossaryFetchResult<T> = { type: "ok"; rows: T[] } | { type: "error"; status: number };
