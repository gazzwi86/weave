---
type: Decision
title: "ADR-022: Glossary create form is a focused local component, not a `GuidedForm` reuse"
description: "TASK-002's implementation hint says reuse M1 TASK-006's GuidedForm (SHACL shape ->
  form fields) for glossary term creation. GuidedForm's `add_node` builder emits plain-string
  properties and never sets `additional_types`. GlossaryTermShape (TASK-001) requires a mandatory
  punned `owl:Class` type (`additional_types`) and lang-tagged `skos:prefLabel` values
  (`[{value, lang}]`), neither of which GuidedForm's generic field model can produce. This ADR
  records the deviation: a small glossary-only create form, not an extension of the shared
  GuidedForm."
tags: [decision, adr, constitution-engine, glossary, forms, task-002]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-022-glossary-create-form-not-guided-form.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-11
owner: gazzwi86
coverage: constitution-engine
---

# ADR-022: Glossary create form is a focused local component, not a `GuidedForm` reuse

## Status

**Accepted** — 2026-07-11.

## Context

TASK-002's implementation hint: "reuse guided-form (SHACL shape -> form fields, M1 TASK-006) for
create form -- GlossaryTermShape already declares required fields; do not hand-code form."

`GuidedForm` (`app/ce/chat/guided-form.tsx`) generically projects a kind's SHACL shape into plain
text fields and builds a single `add_node` op with `properties: Record<string, unknown>` (each
value a bare string).

`GlossaryTermShape` (TASK-001, `framework.shacl.ttl`) requires two things `GuidedForm` cannot
express:

1. A mandatory punned `rdf:type owl:Class` (`sh:hasValue owl:Class`, `minCount 1`) -- carried on
   the wire as the `add_node` op's `additional_types` array, a field `GuidedForm`'s builder never
   sets.
2. `skos:prefLabel` with `sh:uniqueLang true` -- the backend integration test
   (`test_glossary_apply.py`) proves the property value must be sent as
   `[{value, lang}]`, not a bare string, so the language tag reaches the SHACL validator and the
   `sh:uniqueLang` violation message enrichment (`shacl.py::_enrich_unique_lang_message`) can name
   the colliding language back to the UI (AC-002-04).

Extending `GuidedForm` to carry both of these would add glossary-only branches to a component
shared by every other kind's create flow in the chat panel -- widening its blast radius for a
single caller's needs.

## Decision

Ship a focused `GlossaryCreateForm` (`app/ce/glossary/glossary-create-form.tsx`) with two fixed
fields (preferred label + language, definition), reusing `GuidedForm`'s proven sub-patterns
(the `path -> message` violation-to-field-error map, `Input`/`Button` design-token components,
loading/submitting state shape) but not the component itself. It POSTs directly to the same
`/api/operations/apply` CE-WRITE-1 proxy `GuidedForm` uses, so no new backend or proxy contract is
introduced.

## Consequences

- `GuidedForm` is untouched -- zero risk to the M1 chat/authoring flows already built on it.
- The glossary create form is a small, isolated file whose only consumer is the glossary page.
- If a second SKOS-like punned-kind create flow appears later, the punning/lang-literal pattern
  extracted here (not the component) is the thing to generalise into `GuidedForm`, not before.
