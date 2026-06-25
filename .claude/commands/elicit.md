---
description: Run structured elicitation (Six Hats, Five Whys, Twenty Questions, Stochastic) for requirements, decisions, and knowledge extraction.
argument-hint: "[<doc>[:<section>]] [--method <name>] [\"topic\"]"
---

# /elicit

Structured elicitation for requirements, decisions, and knowledge extraction.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/elicit/SKILL.md`

## Description

Consolidates multiple elicitation techniques into a single command. Supports Six Thinking Hats, Five Whys, Twenty Questions, Stochastic Reasoning, and general MCQ. Used standalone or suggested by PO/Architect before document creation.

## Instructions

Invoke the `elicit` skill. See `${CLAUDE_PLUGIN_ROOT}/skills/elicit/SKILL.md` for full logic.

## Arguments

- No arguments: interactive selection of target and method
- `<doc>`: elicit for a specific doc (brief, prd, epics, tasks, architecture)
- `<doc>:<section>`: elicit for a specific section
- `--method <name> "topic"`: use a specific method (six-hats, five-whys, twenty-questions, stochastic)

## Examples

```
/elicit
/elicit brief
/elicit architecture:data-model
/elicit --method six-hats "Authentication approach trade-offs"
/elicit --method five-whys "Why do users abandon the checkout?"
/elicit --method stochastic "Database: PostgreSQL vs SQLite vs Supabase"
```
