---
description: Generate technical specifications (C4, OpenAPI, data model, ADRs) and decompose epics into implementable task briefs.
argument-hint: "[tasks|refine]"
---

# /architect

Generate technical specifications and decompose epics into implementable task briefs.

## Description

The Technical Architect agent reads approved product specs (Brief, PRD, Roadmap, Epics) and produces:
- **Architecture** -- C4 model at all 4 levels (Mermaid)
- **OpenAPI spec** -- API contracts
- **Data model** -- ERD with entity definitions
- **Business process** -- User flows, state machines, sequence diagrams
- **Class diagrams** -- Domain model and component hierarchy
- **CI/CD pipeline** -- Build, test, deploy stages
- **Testing strategy** -- Frameworks, coverage targets, patterns
- **DoR/DoD** -- Entry and exit criteria for tasks
- **Task briefs** -- Rich, self-contained implementation briefs per story
- **ADRs** -- Architecture Decision Records

All documents are delivered section-by-section with HITL review.

## Instructions

When the user runs `/architect`, invoke the `tech-architect` subagent:

1. Read `docs/specs/brief.md`, `prd.md`, `roadmap.md`, `epics/*.md`
2. Verify specs are approved (not templates)
3. Launch tech-architect agent to generate tech spec and tasks

## Arguments

- No arguments: Generate full tech spec from approved PRD
- "tasks": Skip to task decomposition (if tech spec already exists)
- "refine": Review and update existing tech spec

## Examples

```
/architect
/architect tasks
/architect refine
```
