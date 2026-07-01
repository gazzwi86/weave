---
name: arch-dor
description: Produce a Definition of Ready checklist (definition-of-ready.md) verifying every prerequisite an engineer needs before starting a Weave task. Invoked by the implement skill before a task starts, or by the architect agent to gate task creation.
---

# arch-dor Skill

Produce a Definition of Ready (`definition-of-ready.md`) checklist for a Weave task brief,
verifying every prerequisite the Engineer needs before starting implementation. Invoked by the
`implement` skill before a task starts, or directly by the Architect to gate task creation.

## Model

- **Checklist production:** claude-haiku-4-5 (mechanical formatting, deterministic checklist
  evaluation — no wide reasoning needed)

Haiku is chosen deliberately: the DoR is a mechanical gate, not a creative artefact. Speed and
cost matter here because it runs once per task. If the task brief is ambiguous and requires
interpretation, surface the ambiguity in the HITL step rather than escalating the model.

## Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave laws, confirmed stack, spec path conventions
2. `.claude/spec-templates/tech-spec/definition-of-ready.md` — canonical DoR checklist
   structure (use as scaffold; never leave `{{}}` in output)
3. `.claude/spec-templates/task.md` — task brief schema (maps directly to DoR items)
4. The target task brief: `docs/specs/weave/engines/<entity>/04-arch/tasks/<TASK_ID>.md`
5. Any existing DoR for this task (`docs/specs/weave/engines/<entity>/04-arch/tech-spec/definition-of-ready.md`)
   to continue or refresh

Ask the user which entity and task ID this DoR is for if not supplied. Confirm the output path:

```
docs/specs/weave/engines/<entity>/04-arch/tech-spec/definition-of-ready.md
```

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle before doing anything else.

Example: "A Definition of Ready exists to protect the Engineer from ambiguity. If the
Engineer must guess any decision that is in scope for the Architect to have made, the
task is not ready. Every unchecked item is a scope-creep vector or a blocked day."

Reference this principle when justifying any FAIL rating during the HITL loop.

### Step 1 — Context ingestion

1. Read the target task brief (listed in Input above).
2. Read the DoR template to internalise section structure.
3. Summarise in 3 bullets before producing the checklist:
   - What the task does (from the Story section of the brief)
   - Which DoR sections are clearly satisfied (based on a quick scan)
   - Which DoR sections look thin or absent (flag as risk)

No user question needed here — proceed directly to Step 2 unless entity/task ID is missing.

### Step 2 — Section-by-section checklist production

Produce the DoR in the exact section order below. For each section:

1. **Evaluate** each checklist item against the task brief — PASS or FAIL with a one-line
   reason for every FAIL.
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated.
3. **Write** the section to the output file.
4. Accumulate all sections; do NOT present section-by-section to the user.

**Sections in order:**

#### Section 1 — Task Brief Completeness

Map directly to the `task.md` schema. Evaluate:

- [ ] User story present in "As a / I want / So that" format
- [ ] Acceptance criteria table populated (each row has ID, criteria, test mapping)
- [ ] Each AC uses EARS format: `WHEN [event] THE SYSTEM SHALL [behaviour]` or
  Given/When/Then with observable outcomes (status code, response shape, header)
- [ ] Pseudocode or implementation approach provided (not just a description — actual
  algorithmic steps, input guards, error shapes)
- [ ] API contracts defined where the task touches an HTTP endpoint:
  - Method + path
  - Request schema (JSON example)
  - Response schema per status code (200, 4xx at minimum)
- [ ] No `{{PLACEHOLDER}}` text remaining in the brief

For each FAIL item, record the exact field or row that is missing or incomplete.

#### Section 2 — Dependencies Identified

- [ ] `blocked_by` field is present and either lists task IDs or is explicitly `[]`
- [ ] `unlocks` field is present and either lists task IDs or is explicitly `[]`
- [ ] For each task in `blocked_by`: a dependency summary exists at
  `.claude/state/summaries/<DEP_TASK_ID>.md` OR this is documented as pending
- [ ] No circular dependencies (check the graph: a task in `blocked_by` must not
  eventually list this task in its own `blocked_by`)

#### Section 3 — Diagrams Referenced

- [ ] Diagram references table is populated (not blank)
- [ ] Each row has: diagram type, file path relative to the spec tree, and a 1-line summary
- [ ] Required diagram types are covered (mark N/A only if the task type genuinely excludes it):
  - Sequence diagram — present or N/A (stateless utility only)
  - State diagram — present or N/A (no state machine in scope)
  - Data model / ERD — present or N/A (no persistence in scope)
- [ ] Each referenced file exists on disk (run `ls` to verify)

#### Section 4 — Design Decisions Noted

- [ ] Design decisions table is populated (not blank)
- [ ] Each row has: decision text, ADR reference, and impact on this task
- [ ] Every ADR reference points to a file that exists:
  `docs/specs/weave/engines/<entity>/04-arch/decisions/ADR-NNN.md`
- [ ] Decisions that affect Weave's confirmed stack (FastAPI, Next.js 15, Oxigraph,
  AWS Bedrock, etc.) are cross-referenced to `CLAUDE.md` rather than re-stated

#### Section 5 — Test Scenarios Specified

- [ ] Unit test list is present with minimum count stated (`minimum N`)
- [ ] Integration test list is present with minimum count stated (`minimum N`)
- [ ] E2E test list is present with minimum count stated (may be 0 for backend-only tasks)
- [ ] Each test name follows the pattern: `should <expected behaviour> when <condition>`
- [ ] AC-to-test mapping table is populated — every AC ID appears at least once
- [ ] Edge cases identified (at least one per AC, or explicitly stated as none)
- [ ] Playwright specified for any test that exercises browser behaviour (Law B enforcement)

#### Section 6 — Cost Estimate Provided

- [ ] Complexity field is one of: S / M / L / XL
- [ ] Estimated token counts provided (input K + output K)
- [ ] Estimated cost in USD provided
- [ ] Complexity rating is consistent with the pseudocode size and AC count:
  - S = ≤ 3 ACs, single function, no persistence
  - M = 4-6 ACs, 2-3 functions, one persistence layer
  - L = 7-10 ACs, multi-layer, multi-service
  - XL = > 10 ACs or architectural change

### Step 3 — Aggregate result and overall readiness verdict

After all six sections are evaluated, produce an overall readiness verdict:

```
## Overall Readiness

Status: READY | NOT READY
Failed items: N
Blocking items: <list section + item for each FAIL>
```

Rules:
- Status is READY only if zero items are FAIL.
- A single FAIL in any section makes the whole task NOT READY.
- Do not adjust thresholds based on urgency or team preference.

### Step 4 — Single HITL presentation

Present the **complete checklist** (all six sections + overall verdict) to the user in one
block. Do not drip-feed sections.

Emit the confidence block immediately after the checklist, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <section name + specific item>
Why: <1 sentence — what was missing from the task brief or assumed>
</section-confidence>
```

Then ask via AskUserQuestion: **Approve / Amend / Reject**

- **Approve** — checklist is accurate, write the file, call `progress.sh phase-check`,
  proceed to commit.
- **Amend** — user corrects specific items (e.g. marks a FAIL as intentionally deferred,
  or adds missing content to the task brief). Apply changes, show diff, re-emit confidence
  block, re-ask.
- **Reject** — regenerate cleanly from the task brief without assumptions.

### Step 5 — Write file and update progress

1. Write the DoR to:
   `docs/specs/weave/engines/<entity>/04-arch/tech-spec/definition-of-ready.md`

2. Run:
   ```bash
   .claude/scripts/progress.sh phase-check
   ```

3. Commit:
   ```bash
   git add docs/specs/weave/engines/<entity>/04-arch/tech-spec/definition-of-ready.md
   git commit -m "docs: add DoR for <TASK_ID> (<entity>)"
   ```

4. Tell the user: "DoR written. Status: READY / NOT READY. If NOT READY, update
   the task brief to address blocked items, then re-run `/arch-dor`."

## Constitutional self-check (run before section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
DoR Law 1 (mechanical only — no creative inference): complied | violated | N/A — <reason>
DoR Law 2 (single HITL — full checklist at once): complied | violated | N/A — <reason>
DoR Law 3 (FAIL = NOT READY, no threshold adjustment): complied | violated | N/A — <reason>
DoR Law 4 (progress.sh phase-check after approval): complied | violated | N/A — <reason>
DoR Law 5 (Playwright mandatory for browser tests): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the checklist, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

**Skill-specific Laws:**

- **DoR Law 1** — Evaluate mechanically against the task brief. Do not infer intent or
  fill gaps. If a field is absent, it is FAIL — do not assume the Engineer will figure it out.
- **DoR Law 2** — Single HITL only: present the full checklist in one pass. Do not ask the
  user section-by-section (this skill is a gate, not a collaboration session).
- **DoR Law 3** — Any FAIL renders the task NOT READY. No partial-ready status. No
  "close enough." A task must be fully ready or it goes back for rework.
- **DoR Law 4** — Always call `.claude/scripts/progress.sh phase-check` after writing the
  file. The implement skill depends on this state to determine whether to proceed.
- **DoR Law 5** — If any test scenario involves browser interaction, Playwright must be
  explicitly named in the test requirements (Law B enforcement at the DoR layer).

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the checklist, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <section name + specific item>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence checklists.
- "Why" must reference a specific input gap in the task brief.
- "The task is not fully specified" is not acceptable — name the field.
- The block lives in chat only — do not embed it in the file.

## Output

File: `docs/specs/weave/engines/<entity>/04-arch/tech-spec/definition-of-ready.md`

Template: `.claude/spec-templates/tech-spec/definition-of-ready.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: Definition of Ready
title: "Definition of Ready: <TASK_ID> - <task title>"
description: "<one-line summary of the readiness verdict for this task>"
tags: [<entity>, 04-arch, task]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: READY | NOT READY
task_id: <TASK_ID>
entity: <entity>
created: <YYYY-MM-DD>
reviewed_by: arch-dor skill
---
```

The body of the file is the checklist produced in Steps 2-3, with all items marked PASS or
FAIL and the overall verdict at the bottom. Do not include the confidence block or the
constitutional self-check trace in the file — those are chat-only.

### File structure

```markdown
---
<frontmatter>
---

# Definition of Ready: <TASK_ID> - <task title>

A task is ready for the Engineer when ALL items below are checked (PASS). Any FAIL
means the task brief must be updated before implementation begins.

## 1. Task Brief Completeness

- [x] PASS — User story present ("As a graph editor, I want ...")
- [ ] FAIL — Acceptance criteria: AC-2 missing test mapping column
- [x] PASS — Pseudocode provided
- [x] PASS — API contracts defined (POST /api/triples: request/response schemas present)
- [x] PASS — No placeholder text remaining

## 2. Dependencies Identified

- [x] PASS — blocked_by: [TASK-003, TASK-007]
- [x] PASS — unlocks: [TASK-012]
- [ ] FAIL — Dependency summary missing: .claude/state/summaries/TASK-003.md not found
- [x] PASS — No circular dependencies detected

## 3. Diagrams Referenced

- [x] PASS — Sequence diagram: tech-spec/business-process.md#triple-ingestion
- [x] PASS — Data model: tech-spec/data-model.md#triple-entity
- [x] N/A — State diagram: no state machine in scope (documented)

## 4. Design Decisions Noted

- [x] PASS — ADR-007 (Oxigraph as RDF store): file exists, impact stated
- [x] PASS — Stack reference: CLAUDE.md § RDF store

## 5. Test Scenarios Specified

- [x] PASS — Unit tests: minimum 4 listed
- [x] PASS — Integration tests: minimum 2 listed
- [x] PASS — E2E tests: minimum 1 listed (Playwright specified)
- [x] PASS — AC-to-test mapping: all 3 ACs mapped
- [x] PASS — Edge cases: 2 identified (empty body, malformed triple)

## 6. Cost Estimate Provided

- [x] PASS — Complexity: M
- [x] PASS — Estimated tokens: ~12K input, ~4K output
- [x] PASS — Estimated cost: ~$0.04
- [x] PASS — M rating consistent with 5 ACs + 3 functions + 1 persistence layer

---

## Overall Readiness

Status: NOT READY
Failed items: 2
Blocking items:
- Section 1: AC-2 missing test mapping
- Section 2: .claude/state/summaries/TASK-003.md not found
```

## Evaluation Criteria

A well-produced DoR:

- Evaluates every checklist item against the actual task brief — no inferred PASS ratings
- Marks status FAIL for any missing or incomplete field, with a specific reference to the
  field or row that is absent
- Produces the overall `READY` verdict only when zero items are FAIL
- Is presented as a single HITL block (not drip-fed section by section)
- Has frontmatter with `status: READY | NOT READY` matching the overall verdict
- Calls `.claude/scripts/progress.sh phase-check` after approval before committing
- Has no `{{PLACEHOLDER}}` text in the output file
- Constitutional self-check trace present in chat; not embedded in the file
- Playwright is explicitly required for any AC that touches browser behaviour
