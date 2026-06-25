---
name: arch-dod
description: Produce a precise, QA-verifiable Definition of Done checklist (definition-of-done.md) for a Weave entity, where every item is mechanically verifiable. Invoked by the architect agent, typically after the tech spec is drafted.
---

# arch-dod Skill

Produce a precise, QA-verifiable Definition of Done checklist (`definition-of-done.md`) for a
Weave tech spec entity. Every item in the checklist must be mechanically verifiable — no vague
criteria. Invoked as part of the arch phase, typically after the tech spec is drafted.

## Model

- **claude-haiku-4-5** — mechanical checklist formatting; precision over creativity; no
  reasoning-heavy synthesis required

## Input

Before doing anything else, read:

1. `/Users/gareth/Sites/weave/CLAUDE.md` — Weave laws, complexity thresholds, confirmed stack
2. `.claude/spec-templates/tech-spec/definition-of-done.md` — canonical section scaffold
3. `.claude/specs/<entity>/03-arch/tech-spec.md` (if present) — entity-specific acceptance criteria
   and architectural constraints to incorporate into the DoD
4. `.claude/specs/<entity>/02-prd/prd.md` (if present) — user stories and ACs that must be
   reflected in the Testing section

Ask the user which entity this DoD is for (e.g. `constitution-engine`, `build-engine`,
`weave-platform`) if not supplied. Output path is:

```
.claude/specs/<entity>/04-arch/tech-spec/definition-of-done.md
```

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a Definition of Done before writing
anything else.

Example: "A DoD item that cannot be checked by a script or a reviewer in under 60 seconds is
not a DoD item — it is a wish. Every item in this checklist must have a named tool, metric, or
binary signal that proves compliance. Ambiguity in a DoD becomes ambiguity in a PR review."

Reference this principle when justifying decisions during the HITL loop.

### Step 1 — Context ingestion

1. Read the files listed in the Input section above.
2. Extract the entity name, its confirmed tech stack components, and any acceptance criteria
   already captured in the tech spec or PRD.
3. Note any entity-specific complexity, security, or testing constraints that should supplement
   the standard template items.
4. Summarise what you know in 3 bullets before proceeding:
   - What the entity is and which phase it is in
   - Which Weave stack components it touches (backend, frontend, RDF store, etc.)
   - Any entity-specific constraints or ACs that will extend the standard checklist

### Step 2 — Produce the full DoD checklist

Produce all five sections in a single pass (this is a mechanical artifact — section-by-section
HITL would add no value for a checklist). Write every item using this rule:

**Each item must be:**
- Expressed as a binary pass/fail check
- Verifiable by a named tool, metric, or explicit criterion
- Free of adjectives like "good", "clean", "appropriate", or "sufficient" without a number

Use the template scaffold from `.claude/spec-templates/tech-spec/definition-of-done.md` as the
base. Extend with entity-specific items derived from Step 1.

#### Section A — Code Quality

Mandatory items (always include, verbatim thresholds from `CLAUDE.md`):

- [ ] ESLint passes with zero errors and zero warnings (frontend TypeScript)
- [ ] Ruff passes with zero violations (backend Python)
- [ ] Cyclomatic complexity ≤ 10 per function (checked via Radon for Python, ESLint
      complexity rule for TypeScript)
- [ ] Cognitive complexity ≤ 15 per function (Radon for Python, SonarJS for TypeScript)
- [ ] No function exceeds 50 lines (Radon for Python, ESLint max-lines-per-function for
      TypeScript)
- [ ] No `TODO`, `FIXME`, or `HACK` comments left unresolved
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI enforced)
- [ ] All public API functions and components have JSDoc (TypeScript) or docstrings (Python)

#### Section B — Testing

Mandatory items:

- [ ] All acceptance criteria from the tech spec are covered by at least one automated test
- [ ] Unit test coverage ≥ 80% for all changed modules (measured via pytest-cov / Vitest
      coverage)
- [ ] Mutation score ≥ 70% for changed modules (measured via mutmut for Python, Stryker for
      TypeScript)
- [ ] Integration tests pass against LocalStack (AWS services) or Oxigraph test instance
      (RDF store) — no real cloud calls in test suite
- [ ] E2E tests pass via Playwright for any user-facing flows introduced
- [ ] No flaky tests introduced (CI green on three consecutive runs)
- [ ] Edge cases identified in QA review are covered

#### Section C — Documentation

Mandatory items:

- [ ] JSDoc on all new or modified public TypeScript functions and components
- [ ] Docstrings (Google style) on all new or modified public Python functions and classes
- [ ] OpenAPI spec updated for any new or modified REST endpoints
      (`.claude/specs/<entity>/04-arch/openapi.yaml`)
- [ ] SPARQL queries documented inline with a comment explaining intent
- [ ] ADR created in `.claude/specs/<entity>/04-arch/adrs/` if an architectural decision was made
- [ ] README or relevant wiki page updated if user-facing behaviour changed

#### Section D — Git Hygiene

Mandatory items:

- [ ] All commits follow conventional commit format (`feat:`, `fix:`, `docs:`, `test:`,
      `chore:`) — verified by commitlint
- [ ] Each commit is a logical, atomic unit of work (no "WIP" or "misc" commits)
- [ ] PR description references the task ID and links to the tech spec entity
- [ ] PR is scoped to a single phase (stacked PRs — one PR per phase per Plugin Law D)
- [ ] PR is reviewable: diff ≤ 400 lines of changed application code (excluding generated
      files and lock files)

#### Section E — Security

Mandatory items:

- [ ] No secrets, API keys, tokens, or passwords hardcoded in source files or committed to git
- [ ] No `.env` files committed — secrets sourced from AWS Secrets Manager only
- [ ] SAST scan passes (Bandit for Python, eslint-plugin-security for TypeScript) with zero
      high-severity findings
- [ ] All SQL queries use parameterised form — no string concatenation with user input
      (SQLAlchemy ORM or explicit parameterised queries)
- [ ] User input validated and sanitised at system boundaries via Pydantic v2 models
      (backend) or Zod schemas (frontend)
- [ ] No `eval()`, `Function()`, or dynamic code execution in frontend TypeScript

### Step 3 — Run constitutional self-check

Run the full constitutional self-check (see below) before presenting output. If any Law is
violated, revise the relevant section and re-run the check.

### Step 4 — Present and single HITL gate

Display the complete checklist to the user. Emit the confidence block immediately after.
Then ask via AskUserQuestion: **Approve / Amend / Reject**

- If **Approve**: proceed to Step 5.
- If **Amend**: apply the requested changes, show a diff of changed items, re-present with
  updated confidence block, ask again.
- If **Reject**: regenerate the checklist from scratch with a different approach, show the
  new version.

### Step 5 — Write output file

Write the approved checklist to:

```
.claude/specs/<entity>/04-arch/tech-spec/definition-of-done.md
```

Create the directory if it does not exist.

### Step 6 — Commit

```bash
git add .claude/specs/<entity>/04-arch/tech-spec/definition-of-done.md
git commit -m "docs(<entity>): add definition of done for tech spec"
```

Then tell the user: "DoD complete. QA can now run `/qa` against this checklist, or continue
with `/architect` to proceed to the next tech spec artifact."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
DoD Law 1 (every item binary pass/fail): complied | violated | N/A — <reason>
DoD Law 2 (named tool or metric per item): complied | violated | N/A — <reason>
DoD Law 3 (no vague adjectives without numbers): complied | violated | N/A — <reason>
DoD Law 4 (CLAUDE.md thresholds baked in): complied | violated | N/A — <reason>
DoD Law 5 (security items cover Weave security.md rules): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the affected items, re-run the check.

Output the trace in chat (user sees it). Keeps Laws active across long sessions.

## Confidence block (emit before the single HITL question)

Output this block immediately after presenting the checklist, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific item or section>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:

- Always name the weakest part, even on high-confidence output.
- "Why" must reference a specific input gap. "The future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the file.

## Output

File: `.claude/specs/<entity>/04-arch/tech-spec/definition-of-done.md`

Template: `.claude/spec-templates/tech-spec/definition-of-done.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
title: "Definition of Done: <entity display name>"
status: Draft
created: <YYYY-MM-DD>
entity: <entity>
phase: 04-arch
---
```

## Evaluation Criteria

A well-produced Definition of Done:

- Contains only binary pass/fail items — no item uses "good", "appropriate", "sufficient", or
  similar unmeasurable adjectives without an accompanying number or tool name
- References exact complexity thresholds from `CLAUDE.md`: cyclomatic ≤ 10, cognitive ≤ 15,
  function length ≤ 50 lines
- Names the specific tool or command that verifies each item (e.g. Radon, pytest-cov, Bandit,
  commitlint, Playwright) — no item says "verify manually" without a defined procedure
- Coverage items specify ≥ 80% unit coverage and ≥ 70% mutation score
- Security section covers all five rules in `.claude/rules/security.md`
- Git hygiene section enforces Plugin Law D (stacked PRs, one per phase)
- LocalStack / Oxigraph called out explicitly in integration tests — no real cloud calls
- Has no `{{PLACEHOLDER}}` text and was written by claude-haiku-4-5 (precision tier)
