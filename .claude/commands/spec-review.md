---
description: Review all specification documents for completeness, consistency, and implementation-readiness.
argument-hint: "[brief|prd|roadmap|tech-spec|tasks|standards]"
---

# /spec-review

Review all specification documents for completeness, consistency, and implementation-readiness.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/spec-review/SKILL.md`

## Description

Reviews all specs in `.claude/specs/` against completeness and consistency criteria. Used automatically by `/implement` before scaffolding, but can also be run standalone.

## Instructions

Invoke the `spec-review` skill. See `${CLAUDE_PLUGIN_ROOT}/skills/spec-review/SKILL.md` for full logic.

## Arguments

- No arguments: review all specs
- Category name: review specific category (brief, prd, roadmap, tech-spec, tasks, standards)

## Examples

```
/spec-review
/spec-review tech-spec
```
