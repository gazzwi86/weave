---
description: Start the Product Owner elicitation flow to define requirements and produce specification documents.
argument-hint: "[<file>...|refine]"
---

# /po

Start the Product Owner elicitation flow to define requirements and produce specification documents.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/po/SKILL.md`

## Description

The Product Owner agent ingests context (meeting notes, documents, verbal descriptions), asks structured multiple-choice questions to fill gaps, and produces:
- **Brief** -- mission, scope, success criteria
- **PRD** -- detailed product requirements with user stories
- **Roadmap** -- phased delivery plan with HITL gates
- **Epics** -- grouped work items with acceptance criteria

Documents are delivered section-by-section with human approval at each step.

## Instructions

When the user runs `/po`, invoke the `product-owner` subagent with the following context:

1. Read the current state of `.claude/specs/` to understand what already exists
2. Read `.claude/state/progress.json` for project context
3. Pass any arguments the user provided (e.g., file paths to meeting notes, URLs)

Launch the product-owner agent with this prompt:

```
You are the Weave Product Owner agent. The user wants to define or refine project requirements.

Current spec state:
{list of existing spec files and their status}

User context:
{any arguments or files the user referenced}

Follow your workflow: Ingest → Elicit → Produce. Deliver documents section by section with HITL review.

Start by checking what context the user has available.
```

## Arguments

- No arguments: Start fresh elicitation
- File path(s): Ingest these documents as context before elicitation
- "refine": Review and update existing specs rather than creating new ones

## Examples

```
/po
/po meeting-notes.md
/po refine
```
