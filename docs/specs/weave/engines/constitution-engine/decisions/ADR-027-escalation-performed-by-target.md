---
type: Decision
title: "ADR-027: escalation(process) resolves via performedBy -- base BPMO has no dedicated escalate-to predicate"
tags: [constitution-engine, decision, adr, authority, escalation, agent-grounding]
status: Accepted
timestamp: 2026-07-12T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-027-escalation-performed-by-target.md
entity: constitution-engine
source: hand-authored
confirmed_by: TASK-010 engineering (advisor-reviewed)
confirmed_on: 2026-07-12
expires_on: 2027-01-08
owner: gazzwi86
coverage: constitution-engine
---

# ADR-027: `escalation(process)` resolves via `performedBy` -- no dedicated escalate-to predicate in M2

## Status

Accepted -- 2026-07-12 (TASK-010, v1/tasks/TASK-010.md, E7-S4).

## Context

TASK-010 requires `escalation(process)` to return the Actor(s) an agent should contact when it
can't proceed alone, from **base BPMO links only** (ADR-013 M2 descope: `performedBy` /
`governedBy` / `accesses`). The base BPMO model (`tech-spec/data-model.md`) has no dedicated
"escalate to" or "exception handler" predicate -- that lives in the post-v1 ODRL Authority
Extension (`HITLTrigger.escalatesTo`, ADR-013).

Of the three base link predicates, only `performedBy` connects a `Process` to an `Actor`:
`governedBy` targets a `Policy`, `accesses` targets a `DataAsset`. Neither of those can produce an
Actor to escalate to.

## Decision

`escalation(process)` resolves to the Actor(s) linked via `<process> weave:performedBy <actor>` --
the same people who perform the process are, in the M2 base-links degrade, who an agent escalates
to. A process with no `performedBy` actor at all returns a coverage-gap row
(`{entity_iri, missing_link: "performedBy"}`) instead of an empty result (FR-036: absent
permission/evidence is never silently "nothing to report").

No deadline evaluation ships (`escalationDeadline` is post-v1 Authority Extension, ADR-013).

## Consequences

- `escalation(process)`'s "who to contact" and `authority(actor, "performedBy", process)`'s
  "who is modelled as performing this" resolve from the exact same triple pattern in M2 -- this is
  an honest degrade, not a design flourish: base BPMO cannot express a distinct escalation
  relationship yet.
- If a client models a process with a `performedBy` actor who is not actually the right escalation
  contact (e.g. a batch job's nominal owner), M2 will name them anyway -- corrected once the
  post-v1 Authority Extension's `HITLTrigger.escalatesTo` ships.
- Implementation: `rdf/agent_grounding.py::escalation_query`.

## Alternatives considered

- **Route escalation through `governedBy` -> `Policy`** -- rejected: `Policy` is not an `Actor`;
  no base predicate connects a `Policy` to a responsible person in M2.
- **Ship no `escalation()` until the Authority Extension lands** -- rejected: AC-010-05 requires it
  in M2, and the `performedBy` degrade is buildable, honest, and fail-closed (coverage-gap, not a
  silent empty result) when unmodelled.
