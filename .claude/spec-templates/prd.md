<!--
EXAMPLES — for the PO agent's reference only.
These do NOT appear in generated prd files (HTML comment block).

<example kind="good-user-story">
As a Versent platform engineer onboarding a new team,
I want one command that scaffolds our standard CI/CD, observability,
and IaC baseline,
so that I don't repeat 4 hours of copy-paste from the last project.

Why good: concrete role, concrete trigger ("onboarding a new team"),
concrete cost ("4 hours"), one named outcome.
</example>

<example kind="bad-user-story">
As a user, I want a fast system, so that I can be productive.

Why bad: "user" is generic, "fast" is unmeasurable, "productive" is
unfalsifiable. The Architect cannot derive AC from this.
</example>

<example kind="good-acceptance-criterion">
- [ ] Given a tenant-A JWT, when an unscoped SPARQL query is issued,
      then zero tenant-B triples are returned (cross-tenant isolation test).

Why good: Given/When/Then, names the precondition, the action, and a
result that can be asserted by a test. A failure is unambiguous.
</example>

<example kind="bad-acceptance-criterion">
- [ ] The system is secure and isolates tenants properly.

Why bad: no observable behaviour, no test. "properly" hides the spec.
</example>

<example kind="good-functional-requirement">
FR-012: Scaffold command MUST accept a `--stack` shortcode flag and
fully pre-fill the stack object without prompting when the shortcode
maps to an entry in `docs/stack-equivalents.md`. Failure mode: an
unrecognised shortcode prints the list of valid shortcodes and exits
non-zero. Acceptance: `scaffold --stack ts-nextjs-aws` produces a
project tree with zero MCQ rounds; `scaffold --stack does-not-exist`
exits 1 within 100ms.
</example>

<example kind="bad-functional-requirement">
FR-012: The CLI should be easy to use and handle errors gracefully.

Why bad: no observable behaviour, no failure mode, no acceptance
condition. The Engineer cannot write a test from this; QA cannot verify it.
</example>

AUTHORING RULES (build-ready bar — the PRD is done when ALL hold):
1. Every FR is testable — phrasable as Given/When/Then. No unfalsifiable
   language ("fast", "robust", "intuitive", "seamless", "by construction").
2. Every number/threshold is either traced to a source (cite it) or marked
   as a configurable DEFAULT ("default X, tunable per <scope>"). No bare,
   unsourced confabulated numbers.
3. Every cross-engine interaction names a concrete contract from
   `docs/specs/_inter-engine-contracts.md` (endpoint, event shape, or store)
   — never just prose. Consumed contracts are pinned to a version.
4. Failure modes and error states are specified per flow, not just the happy path.
5. Security/authz, multi-tenant isolation, and secrets handling are explicit
   where the flow touches them, and name the mechanism + a test.
6. Open questions are resolved or explicitly deferred to the tech spec with an owner.
-->

---
type: PRD
title: {{PROJECT_NAME}} — Product Requirements Document
description: "{{One-line description of this PRD's scope.}}"
tags: [{{entity-slug}}, 02-prd]
status: Draft            # Draft | In Review | Approved
timestamp: {{ISO8601}}
resource: docs/specs/{{entity}}/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored    # graph.json@<sha> | sme-interview | hybrid | seed | hand-authored
confirmed_by: none       # github-handle once a human signs off; "none" => DRAFT banner
confirmed_on: null       # YYYY-MM-DD when confirmed_by is set
last_verified_sha: {{HEAD_SHA}}
expires_on: {{TODAY+180d}}
owner: {{github-handle}}  # who to ping when stale; "orphan" triggers reassignment CI
coverage: n/a            # % of source covered for code-derived docs; n/a otherwise
---

# PRD: {{PROJECT_NAME}}

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** {{MVP | Phase 2 | …}}  ·  **Owner:** {{handle}}  ·  **Last Updated:** {{DATE}}

---

## 1. Product Context

### Background
{{Why are we building this? Business/user context. 1–2 paragraphs.}}

### Goals
1. {{Primary goal}}
2. {{Secondary goal}}

### Non-Goals
1. {{What we're explicitly NOT trying to achieve — and which engine/spec owns it instead}}

---

## 2. Personas & Roles

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| {{Persona}} | {{Who they are}} | {{What they need}} | {{read / author / publish / admin}} |

> Roles here are the source for the RBAC model and any role-tailored behaviour.
> Align role slugs with the platform RBAC model.

---

## 3. User Stories

### Epic 1: {{EPIC_NAME}}

**E1-S1: {{Story title}}**
As a **{{role}}**, I want {{capability}} so that {{benefit}}.
- **AC:** Given {{context}}, when {{action}}, then {{observable result}}.
- **AC:** {{failure-mode AC — what happens when it goes wrong}}.
- **Priority:** Must Have | Should Have | Could Have | Won't Have

---

## 4. Functional Requirements

| ID | Requirement | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | {{Observable behaviour + failure mode + acceptance condition}} | E1-S1 | P0 | MVP |

> "Phase / depends-on" ties each FR to a delivery phase and any engine it
> can't ship before (e.g. "P0 when Build Engine ships"). No FR is unphased.

---

## 5. Inter-engine Interfaces

> The single most important section for build-readiness in a multi-engine system.
> Reference contracts by name from `docs/specs/_inter-engine-contracts.md`.

### Consumed (this engine calls / reads)

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| {{engine}} | {{contract id / endpoint}} | {{version}} | {{why}} |

### Provided (this engine exposes to others)

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| {{contract id / endpoint}} | {{engines}} | {{schema ref}} | {{stable / beta}} |

---

## 6. Non-Functional Requirements

### Performance
- {{p95 / throughput / fps targets — each a configurable default where applicable}}

### Security
- {{authz model, secrets handling (AWS Secrets Manager), input validation at boundaries}}

### Reliability
- {{delivery guarantees, retry/idempotency, DLQ, degradation behaviour}}

### Observability
- {{OTel spans + named attributes, metrics, log correlation}}

### Accessibility
- {{WCAG target + keyboard-nav / ARIA requirements + the zero-violations gate}}

### Isolation & data safety
- {{multi-tenant isolation mechanism (named) + the cross-tenant-read test}}

### Browser / device support
- {{supported platforms}}

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| {{Decision locked during PRD authoring}} | {{Why; cite source/grounding where relevant}} |

---

## 8. Open Questions (for Tech Spec)

| # | Question | Owner |
|---|---|---|
| OQ-01 | {{Deferred decision}} | {{Architect / PO / named team}} |

---

## 9. Acceptance Criteria (PRD-level)

The {{PROJECT_NAME}} PRD is satisfied when:

- [ ] {{Cross-cutting, end-to-end outcome that can fail even when every per-story AC passes}}

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| {{Risk}} | High/Med/Low | High/Med/Low | {{How addressed}} |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- {{links to upstream/downstream specs}}

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
