# Rule: RDF mechanics stay in the store layer

**The API, LLM service, validation layer, and frontend speak nodes, edges, kinds, and relationship types — not triples, IRIs, graphs, or SPARQL.**

## Layer responsibilities

| Layer | Speaks |
|-------|--------|
| `ontology/store.py` | RDF triples, IRIs, pyoxigraph, SPARQL, rdflib |
| `validation/` | SHACL shapes (internal), structured violations (external) |
| `api/routes.py` | Pydantic models, HTTP requests/responses, JSON |
| `llm/service.py` | `propose_mutations` tool schema, `LlmOperation` structs |
| `frontend/src/` | `Node`, `Edge`, `NodeKind`, `RelationshipType` from `types.ts` |

## What this means in practice

- Routes return `NodeResponse`, `EdgeResponse`, `GlossaryEntry` etc. — not raw RDF or SPARQL results.
- The LLM tool schema uses the `key` fields from `NODE_KINDS` and `RELATIONSHIP_TYPES` in `namespaces.py` (human-readable strings like `"Service"`, `"dependsOn"`), not IRIs.
- Frontend `types.ts` has no RDF vocabulary. Field names like `id`, `label`, `kind`, `relationshipType` are used — not `rdf:type`, `rdfs:label`, or IRI strings.
- Validation violations surface as `{"focus": "...", "path": "...", "message": "..."}` — not SHACL result objects.
- `GET /api/rules` returns structured `{"category": "...", "if": "...", "then": "..."}` objects — not raw SPARQL bindings.

## Why

The frontend and LLM are consumers, not RDF processors. Leaking RDF/SPARQL into those layers:
- Forces every layer to understand ontology semantics.
- Makes the model harder to change (e.g. switching from Oxigraph to another store, or changing IRI patterns).
- Creates an unsafe surface where the LLM could produce malformed IRIs or invalid SPARQL.

The node/edge API is the contract. Keep it stable; change the RDF implementation underneath it freely.
