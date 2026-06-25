---
name: extract-prototype
description: Scans prototype projects, identifies extractable artefacts, elicits from the user what to keep, and updates the main spec. Invoked automatically by the Architect agent when a prototype/ directory exists.
---

# Extract Prototype

Scan prototype projects, identify extractable artefacts, elicit from the user what to keep, and update the main spec. Invoked automatically by the Architect agent when `prototype/` exists.

## Trigger

- Called by `/architect` when `prototype/` directory exists and contains projects
- Not a standalone command — always runs as part of the Architect flow

## Instructions

### Step 1: Scan Prototype Projects

List all directories in `prototype/`. For each project:
1. Read `DECISIONS.md` if present — note approach, assumptions, learnings, recommended extractions
2. Identify artefact types present:
   - E2E tests: count `.spec.ts` / `.test.ts` files in `tests/e2e/`
   - OpenAPI specs: any `.yaml` or `.json` matching OpenAPI structure
   - Component structure: folder hierarchy in `src/` (Atomic Design or other)
   - Data shapes: hardcoded data files, mock response fixtures
   - Dependencies: `package.json` contents
   - Patterns: README, docs, configuration files

### Step 2: Present Findings (Per Project, Incrementally)

For each prototype project, present findings one at a time via AskUserQuestion.

**Overview first:**
```
Prototype: frontend-nextjs/

DECISIONS.md says:
  Approach: Card-based layout with client-side filtering
  Assumptions: Auth is JWT, max 5 product variants
  Recommended: Extract E2E tests + component structure. Don't extract auth flow.

Artefacts found:
  - 4 E2E test files (tests/e2e/)
  - Component structure: atoms(8), molecules(5), organisms(3), pages(4), flows(2)
  - 2 data fixtures (mock responses)
  - package.json: 12 dependencies

What should I extract?
```

Then ask via AskUserQuestion (multiSelect):
- E2E tests → will become task test requirements
- Component structure → will inform class diagrams and code-style
- Data shapes → will inform data model / ERD
- Dependencies → will inform tech stack decisions
- Patterns / ADRs → will create architecture decision records
- Skip this prototype

### Step 3: Extract Selected Artefacts

For each selected artefact type:

**E2E Tests:**
- Read each test file
- Transform into task test requirement format (scenario name, description, expected behaviour)
- Add to relevant task briefs under "Test Requirements" section
- Note: tests stay in prototype/ — the extracted version is a *requirement* not a copy

**Component Structure:**
- Map folder hierarchy to class diagram entries
- Add to `tech-spec/class-diagram.md`
- Extract naming conventions to `standards/code-style.md` if not already there

**Data Shapes:**
- Analyse hardcoded data structure
- Generate or update `tech-spec/data-model.md` with ERD entries
- Flag any shapes that contradict existing data model

**OpenAPI Spec:**
- Read the prototype's OpenAPI yaml/json
- Merge into or replace `tech-spec/openapi.yaml`
- Flag any conflicts with existing spec

**Dependencies:**
- Read package.json
- Identify production dependencies that should be in the main project
- Add to `tech-spec/architecture.md` technology stack section
- Create ADR if a dependency choice is significant

**Patterns / Decisions:**
- Read DECISIONS.md
- Create ADRs for each significant decision
- Flag assumptions for validation: "Prototype assumed X. Confirm or reject before implementation."

### Step 4: Flag Assumptions for Validation

From DECISIONS.md assumptions, present each to the user:
```
Prototype assumed: "Auth is JWT-based"
  → Confirm (add to spec as requirement)
  → Reject (needs different approach in implementation)
  → Defer (decide later during implementation)
```

### Step 5: Summary

After extraction, display:
```
Extraction complete for frontend-nextjs/:
  - 12 test requirements added to task briefs
  - 8 component entries added to class diagram
  - 3 data model entities added to ERD
  - 2 ADRs created (ADR-005: Card layout, ADR-006: Client-side filtering)
  - 1 assumption confirmed, 1 rejected, 1 deferred
```

## Context Rot Prevention

- Implementation agents (Engineer, QA) NEVER read prototype/ directly
- Extracted artefacts are *references* and *requirements* in task briefs, not copies
- prototype/ stays in the repo for human inspection but is invisible to the implementation loop
- Stale prototypes don't affect implementation because the spec is the source of truth

## Evaluation Criteria

- Reads DECISIONS.md before scanning artefacts (context first)
- Presents findings per project incrementally (not all at once)
- User selects what to extract (progressive disclosure)
- Assumptions flagged for explicit validation (confirm/reject/defer)
- Extracted artefacts update the correct spec sections
- ADRs created for significant decisions
- Summary shows what was extracted and where
- Does not auto-extract everything — waits for user selection
