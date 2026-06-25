---
description: Initialize a project for Weave spec-driven development, scaffolding docs, standards, and state tracking.
---

# /init

Initialize a project for Weave spec-driven development.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/init/SKILL.md`

## Description

Scaffolds the `docs/` directory with spec templates, coding standards, and state tracking. Detects project state (greenfield, brownfield, PDD, already-initialized) and takes the appropriate path. For brownfield, runs discovery (graph extraction, reality-doc generation) and reconciliation before creating the standard scaffold.

This is the first step before running any other Weave command.

## Instructions

When the user runs `/init`, invoke the `init` skill. The skill owns:

- Project-state detection (greenfield / brownfield / PDD / already-initialized)
- Brownfield orchestration (dependency-check → discover → reconcile → optional interview → HITL gate)
- Directory creation, template copy, state initialization, settings generation
- Confirmation summary

Pass through any arguments the user provided.

## Arguments

- No arguments: detect state and run the matching init path

## Examples

```
/init
```
