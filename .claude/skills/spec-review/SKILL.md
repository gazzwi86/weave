---
name: spec-review
description: Review a target entity's specification documents (brief, PRD, roadmap, tech spec, task briefs, standards) for completeness, consistency, and implementation-readiness. Invoked by /implement when it first targets an entity — or after that entity's specs change (implement Step 1.5) — and standalone via /spec-review [<entity>]. With no entity it reviews every spec. The harness has multiple engines/specs reviewed across multiple runs, so this is per-target, not once-per-repo.
---

# Spec Review

Review specification documents for completeness, consistency, and implementation-readiness, so the build runs against solid specs. Scope is **per entity**: review the engine/spec `/implement` is currently targeting, not the whole repo, unless no entity is given.

## Trigger

- Called by `/implement` (Step 1.5) for the entity it is about to implement, when that entity has
  not been reviewed yet OR its specs changed since the last review. On the first run this also
  precedes scaffolding.
- Standalone: `/spec-review [<entity>]` — pass an entity (e.g. `constitution-engine`) to scope the
  review; omit it to review every entity.

## Step 0: Resolve scope

If an `<entity>` argument is given (or `/implement` passes the current target entity), review only
that entity's specs under `docs/specs/.../<entity>/...` (+ the shared standards). With no entity,
review all entities. State the resolved scope before proceeding.

## Instructions

Review each spec category in order. Present findings incrementally — one category at a time with a summary before moving to the next.

### Step 1: Announce Review Plan

Before reviewing, tell the user what will be checked:

```
Spec Review: I will review your specifications in this order:
1. Brief — mission, scope, success criteria completeness
2. PRD — user stories, AC coverage, requirements traceability
3. Roadmap — phases, HITL gates, entry/exit criteria
4. Tech Spec — architecture, API, data model, diagrams, testing strategy
5. Task Briefs — DoR compliance, test requirements, self-containment
6. Standards — linting, testing, git workflow, code style

Each category will be reviewed and summarised before moving to the next.
```

### Step 1b: Cascade Gate Checks (blocker gates between spec phases)

Each transition in the spec cascade (Brief → PRD → Roadmap → Arch → Implementation) has a
small set of **hard blockers**. A downstream artifact must not be trusted while its upstream
gate is red. Evaluate only the gates relevant to the artifacts that exist; report each as
PASS / BLOCKED with the specific missing item.

These gates are *retrospective* here (spec-review runs before scaffolding). The *forward*
gate for each transition lives at the entry of the consuming skill (e.g. `po-prd` reads the
brief; `arch-stack` reads the PRD). This step is the single place that audits all of them at once.

| Transition | Hard blockers (all must hold) |
|---|---|
| 01→02 Brief→PRD | Brief has Mission, Problem, Scope (in + out), Target Users, ≥3 measurable Success Criteria, Constraints; entity boundary is unambiguous; OKF `type` frontmatter present |
| 02→03 PRD→Roadmap | Every epic has ≥1 user story; every story + FR AC is EARS; no orphan FR (each maps to a story); NFRs present; risks + dependencies listed |
| 03→04 Roadmap→Arch | Every milestone (`M1` / `M2` / `v1.0` / `post-v1`) has a falsifiable Goal; **every epic carries a milestone tag** (no untagged or legacy "Phase: MVP" epics); every gate has entry/exit criteria; no milestone contradicts a brief Out-of-Scope item; nothing tagged `M1` exceeds the thin-proof scope in `weave-spec.md` §1.3 |
| 04→Impl Arch→Implementation | Tech-spec shards present (architecture, data-model, testing-strategy); every task is sized (S/M/L) and has `blocked_by`/`unlocks`; DoR verdict is READY (delegate to `arch-dor` / `/implement` Step 3 — do not re-derive here) |

For any BLOCKED gate, name the exact missing item and the file it belongs in. A blocked
upstream gate is a critical gap (Step 3), not a warning.

### Step 2: Review Each Category

For each category, read the relevant content and check. Brief / PRD / Epics / Roadmap are now
`##`/`###` **sections within the single file** `docs/specs/weave/engines/<entity>.md` (check the
section is present and complete, not that a separate file exists); Tech Spec / Tasks / ADRs are
**files** under `docs/specs/weave/engines/<entity>/` — `tech-spec/` and `decisions/` (engine-level living artifacts) and `<milestone>/tasks/` (milestone-scoped; the active milestone today is m1).

**Brief** (`## Brief` in `docs/specs/weave/engines/<entity>.md`):
- [ ] Mission statement present and clear
- [ ] Problem defined
- [ ] Scope: in-scope and out-of-scope defined
- [ ] Target users identified
- [ ] Success criteria are measurable
- [ ] Key decisions logged with rationale

**PRD** (`docs/specs/weave/engines/<entity>.md`):
- [ ] All epics have user stories
- [ ] Every user story has acceptance criteria in EARS notation (`WHEN [event] THE SYSTEM SHALL [behaviour]`) — not Given/When/Then Gherkin (Weave standard; see po-prd)
- [ ] Functional requirements map to epics
- [ ] Non-functional requirements defined (quality, usability, portability)
- [ ] Risks identified with mitigations
- [ ] Dependencies listed

**Roadmap** (`docs/specs/weave/engines/<entity>.md`):
- [ ] Milestones (`M1` / `M2` / `v1.0` / `post-v1`) defined with clear, falsifiable goals
- [ ] HITL gates have entry/exit criteria
- [ ] **Every epic carries a milestone tag** (M1/M2/v1.0/post-v1) — flag any untagged epic or any
      stale "Phase: MVP" label; M1 must not exceed the thin-proof scope in `weave-spec.md` §1.3
- [ ] Timeline is realistic; cross-engine sequence matches `weave-spec.md` §1.2 waves

**Tech Spec** (`docs/specs/weave/engines/<entity>/tech-spec/*`):
- [ ] Architecture: C4 diagrams present (all 4 levels)
- [ ] OpenAPI: all endpoints from PRD covered
- [ ] Data model: ERD matches API contracts
- [ ] Business process: flows for all user stories
- [ ] Class diagram: component structure defined
- [ ] CI/CD: pipeline stages defined
- [ ] Testing strategy: frameworks, coverage targets, per-task format
- [ ] DoR/DoD: checklists are actionable

**Task Briefs** (`docs/specs/weave/engines/<entity>/<milestone>/tasks/*.md`):
- [ ] Every task has: user story, AC, pseudocode, API contracts, diagram refs, design decisions, DoR/DoD, test requirements, implementation hints
- [ ] Every AC uses EARS notation (`WHEN [event] THE SYSTEM SHALL [behaviour]`) and has at least one named test in the AC-to-Test Mapping table
- [ ] Test requirements: named scenarios, type counts, AC-to-test mapping
- [ ] Tasks are self-contained (no external context needed)
- [ ] DoR checklist is satisfiable
- [ ] `adr_refs` frontmatter field is present; if ADRs exist in `docs/specs/weave/engines/<entity>/decisions/`, every task brief must have at least one `adr_refs` entry — flag tasks with `adr_refs: []` when ADRs exist

**Standards** (`docs/standards/*`):
- [ ] Git workflow defined (including pre-commit/pre-push hooks)
- [ ] Code style defined
- [ ] Testing patterns defined
- [ ] Testing thresholds defined
- [ ] Linting thresholds defined
- [ ] Patterns to leverage and avoid are documented (eg adopt atomic design)

### Step 3: Present Results

After each category, present findings via AskUserQuestion:
- **Pass** — no issues found, move to next category
- **Warnings** — non-blocking issues noted (list them)
- **Critical gaps** — must be resolved before implementation (list them)

### Step 4: Final Summary

```
Spec Review Complete:
- Brief:        ✓ Pass / ⚠ Warnings / ✗ Gaps
- PRD:          ✓ Pass / ⚠ Warnings / ✗ Gaps
- Roadmap:      ✓ Pass / ⚠ Warnings / ✗ Gaps
- Tech Spec:    ✓ Pass / ⚠ Warnings / ✗ Gaps
- Task Briefs:  ✓ Pass / ⚠ Warnings / ✗ Gaps
- Standards:    ✓ Pass / ⚠ Warnings / ✗ Gaps

Critical gaps: {count} — must resolve before scaffolding
Warnings: {count} — noted, can proceed with caution
```

If critical gaps > 0, recommend running `/architect` to address them.

## Evaluation Criteria

When testing this skill, verify:
- All 6 categories are reviewed
- Findings are specific and actionable (not generic)
- Critical vs warning distinction is correct
- Incremental presentation (one category at a time)
- Does not hallucinate issues — only reports what's actually missing
