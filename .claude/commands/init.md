---
description: Initialize a project for Weave spec-driven development, scaffolding docs, standards, and state tracking.
---

# /init

Initialize a project for Weave spec-driven development.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/init/SKILL.md`

## Description

Scaffolds the `docs/` directory with spec templates, coding standards, and state tracking. Every
project is greenfield; the only state check is whether Weave has already been initialized here.

This is the first step before running any other Weave command.

## Instructions

When the user runs `/init`, invoke the `init` skill. The skill owns:

- Project-state detection (already-initialized vs. fresh)
- Directory creation, template copy, state initialization, settings generation
- Confirmation summary

Pass through any arguments the user provided.

## Arguments

- No arguments: detect state and run the matching init path

## Examples

```
/init
```
