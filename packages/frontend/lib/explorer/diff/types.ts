/** CE-DIFF-1's flat-triple response shape (CE ADR-002: no reification
 * quads -- `modified[].before/after` are object VALUES for a
 * subject+predicate pair). Canonical in CE `schemas/ontology.py::DiffResponse`. */
export interface DiffTriple {
  subject: string;
  predicate: string;
  object: string;
}

export interface DiffModification {
  subject: string;
  predicate: string;
  before: string;
  after: string;
}

export interface DiffResponse {
  added: DiffTriple[];
  removed: DiffTriple[];
  modified: DiffModification[];
}
