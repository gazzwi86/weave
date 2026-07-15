---
type: ADR
title: "ADR-022: cytoscape-edgehandles params — library defaults, not prototype-ported (TASK-023 AC-6)"
description: "TASK-023's Design Decisions table calls for porting cytoscape-edgehandles params from
  the prototype; Engineer Law 12 forbids the Engineer reading prototype/ directly and no
  Architect-extracted spike artifact exists for edgehandles (unlike fcose's TASK-001 precedent).
  Published cytoscape-edgehandles library defaults are used instead, disclosed here."
tags: [constitution-engine, adr, task-023, edgehandles, draw-edge]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-022-edgehandles-params-library-defaults.md
date: 2026-07-11
entity: constitution-engine
---

# ADR-022: cytoscape-edgehandles params — library defaults, not prototype-ported (TASK-023 AC-6)

## Status

Accepted (Engineer-disclosed substitution, TASK-023).

## Context

TASK-023's Design Decisions table says: "Port params from prototype into `config.edgehandles_params`;
tunable." Engineer Law 12 ("Never read files from `prototype/`") blocks the Engineer from reading
`prototypes/weave-prototype/` directly to extract those values — only the Architect may pull
prototype context into a task brief. Unlike `cytoscape-fcose` (TASK-001's benchmark spike produced
`fcose-params.mjs`, later reconciled against the real prototype values by the coordinator under
Architect authority — see GE-TASK-001's escalation), no equivalent spike or extracted-params artifact
exists for `cytoscape-edgehandles` anywhere in this repo.

## Decision

Use the published `cytoscape-edgehandles` npm package's documented defaults
(`packages/frontend/lib/explorer/edgehandles-params.ts`), disclosed here rather than guessed
silently — the same substitution shape as GE-TASK-001's fcose fallback. `canConnect` (self-loop
block) is stated explicitly even though it matches the library default, so AC-6's "self-loops SHALL
be blocked at drag time" requirement is legible in the codebase as documented intent, not an unread
default a future reader could accidentally remove believing it unused.

## Consequences

- Draw-edge (AC-6) ships with reasonable, published defaults (`hoverDelay: 150`, `snap: true`,
  `snapThreshold: 50`) rather than blocking on an unavailable artifact.
- If the prototype's actual tuned values differ materially (visual feel, snap distance), a follow-up
  task can extract them the same way TASK-001's coordinator-assisted reconciliation did — this is a
  cosmetic/UX tuning gap, not a functional one; AC-6's behavioural requirements (drag-releases-commits,
  self-loop-blocked) hold regardless of these specific numeric values.
- Logged as a QA-ledger-visible substitution so a spec-conformance audit finds a disclosed decision,
  not silent drift.

## Alternatives Considered

- **Read `prototypes/weave-prototype/` directly for the real values.** Rejected: Law 12 forbids this
  at the Engineer altitude; would repeat the exact violation GE-TASK-001 declined to make.
- **Block TASK-023 pending an Architect-extracted `edgehandles-params` artifact.** Rejected: AC-6 is
  fully implementable and testable with library defaults; blocking the whole task on a missing
  numeric-tuning artifact is disproportionate. Flagged instead for optional follow-up.
- **Invent plausible-looking numbers presented as "prototype params."** Rejected: this would be an
  undisclosed guess dressed as fact — the harness's Law 11 explicitly requires stopping and
  disclosing rather than assuming.
