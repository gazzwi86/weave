---
name: phase-gate
description: Evaluate whether the current implementation phase meets all quality gates before advancing to the next phase. Invoked automatically by the Stop hook when progress.sh phase-check returns COMPLETE, not by the user directly.
---

# Phase Gate Skill

Evaluate whether the current implementation phase meets all quality gates before advancing to the next phase. Invoked automatically by the Stop hook when `progress.sh phase-check` returns `COMPLETE` — not by the user directly.

## Model

- **Gate evaluation:** mid tier (structured analysis, precise checklist assessment)
- **Security sub-skill:** delegates to `/security-review` (runs its own model chain)

## Trigger

This skill is **not** a user-facing slash command. It fires from the Stop hook
(`hooks.py` event `"stop"`) via a `phase_gate()` call when:

1. `.claude/state/progress.json` has a non-empty `phase` field, AND
2. `.claude/scripts/progress.sh phase-check` returns `COMPLETE` (all tasks at `done` status).

The hook injects the skill via `sys.exit(2)` with a prompt on `stderr`, exactly as
`stop.completion_review` does. The `stop_hook_active` guard on the payload prevents
infinite re-entry — check it and return immediately if set.

## Input

Before doing anything else, read:

1. `.claude/state/progress.json` — current phase name, epics, and task statuses
2. `.claude/spec-templates/phase-gate.md` — section scaffold for the summary document
3. `docs/specs/weave/engines/<entity>.md` — all spec artifacts for the current phase
4. `.claude/state/summaries/` — any prior phase summaries (for continuity context)

Derive `<entity>` and `<phase>` from the `phase` field in `progress.json`.
Example: `phase: "constitution-engine/phase-1"` → entity `constitution-engine`,
phase label `Phase 1`.

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2–3 sentences naming the principle before evaluating anything:

> "A phase gate's job is to protect the next phase from inheriting unresolved debt.
> If any quality signal is red, the phase has not ended — it is paused. Every section
> of this gate must be evidence-based, not optimistic."

Reference this principle when justifying gate decisions during the HITL loop.

### Step 1 — Phase completion detection

1. Run: `.claude/scripts/progress.sh phase-check`
2. If output is NOT `COMPLETE`, abort immediately — write to stderr:
   `[phase-gate] Phase not complete — N tasks remain. Gate aborted.`
   Exit 0 (no-op). Do not proceed.
3. If `COMPLETE`:
   - Read `.claude/state/progress.json` and extract: `phase`, `epics[]`, `tasks[]`
   - Record counts: total tasks, tasks by epic, any escalations in `.claude/state/escalations/`
   - Run: `.claude/scripts/progress.sh kanban` — capture full output
4. Summarise findings in 3 bullets before proceeding:
   - Phase name and task count
   - Number of epics completed
   - Any open escalations that survived to gate time

### Step 2 — Security review

Run `/security-review` as a sub-skill invocation (Skill tool, `skill: "security-review"`).

Wait for it to complete. Extract:
- Overall pass/fail verdict
- Critical findings count (severity HIGH or CRITICAL)
- Any unresolved findings

**Gate rule:** If `/security-review` returns any CRITICAL finding → gate **cannot** Approve.
Present findings verbatim in the summary. The human approver may still choose Amend
(fix and re-gate) but Approve is blocked programmatically.

### Step 3 — Mutation testing report

Run the mutation test suite for the current phase's packages:

```bash
# Python packages (FastAPI backend)
cd <package-root> && uv run pytest --co -q 2>/dev/null | head -5

# TypeScript packages (Next.js frontend)
npx stryker run --reporters json,clear-text 2>/dev/null
```

Extract from Stryker JSON output (`reports/mutation/mutation.json` or stdout):
- `mutationScore` (percentage, 0–100)
- `killed`, `survived`, `timeout`, `noCoverage` counts

**Gate rule:** `mutationScore < 60` → mark mutation gate RED. Present the surviving
mutant list (up to 10 worst) so the human can decide.

If the mutation runner is not yet installed or configured, emit:
```
MUTATION: runner not configured — skipped. Score assumed 0% (RED).
```

Do not fabricate a score. A missing runner is a red signal.

### Step 3b — UI verification gate (UI-affecting phases only)

For every UI-affecting feature delivered in this phase, **re-execute** the deterministic UI gate —
do not trust a prior PASS recorded by the engineer or QA. This is the enforcing seam: the script's
exit code, not prose, decides.

```bash
# Launch the built app, then for each UI feature/epic:
.claude/scripts/ui_verify.sh --full --target <served-url-for-the-feature> \
  --runbook <path-to-the-feature-run-book>
```

`ui_verify.sh` fails closed: a missing Playwright/Lighthouse toolchain is a FAILURE, not a skip
(it never silently passes). Capture the exit code per feature.

**Gate rule:** any `ui_verify.sh` exit ≠ 0 → mark the UI gate RED → the gate **cannot** Approve
(blocked programmatically, exactly like a CRITICAL security finding). The human approver may Amend
(fix and re-gate) but Approve is blocked. A run-book that is missing or whose `vouched-by:` is empty
is itself a RED — a screen no human has vouched for is not done.

If the phase delivered no UI-affecting features, emit `UI-VERIFY: N/A (no UI features this phase)`
and continue. "No UI features" must be true from the task briefs, not assumed to dodge the gate.

### Step 4 — Kanban summary presentation

Display the full kanban output captured in Step 1 verbatim, then add:

```
Phase:    <phase label>
Total:    <N> tasks
Done:     <N> (100%)
Epics:    <N completed> / <N total>
Escalations open: <N>
```

No reformatting — the raw kanban board is the authoritative record.

### Step 5 — Phase summary generation

Write the phase summary document. File path:

```
.claude/state/summaries/PHASE-<N>.md
```

Where `<N>` is the numeric phase index derived from `progress.json → phase`.
Example: `constitution-engine/phase-1` → `PHASE-1.md`.

Use `.claude/spec-templates/phase-gate.md` as the scaffold. Populate every section
with real data — no `{{PLACEHOLDER}}` left in the output.

Frontmatter:

```yaml
---
title: "Phase Gate: <phase label>"
status: Pending
phase: <phase field from progress.json>
date: <YYYY-MM-DD>
security_verdict: PASS | FAIL | CRITICAL
mutation_score: <N>%
---
```

**Sections to produce (in order):**

#### Gate Criteria

Fill from `.claude/spec-templates/phase-gate.md § Gate Criteria`. Values:

| Field | Value |
|---|---|
| Phase | Derived from progress.json |
| Triggered | All tasks in phase at done status |
| Approver | Human (HITL) |

#### Checklist

Populate every item from the template with real status (checked = pass, unchecked = fail/unknown):

- **Deliverables** — all tasks done (from Step 1)
- **Quality** — lint errors (from any pre-tool-use hook output), complexity thresholds (Plugin Law E:
  cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines), mutation score ≥ 60% (Step 3),
  QA review complete (check `docs/specs/weave/engines/qa-report.md` if present)
- **Artifacts** — PRs created (check `gh pr list --state open`), conventional commits
  (verify last 10 commits: `git log --oneline -10`), documentation updated
- **Environment** — verify the correct start commands for Weave's stack:
  - Backend: `uv run uvicorn app.main:app --reload` (FastAPI)
  - Frontend: `npm run dev` (Next.js)
  - Tests: `uv run pytest` (Python) / `npm test` (TypeScript)
  - Build: `npm run build` (Next.js frontend)
  - SPARQL: `docker compose up oxigraph` (if RDF store needed for phase)

#### Cost Summary

Read from transcript metadata if available, or leave Actual columns as `N/A (not instrumented)`.
Do not fabricate token counts.

| Metric | Estimated | Actual |
|---|---|---|
| Total tokens (input) | — | N/A |
| Total tokens (output) | — | N/A |
| Total cost | — | N/A |
| Variance | — | — |

#### Decision

Leave all three checkboxes unchecked — the human will check one during HITL.

#### Notes

Leave blank — the human fills this during review.

---

After writing the file, **run the constitutional self-check** (see below).
Then present the full document content to the user.

### Step 6 — HITL gate (mandatory, never skip)

Emit the confidence block, then ask via AskUserQuestion:

**Question:** "Phase gate for `<phase label>` is ready for your review.
Security: `<PASS|FAIL|CRITICAL>` | Mutation: `<score>%` (`<RED|GREEN>`) | UI-verify: `<PASS|RED|N/A>`.
What is your decision?"

**Options:** Approve / Amend / Reject

#### If Approve

1. Update `.claude/state/summaries/PHASE-<N>.md` — set `status: Approved` in frontmatter
   and check the Approve box in the Decision section.
2. Advance `progress.json` to the next phase **using the `phase_plan` array** (the ordered list
   of engine phases in `progress.json`; do NOT blindly increment the phase number):
   - Find the current `phase` in `phase_plan`; the next entry is the new `phase` value.
   - **A phase boundary in the plan is an engine boundary.** Approving this gate is the
     explicit engine-end HITL sign-off — say so in the question text so the approver knows
     they are releasing the next engine to build.
   - If the current phase is the **last** entry in `phase_plan`, do not advance. Instead run
     the **program-M1 sign-off ceremony**: verify every M1 exit criterion in
     `docs/specs/weave/weave-spec.md` §1.3 (validated mutation, NL query, Explorer render,
     generated app + write-back, cross-tenant isolation zero-leak re-assertion, coverage and
     mutation thresholds), present the evidence table, and record the human sign-off in
     `.claude/state/summaries/PROGRAM-M1-SIGNOFF.md`.
   Write the updated `progress.json` via the Write tool.
3. Commit both files:
   ```bash
   git add .claude/state/summaries/PHASE-<N>.md .claude/state/progress.json
   git commit -m "chore: phase gate approved — advance to <next phase_plan entry>"
   ```
4. Signal to `/implement` to continue by printing to stderr:
   ```
   [phase-gate] <phase> approved (engine boundary). Advanced progress.json → <next phase>.
   Run /implement to begin the next engine.
   ```
5. Exit 0. (The implement skill will pick up the new phase on its next invocation.)

#### If Amend

1. Update `.claude/state/summaries/PHASE-<N>.md` — set `status: Amend` and record the
   amendment notes in the Notes section.
2. Ask the user via AskUserQuestion: "Which items need fixing?" (free-text or checklist selection).
3. Present a diff of what will change in the summary document.
4. After the user provides specifics:
   - Re-run only the affected gate step (security / mutation / checklist)
   - Update the summary document with new results
   - Loop back to Step 6 (re-present the HITL question)
5. Do **not** advance `progress.json` until an Approve is received.

#### If Reject

1. Update `.claude/state/summaries/PHASE-<N>.md` — set `status: Rejected`.
2. Write an escalation file:
   ```
   .claude/state/escalations/PHASE-<N>-REJECTED-<YYYY-MM-DD>.md
   ```
   Content: phase name, date, rejection reason (from user notes), gate signals that failed.
3. Commit:
   ```bash
   git add .claude/state/summaries/PHASE-<N>.md .claude/state/escalations/PHASE-<N>-REJECTED-*.md
   git commit -m "chore: phase <N> gate rejected — replan required"
   ```
4. Halt the dark factory — print to stderr:
   ```
   [phase-gate] Phase <N> REJECTED. Dark factory halted.
   Address escalation at .claude/state/escalations/PHASE-<N>-REJECTED-<date>.md
   then re-run /implement to resume.
   ```
5. Exit 2 (blocks further automated progress).

#### Result block (emit after the decision is recorded)

After recording the chosen decision but **before** the branch's `exit` call (Approve `exit 0`, Reject `exit 2`),
emit a fenced `result` block as the final chat output of the gate so the orchestrator can parse the outcome
deterministically (see [Output](#output) for the schema):

- **Approve** → `status: ok`, `artifact_path` = `.claude/state/summaries/PHASE-<N>.md`, `failure_class: null`
- **Amend** → `status: fail`, `artifact_path` = `.claude/state/summaries/PHASE-<N>.md`, `failure_class: null`
  (gate loops back, not blocked)
- **Reject** → `status: blocked`, `artifact_path` =
  `.claude/state/escalations/PHASE-<N>-REJECTED-<date>.md`, `failure_class: null`

```result
status: ok
artifact_path: .claude/state/summaries/PHASE-1.md
failure_class: null
```

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (functional, automation-tested): complied | violated | N/A — <reason>
Plugin Law C (council-graded quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (synthetic verification only): complied | violated | N/A — <reason>
Gate Law 1 (evidence-based verdicts only): complied | violated | N/A — <reason>
Gate Law 2 (CRITICAL security blocks Approve): complied | violated | N/A — <reason>
Gate Law 3 (mutation < 60% is RED, not amber): complied | violated | N/A — <reason>
Gate Law 4 (no placeholder in summary doc): complied | violated | N/A — <reason>
Gate Law 5 (Reject halts dark factory via exit 2): complied | violated | N/A — <reason>
Gate Law 6 (UI gate re-executed, RED blocks Approve): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat — the user sees it. Keeps Laws active across long sessions.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific check, row, or signal>
Why: <1 sentence — what input was missing or what was assumed>
</section-confidence>
```

Rules:

- Always name the weakest part, even on high-confidence gates.
- "Why" must reference a specific input gap. "The future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the summary file.

## Output

**Primary output:** `.claude/state/summaries/PHASE-<N>.md`

Template: `.claude/spec-templates/phase-gate.md`

Directory: `.claude/state/summaries/` (create if missing with `mkdir -p`).

Frontmatter fields: `title`, `status`, `phase`, `date`, `security_verdict`, `mutation_score`.

Never leave `{{PLACEHOLDER}}` in the output.

**Secondary outputs (conditional):**

- `.claude/state/escalations/PHASE-<N>-REJECTED-<date>.md` — on Reject only
- Updated `.claude/state/progress.json` — on Approve only

**Terminal result block (always):**

The gate ends with a fenced `result` block as its final output. The orchestrator reads the **last** such block:

```result
status: ok | fail | blocked
artifact_path: <path or null>
failure_class: logic | dependency | interface | spec-ambiguity | null
```

Mapping from the HITL decision: Approve → `ok`, Amend → `fail`, Reject → `blocked` (see Step 6).

## Evaluation Criteria

A well-executed phase gate:

- Fires only when `progress.sh phase-check` returns `COMPLETE` — never mid-phase
- Invokes `/security-review` as a sub-skill and incorporates its verdict verbatim
- Reports a real mutation score from a test runner (or flags RED if runner absent — never fabricates)
- Displays the raw kanban board before presenting the summary
- Produces a `.claude/state/summaries/PHASE-<N>.md` with zero `{{PLACEHOLDER}}` entries
- Blocks Approve when any CRITICAL security finding is present
- Re-executes `ui_verify.sh --full` for every UI feature and blocks Approve on any non-zero exit
  (or a missing/unsigned run-book) — never trusts a cached PASS
- On Reject: writes an escalation file, halts the dark factory via `exit 2`
- On Approve: advances `progress.json` to the next phase and signals `/implement` to continue
- Constitutional self-check trace is present in chat for every section
- HITL loop never auto-resolves — the human must explicitly choose Approve / Amend / Reject
