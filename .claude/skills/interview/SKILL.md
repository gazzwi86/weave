---
name: interview
description: Conducts structured role-based SME interviews to capture tribal knowledge, pain points, architectural decisions, and undocumented patterns. Invoked from init's brownfield path or from reconcile when items need human context.
---

# Interview

Role-based SME elicitation skill. Conducts structured interviews with team members to capture tribal knowledge, pain points, architectural decisions, and undocumented patterns.

## Trigger

- Invoked from the `init` skill's brownfield path (optional step after `reconcile`)
- Invoked from `reconcile` when items need human context
- No standalone slash command; callers pass the role explicitly

## Arguments

Callers pass a role: `engineer`, `po`, `architect`, or `delivery`. If no role is provided, offer the user an MCQ via AskUserQuestion.

## Laws

1. **Never fabricate interview responses** — only record what the human actually said.
2. **Always attribute** — "Reported by {{ROLE}} on {{DATE}}".
3. **Distinguish facts from opinions** in the output.
4. **Reuse existing elicitation methods** from `${CLAUDE_PLUGIN_ROOT}/skills/elicit/` — do not reinvent.

## Instructions

### Step 1: Check Existing Context

Check if `.claude/state/context/` files already exist:
- `patterns.md`
- `pain-points.md`
- `decisions.md`
- `tribal-knowledge.md`

If any are populated (non-empty, beyond template headers), ask via AskUserQuestion:
- "Context files already exist. Would you like to:"
  - **Refresh** — re-interview and update existing files
  - **Append** — add new findings to existing files
  - **Skip** — cancel this interview

### Step 2: Determine Role

If no role argument provided, ask via AskUserQuestion:
- **Engineer** — development patterns, pain points, technical debt, undocumented conventions
- **PO/BA** — business rules, priorities, compliance, user feedback
- **Architect** — key decisions, constraints, integration points, scalability
- **Delivery Lead** — timeline, team constraints, process, risk register

### Step 2.5: Choose Mode — Form-First (Default) or Chat

Ask via AskUserQuestion:

- **Form-first** (recommended) — Claude writes a scoped markdown intake form to `.claude/_intake/<role>-<date>.md` derived from graph gaps; SME fills async at their own pace; Claude ingests + scrubs on return.
- **Chat** — direct chat rounds via AskUserQuestion; live only.
- **Both** — form first, chat rounds for residual gaps.

If `--chat` argument was passed, skip the prompt and go direct to Step 3 chat rounds.

### Step 2.6: Form-First Generation

If form-first or both: derive question sections from detected gaps. Inputs:

- `.claude/state/discovery/graph.json` — clusters with low node coverage or high coupling
- `.claude/state/discovery/coverage.yml` — partial-syntactic/unsupported-tier languages
- `docs/architecture/flows.md#invisible-edges` — empty = graph couldn't detect them; SME is needed
- `docs/architecture/invariants.md` — empty sections to populate
- `docs/architecture/decisions/` — missing ADRs flagged by `discover`

Write the intake form to `.claude/_intake/<role>-<YYYY-MM-DD>.md`. Example shape for engineer role:

```markdown
# Engineer intake — <date>

## Invisible edges (the graph can't see these)
- Event bus topics you publish to:
- Event bus topics you subscribe to:
- DI container wirings that resolve at runtime:
- Feature flags that fork control flow:

## "Don't touch" areas
- Modules or files where changes routinely cause regressions:
- Why (incidents, constraints, fragile abstractions):

## Undocumented conventions
- Patterns you follow that aren't in docs/standards/:
- Patterns in the code you consciously avoid:

## Workarounds
- Things working around other things (cite both):

## Fixed-timestamp capture
- Date of this intake:
- Git SHA at time of intake: <HEAD>
```

Intake writes go to `.claude/_intake/` which is gitignored. The scrubber hook skips this path (raw transcripts are allowed to contain pre-redaction content).

Return the form path to the user and wait. After the SME fills it (or the user indicates completion), proceed to Step 3 if any sections remain empty or clearly need drill-down; otherwise skip to Step 4.

### Step 3: Conduct Interview

Use elicitation techniques from `/elicit` throughout. Select techniques based on the response:
- **Twenty Questions** — for narrowing unknowns and exploring broad areas
- **Five Whys** — for drilling into pain points and understanding root causes
- **Six Hats** — for exploring decisions from multiple perspectives

Run the interview in conversational rounds. Each round asks 3-4 questions, then summarizes what was captured before proceeding.

#### Engineer Interview

**Round 1 — System understanding:**
- How does [component from graph, if available] actually work day-to-day?
- What are the pain points in daily development?
- What would you refactor first if you had time?

**Round 2 — Hidden knowledge:**
- Where are the "don't touch" areas and why?
- What patterns do you follow that aren't documented?
- What workarounds are in place and what are they working around?

**Round 3 — Deep dive:**
- Use Five Whys on the top pain point identified in Round 1
- Use Twenty Questions to explore any "don't touch" areas mentioned

#### PO/BA Interview

**Round 1 — Business context:**
- What are the core business rules that the system must enforce?
- What's the current priority backlog (top 5)?
- What user feedback patterns do you see most often?

**Round 2 — Constraints:**
- What compliance or regulatory constraints exist?
- What business metrics does this system affect?
- What are the non-negotiable requirements vs. nice-to-haves?

**Round 3 — Deep dive:**
- Use Six Hats on any conflicting priorities identified
- Use Five Whys on the most common user complaint

#### Architect Interview

**Round 1 — Decisions:**
- What key architectural decisions shaped this system?
- What would you change if you were rebuilding from scratch?
- What are the performance and scalability constraints?

**Round 2 — Integration and risk:**
- What integration points are most fragile?
- Where are the single points of failure?
- What monitoring or observability gaps exist?

**Round 3 — Deep dive:**
- Use Six Hats on the "what would you change" answer
- Use Stochastic Reasoning if competing architectural approaches emerge

#### Delivery Lead Interview

**Round 1 — Timeline and team:**
- What's the timeline and key milestones?
- What are the team constraints (size, skills, availability)?
- What process constraints exist (release cadence, approval gates)?

**Round 2 — Risk and dependencies:**
- What's on the risk register?
- What external dependencies could block progress?
- What has gone wrong in similar past efforts?

**Round 3 — Deep dive:**
- Use Five Whys on past failures mentioned
- Use Twenty Questions to map external dependencies

### Step 3.5: Scrub Before Promotion

Every piece of content that leaves `.claude/_intake/` and lands in a git-tracked path passes through the scrubber. The `PreToolUse` hook enforces this automatically for `Write|Edit`; this step is the operator checklist:

1. Read the raw intake file from `.claude/_intake/`.
2. Run the scrubber directly (`${CLAUDE_PLUGIN_ROOT}/scripts/scrub-intake.sh` with a simulated Write payload) for a pre-flight summary. Report rules that would fire.
3. Manually rewrite sensitive content: replace customer names with `<CUSTOMER>`, tenant IDs with `<TENANT>`, production URLs with `<PROD_HOST>`, tokens with `<REDACTED>`. Preserve meaning; remove specifics.
4. Emit a redaction summary to the user showing how many matches each rule produced and how many were redacted vs. determined to be false positives.

Only the scrubbed synthesis proceeds to Step 4. Raw transcripts remain in `.claude/_intake/` (gitignored) and never land in a tracked file.

### Step 4: Capture Output

After each interview round, summarize findings and confirm accuracy with the interviewee before proceeding.

Write outputs to the appropriate context files, creating them if they don't exist:

| Source | Output File |
|--------|-------------|
| Engineer interviews | `.claude/state/context/patterns.md` |
| All roles | `.claude/state/context/pain-points.md` |
| Architect + PO interviews | `.claude/state/context/decisions.md` |
| All roles | `.claude/state/context/tribal-knowledge.md` |

Each entry in the output files must include:
- Attribution: "Reported by {{ROLE}} on {{DATE}}"
- Fact/opinion marker: `[FACT]` or `[OPINION]` prefix on each item
- Source context: which question or technique produced the finding
- Frontmatter provenance: the file's YAML block updates `confirmed_by: <SME handle>`, `confirmed_on: <YYYY-MM-DD>`, `last_verified_sha: <HEAD sha>` on each promotion.

### Step 4.5: Emit Rule Candidates (never auto-commit)

During content capture, detect sentences carrying **unconditional-constraint language**: starts with "never", "always", "must not", "must always", "don't", "do not"; bounded scope; imperative voice. These are rule candidates — they do NOT go to `.claude/rules/` directly.

Append each candidate to `.claude/state/context/rule-candidates.md` (create on first run) as a YAML list item:

```yaml
- candidate: "Never run migrations outside the release window"
  scope: "db/migrations/**"
  source: sme-interview
  confirmed_by: <SME handle>
  confirmed_on: <YYYY-MM-DD>
  rationale: "<why — reference past incident, compliance requirement, etc>"
  status: proposed
```

Hotspot-derived candidates (from `reconcile` Mode B6 coverage gaps + high-churn clusters) land in the same queue with `source: hotspot` — they require SME confirmation before promotion.

**Promotion is human-only.** The `--promote` flag lists candidates and prompts per-row via AskUserQuestion. On accept, the candidate is moved to `.claude/rules/<slug>.md` using `${CLAUDE_PLUGIN_ROOT}/templates/context/rule.md`, populated with the candidate's data, and the scope glob becomes frontmatter `scope:`. On reject, the row is deleted from the queue with a `rejected_reason:` comment.

### Step 4.6: Emit Skill Candidates

If the same theme recurs across **two or more interview sessions** (match via topic slug + keyword overlap), emit a skill candidate at `.claude/state/context/skill-candidates/<topic>.md` using `${CLAUDE_PLUGIN_ROOT}/templates/context/candidate-skill.md`. Increment `activation_count` on recurrence. Promotion criteria: see `${CLAUDE_PLUGIN_ROOT}/docs/skills-promotion.md`. Like rules, promotion is human-only via `--promote`.

### Step 5: Update Discovery Index

- Update `docs/discovery/index.md` with a reference to the new context files
- Append a timestamped entry to `.claude/state/discovery-log.md`:
  ```
  {{DATE}} — Interview ({{ROLE}}): captured {{count}} findings across {{files updated}}
  ```

### Step 6: Summary

Display a summary to the user:
```
Interview Complete: {{ROLE}}

Findings captured: {{count}}
  - Patterns: {{count}}
  - Pain points: {{count}}
  - Decisions: {{count}}
  - Tribal knowledge: {{count}}

Files updated:
  - .claude/state/context/patterns.md
  - .claude/state/context/pain-points.md
  - .claude/state/context/decisions.md
  - .claude/state/context/tribal-knowledge.md

Suggested next steps:
  - Invoke reconcile (mode A) to cross-check findings against the graph
  - Run another interview for a different role to broaden coverage
```
