---
description: Capture SME tribal knowledge into durable context via a form-first interview with a chat-round fallback.
argument-hint: "[role] [--chat|--promote]"
---

# /interview

Capture SME tribal knowledge into durable context. Form-first (async-friendly) with a chat-round fallback for residual gaps. Outputs are scrubbed for secrets/PII before promotion and never auto-committed to `.claude/rules/` — rule candidates land in a human-review queue.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/interview/SKILL.md`

## When to use

- After `/sync` identifies blind spots (unsupported-tier LOC, invisible graph edges, empty data-model invariants)
- When a domain has no confirmed context docs and the engineer agent is about to work there
- Quarterly, to capture drift in patterns/pain-points/tribal knowledge
- After an incident, to promote learnings into rules

## Arguments

```
/interview                       # MCQ prompts for role + mode
/interview engineer              # Engineer role, default form-first mode
/interview architect             # Architect role, historical ADR capture
/interview po                    # Product / business-rule capture
/interview delivery              # Delivery/process/risk capture
/interview <role> --chat         # Skip form, go direct to chat rounds
/interview <role> --promote      # Review rule-candidates.md and promote to .claude/rules/
```

## Instructions

When the user runs `/interview`, invoke the `interview` skill. The skill owns:

- Role selection (engineer / architect / PO / delivery)
- Form-first generation: Claude writes a scoped markdown form to `.claude/_intake/<role>-<date>.md` derived from the current graph's detected gaps (invisible edges, missing invariants, unconfirmed ADRs). The file is gitignored; SME fills async.
- Chat-round fallback: if the SME prefers, or after form intake leaves gaps, run interview rounds via AskUserQuestion using the existing Six Hats / Five Whys / Twenty Questions elicitation methods.
- Redaction: before any promotion from `_intake/`, run the scrubber (same pack as the PreToolUse hook) and emit a redaction report.
- Promotion: structured content lands in `.claude/state/context/*.md` (patterns, pain-points, decisions, tribal-knowledge) with full provenance frontmatter (`source: sme-interview`, `confirmed_by: <SME>`, `confirmed_on: <date>`).
- Rule candidates: detected unconditional-constraint language ("never X", "always Y") goes to `.claude/state/context/rule-candidates.md` with proposed scope glob, rationale, SME attribution. **Never auto-commits to `.claude/rules/`.**
- Skill candidates: after two interview sessions in which the same theme recurs, emit a candidate-skill scaffold at `.claude/state/context/skill-candidates/<topic>.md` using `${CLAUDE_PLUGIN_ROOT}/templates/context/candidate-skill.md`. Promotion to `.claude/skills/` is human-only.

## Output

```
weave interview (<role>) complete.
  Intake (raw):          .claude/_intake/<role>-<date>.md  [gitignored]
  Scrubber report:       <N> patterns triggered, N redacted
  Context updated:       .claude/state/context/<files>
  Rule candidates:       <N> new (.claude/state/context/rule-candidates.md)
  Skill candidates:      <N> new (.claude/state/context/skill-candidates/)

Next steps:
  Review rule candidates and move approved ones to .claude/rules/<topic>.md
  Review skill candidates and promote established patterns to .claude/skills/<topic>/SKILL.md
```
