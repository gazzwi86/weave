---
name: spec-review
description: Review all specification documents for completeness, consistency, and implementation-readiness. Invoked by /implement before scaffolding, or standalone via /spec-review.
---

# Spec Review

Review all specification documents for completeness, consistency, and implementation-readiness. Used by the implementor before scaffolding to ensure specs are solid.

## Trigger

- Called by `/implement` before scaffolding (first run)
- Can be invoked standalone: `/spec-review`

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

### Step 2: Review Each Category

For each category, read the relevant files and check:

**Brief** (`.claude/specs/<entity>/01-brief/brief.md`):
- [ ] Mission statement present and clear
- [ ] Problem defined
- [ ] Scope: in-scope and out-of-scope defined
- [ ] Target users identified
- [ ] Success criteria are measurable
- [ ] Key decisions logged with rationale

**PRD** (`.claude/specs/<entity>/02-prd/prd.md`):
- [ ] All epics have user stories
- [ ] Every user story has acceptance criteria in Given/When/Then
- [ ] Functional requirements map to epics
- [ ] Non-functional requirements defined (quality, usability, portability)
- [ ] Risks identified with mitigations
- [ ] Dependencies listed

**Roadmap** (`.claude/specs/<entity>/03-roadmap/roadmap.md`):
- [ ] Phases defined with clear goals
- [ ] HITL gates have entry/exit criteria
- [ ] Epics assigned to phases
- [ ] Timeline is realistic

**Tech Spec** (`.claude/specs/<entity>/04-arch/tech-spec/*`):
- [ ] Architecture: C4 diagrams present (all 4 levels)
- [ ] OpenAPI: all endpoints from PRD covered
- [ ] Data model: ERD matches API contracts
- [ ] Business process: flows for all user stories
- [ ] Class diagram: component structure defined
- [ ] CI/CD: pipeline stages defined
- [ ] Testing strategy: frameworks, coverage targets, per-task format
- [ ] DoR/DoD: checklists are actionable

**Task Briefs** (`.claude/specs/<entity>/04-arch/tasks/*.md`):
- [ ] Every task has: user story, AC, pseudocode, API contracts, diagram refs, design decisions, DoR/DoD, test requirements, implementation hints
- [ ] Test requirements: named scenarios, type counts, AC-to-test mapping
- [ ] Tasks are self-contained (no external context needed)
- [ ] DoR checklist is satisfiable

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
