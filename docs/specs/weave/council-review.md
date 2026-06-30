---
type: Review
title: "Weave Spec — Council Review & Disposition"
description: "Five-seat spec-review council (3 Sonnet + 1 Opus reviewers + orchestrator-assessor) over the refined Weave spec. Records each verdict, the fixes applied now, and the backlog handed to the /architect phase."
tags: [weave, review, council, spec-quality]
status: Draft
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/council-review.md
source: hand-authored
confirmed_by: none
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

# Weave Spec — Council Review & Disposition

Panel selected by **risk surface** (research-informed): Staff Engineer (buildability) · Enterprise
Security/Governance Architect · Product/GTM Strategist · Principal Ontologist (Opus) · orchestrator
as assessor (5th seat). Cross-links: [weave-spec](weave-spec.md) · [contracts](contracts.md).

## Verdicts

| Seat | Verdict | One-line |
|------|---------|----------|
| Staff Engineer | revise | Loop closes, contracts sound, task-brief quality high; 2 CE-spike sequencing fixes |
| Security/Gov | acceptable, revise-before-M1 | Staging credible, audit/deny-default sound; 3 isolation/SSRF gaps |
| Product/GTM | revise | M1 logic sound; positioning under-sells moat; M1≠north-star framing |
| Ontologist (Opus) | revise | Process core coherent + framework genuine; agent-grounding **oversold** vs obpm |

**Affirmed solid (do not churn):** contract set closes the M1 loop · single-mutation
clone→SHACL→commit/422 + PROV-O is textbook · B1 OWL/SKOS punning sound · both SPIKEs are real
go/no-go gates · EARS ACs + AC→test maps + dep chains throughout · cross-tenant tests everywhere ·
brand-gate (M2) and Events (post-v1) deferrals correctly enforced.

## Fixed NOW (applied to the spec)

| # | Finding | Fix |
|---|---------|-----|
| ONT-1/3 | `authority()` oversold — 13 kinds lack Permission/authorityLevel/HITLTrigger/dataClassification; `governedBy`→Policy is prose not enforceable | [contracts](contracts.md) CE-READ-1 rewritten: base framework = `escalation`+`coverage_gap` (M1-credible); full `authority()` needs the **canonical Authority Extension**, else degrades to coverage_gap+deny; Policy edge = *described* rule, SHACL = enforced. New **OQ-AUTH-1**. |
| SEC-2 | NL→SPARQL could be an SSRF bypass | CE-READ-1: ONE SELECT-only + SERVICE-blocked validator covers LLM-generated SPARQL too (test asserted) |
| GTM-1 | M1 proves loop, not north star | weave-spec §1.3: explicit "M1 = mechanism proof on Hammerbarn; north star proven at v1.0"; brownfield bridge named |
| GTM-4/5/7 | Moat under-sold | weave-spec positioning: flywheel endgame + forkable-code anti-lock-in + Fabric reference-client hedge named |
| SEC-1 | OQ-01 isolation mechanism deferred | weave-spec M1 DoR: mechanism **decided before M1** (not deferrable); isolation test must include connector write-path |
| ENG-1/2 | CE spike serializes the "parallel" wave; degrade plan could delete M1 | weave-spec §1.2: parallel-DEV-vs-integration note; spike runs mid-stream; degrade must preserve generate step |
| ENG-5 | Task DoR refs tech-spec files that don't exist | weave-spec M1 DoR: `/architect` tech-spec pass is a hard prerequisite |

## Backlog → /architect phase (genuinely tech-spec-level; not PO-spec edits)

| Ref | Item |
|-----|------|
| OQ-AUTH-1 | Ship the Authority Extension canonical vs document as client extension pattern; split `Actor`→Role + `holdsRole` so the authority chain resolves (ONT-4) |
| OQ-01 | Choose named-graph-per-tenant+rewriting vs store-per-tenant; spec the connector-write isolation test (SEC-1/3) |
| CE TASK-008 | Spec the perf-spike degrade contingency that preserves the M1 loop (ENG-2) |
| GE TASK-001 | Estimate the WebGL renderer-swap rework delta on TASK-002..005 (ENG-3) |
| PLAT audit | Audit-export tenant-scope (workspace-admin = own-tenant only; cross-tenant = operator IAM gate) (SEC-5) |
| v1.0 SOC2 | Concrete data-residency commitment (e.g. EU region option) before EU prospects (SEC-6) |
| ONT-6 | Document which hierarchy (SKOS `broader` vs `rdfs:subClassOf`) an agent reads as "is-a" |
| Build M1 | Consider stubbing dep-summary-handoff + pre-scaffold-review for M1 thinness (ENG-4) |
| Events | Honest template-activation count (1 unconditional, rest conditional) (writer-events flag) |

## Dismissed
- ONT-2 ("CE-FUNCTION-1/automatable not in contracts.md") — **factually wrong**; grep-verified
  present at contracts.md lines 69–139. Reviewer read a stale/wrong copy.
- GTM-2 ("D7 vs §1.3 legibility contradiction") — already resolved in the spec; §1.3 correctly
  places completeness-map + role-home in M2 (only NL-query is M1). Reviewer caught a stale scratchpad note.
