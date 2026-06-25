---
source: sme-interview
confirmed_by: "none"
confirmed_on: null
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: "orphan"
coverage: n/a
activation_count: {{ACTIVATION_COUNT}}
first_activation: {{FIRST_DATE}}
last_activation: {{LAST_DATE}}
---
<!-- Skill-promotion candidate. This file lives in .claude/state/context/skill-candidates/ until it meets all three promotion criteria (activations ≥ 3, eval passes, owner named), at which point it is hand-promoted to .claude/skills/<topic>/SKILL.md. -->
<!-- Frontmatter schema: templates/frontmatter-schema.md -->
<!-- Promotion procedure: docs/skills-promotion.md -->

# Candidate skill: {{TOPIC}}

## Proposed frontmatter for SKILL.md

```yaml
name: {{skill-slug}}
description: "{{description used by Claude for auto-match — one sentence, keyword-rich}}"
```

## Why this should be a skill

{{reason — usually recurrence across interview sessions + complexity that doesn't fit rules or shards}}

## Activations to date

| Date | Session | Context | Asker |
|---|---|---|---|
| {{date}} | {{session_id}} | {{short context}} | {{handle}} |

## Proposed skill body

<!-- Draft of what .claude/skills/<topic>/SKILL.md would contain. Refine before promotion. -->

### Trigger

{{when Claude should load this skill — matches the description but more precise}}

### Instructions

{{step-by-step guidance the skill provides}}

### Gotchas

{{what breaks if the skill is applied wrong}}

## Proposed eval gold set (10 Q&A minimum for promotion)

1. Q: {{question}}
   A: {{expected answer covering the skill's core claim}}
2. ...

## Proposed owner

{{handle — must be filled before promotion}}

## Blockers to promotion

- [ ] Activation count ≥ 3 (currently {{ACTIVATION_COUNT}})
- [ ] Eval gold set defined (≥ 10 Q&A)
- [ ] Owner assigned (currently: `{{OWNER}}`)
- [ ] SME-confirmed content (currently: `confirmed_by: {{CONFIRMED_BY}}`)
