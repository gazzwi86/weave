# Ontology & semantic-web rules

Weave's model layer is the full W3C semantic web stack. Non-negotiable choices:

- **Ontology:** OWL 2 DL. **Serialisation:** Turtle is canonical — never check in N-Triples or
  RDF/XML as primary source.
- **Validation:** SHACL shapes. **Provenance:** PROV-O. **Vocabulary:** SKOS.
- **Query:** SPARQL 1.1 + SPARQL Update. **EA notation:** ArchiMate 3.

Weave ships a process-centric **BPMO** ("business brain") as the universal *upper framework* — a
grammar, **not** a populated client taxonomy. Do not hard-code domain-specific classes into the
shipped ontology. The canonical kind/relationship set is served by the engine at
`GET /api/ontology/types` (contract `CE-READ-1` in `docs/specs/weave/contracts.md`) — treat that
endpoint as authoritative, never a hand-copied list. Rationale: `.claude/memory/decision_ontology-bpmo.md`.

Full conventions (IRI/prefix rules, shape patterns, provenance structure) live in
`docs/standards/semantic-web.md`.
