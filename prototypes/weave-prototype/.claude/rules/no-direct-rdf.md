# Rule: No direct RDF writes outside OntologyStore

**All RDF triple writes must go through `OntologyStore` methods.**

Never write, delete, or update triples directly in routes, services, validation code, or tests. Always call the appropriate `OntologyStore` method.

## What is allowed

```python
# OK — using the store API
store.add_node(...)
store.update_node(...)
store.delete_node(...)
store.add_edge(...)
store.delete_edge(...)
```

## What is not allowed

```python
# NOT OK — writing triples directly
graph.add((subject, predicate, object))
graph.remove((subject, predicate, None))
store._graph.add(...)   # accessing the internal graph directly
```

## Why

`OntologyStore` is the single source of truth for graph mutations. It enforces:
- Consistent IRI construction and `weave:` namespace use.
- Correct reification of annotated edges.
- Partial-update semantics for node edits.
- PROV stamping on approved operations.

Bypassing it creates inconsistencies that are invisible to validation and invisible to PROV history. Any direct triple write is a bug.

## Applies to

All files under `backend/`. Especially `backend/app/api/routes.py`, `backend/app/llm/service.py`, `backend/app/validation/`, and any new modules.

The frontend has no access to the RDF layer at all (it speaks node/edge/kind/relationship-type over HTTP).
