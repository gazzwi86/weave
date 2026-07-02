---
type: Decision
title: "ADR-003: Document corpus companion store"
description: "Retain ingested source artefacts (S3 + S3 Vectors embeddings, tenant-prefixed) linked
  to graph entities via prov:used, as a read-side retrieval aid for extraction agents and NL query.
  CE-WRITE-1 remains the sole mutation path."
tags: [weave, adr, constitution-engine, ingest, retrieval]
status: Accepted
timestamp: 2026-07-02T00:00:00Z
resource: docs/specs/weave/decisions/ADR-003-document-corpus.md
source: hand-authored
confirmed_by: gazzwi86
confirmed_on: 2026-07-02
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

# ADR-003: Document corpus companion store

**Status:** Accepted (2026-07-02) · **Owner:** Constitution Engine · **Milestone:** v1.0
(extends EPIC-012 cold-start ingest; FR-043 in `engines/constitution-engine.md`)

## Context

The validated graph is the substrate agents reason in — that is deliberate and unchanged. But two
real needs surfaced in the persona pass ([`personas.md`](../personas.md) §4.1):

1. An agent building the ontology should be able to consult the **original source document** (the
   BPM doc, policy, runbook), not only the triples extracted from it.
2. NL-query answers gain trust when they cite **both** grounded graph IRIs **and** the source
   passage the extraction rests on.

Today nothing survives ingestion except the extracted, validated triples plus PROV-O attribution
pointing at a source that is no longer retrievable.

## Decision

Retain every artefact ingested through EPIC-012:

- **Storage:** original artefact in S3; passage embeddings in **S3 Vectors** — both under the
  tenant prefix scheme of [ADR-001](ADR-001-tenant-isolation.md).
- **Linkage:** each retained artefact is linked to the graph entities extracted from it via
  `prov:used` on the ingest `prov:Activity` (the existing provenance spine, no new linking
  vocabulary).
- **Consumers:** extraction agents (consult the source while proposing), NL query via `CE-READ-1`
  (answers may cite source passages alongside graph IRIs).
- **Read-side only:** corpus retrieval can never mutate the graph. `CE-WRITE-1` remains the sole
  mutation path — CI asserts no corpus-derived write path exists, the same invariant the ingest
  epic already carries.

## Alternatives considered

- **Graph-RAG over raw documents as the primary retrieval substrate** — rejected. It builds a
  parallel, unvalidated answer path that competes with the graph; the moat is the *validated*
  model, not a vector index of prose.
- **No corpus at all (status quo)** — rejected. Extraction quality suffers without source
  consultation, and uncited NL answers undercut the trust story (M2 legibility theme).

## Consequences

- New retrieval infrastructure lands at CE v1.0 with the ingest epic; embedding lifecycle is tied
  to the ingest pipeline (re-embed on re-ingest; delete with tenant deletion).
- The cross-tenant isolation test suite must cover the vector index (a tenant-A passage must never
  surface in tenant-B retrieval) — same bar as ADR-001's graph tests.
- Deferred to tech spec: chunking strategy, embedding model choice, retrieval ranking, and
  citation format in NL-query responses.
