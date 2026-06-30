# Running the implementation loop (operator runbook)

The consultable "how do I actually run this now" guide, current as of the 2026-06-30 harness
refinement (PR #1). It reflects the live `implement` / `qa` / `phase-gate` skills. For the *why*
behind these changes see `.claude/reports/H2`–`H4`; for what every harness element is, see
`.claude/HARNESS.md`.

## TL;DR — what changed for you
- **One PR per EPIC**, not per task. An epic's tasks commit sequentially onto one `feature/{epic}`
  branch and ship together as a coherent, navigable feature.
- **A new blocking gate: UI verification** (`ui_verify`). For any UI-affecting work the screen must
  render, click through, link up, and be accessible — "tests pass" is no longer enough.
- **A new human touchpoint:** you sign a UI **run-book**. The agent scaffolds it; only a human fills
  the "observed" column and the `vouched-by:` line. The loop cannot sign it for you.
- **`/goal` spine and the 60-turn cap are unchanged.** Scaffolding, ASSESS-retry, and phase-gate HITL
  are unchanged in shape (phase-gate now also reports a UI verdict and checks the run-book).
- **You cannot `git push --no-verify`** — it is blocked. If a gate is wrong, fix the gate.

## The command sequence (unchanged entry points)
```
/po          → brief, PRD, epics, roadmap         (section-by-section HITL)
/architect   → tech spec + TASK-NNN task briefs    (section-by-section HITL)
/spec-review → completeness gate before scaffolding
/implement   → the loop below
/status      → kanban + next action at any time
```

## The /implement loop in detail

```
Step 1  Read state  ── Step 0: RESUME from committed progress.json + summaries (not a clean start)
        │            then: progress.sh kanban / ready → next dependency-satisfied task
Step 2  Scaffold (first run only) ──────────────────────── 🛑 HITL: approve scaffold
Step 3  PDAC loop, per task (one /goal run, "…or stop after 60 turns"):
        PLAN     curate context for the task brief
        DELEGATE engineer (TDD) runs IN PLACE on the shared feature/{epic} branch
                 — sequential, no per-task worktree (a branch can't live in two worktrees)
        ASSESS   QA validates (3a–3l). For UI tasks, category 3l RE-RUNS ui_verify (hard fail).
                 FAIL → classify (logic/dependency/interface/spec-ambiguity), retry within cap
                 (3/1/1/0); cap exhausted → 🛑 escalate to human
        CODIFY   progress.sh epic-check {EPIC_ID}:
                   INCOMPLETE → loop to next task in the epic, NO PR yet
                   COMPLETE   → (UI epics) run ui_verify --full on the ASSEMBLED app
                               (cross-screen "links up" check); non-zero BLOCKS the PR
                             → open ONE PR for the epic → /code-review on it
Step 4  Phase gate (fires when progress.sh phase-check = COMPLETE, via the Stop hook):
        security-review (CRITICAL blocks) · mutation · UI-verify re-run (+ run-book sign-off)
        · kanban · summary ──────────────────────────────── 🛑 HITL: Approve / Amend / Reject
```

## Where the HITL gates are (the complete list)
| # | Gate | When | You decide |
|---|------|------|-----------|
| 1 | Scaffold approval | First run only, after boilerplate is generated | Approve / Amend / Reject |
| 2 | ASSESS escalation | A task exhausts its retry-class cap | How to unblock (or replan) |
| 3 | **UI run-book sign-off** | Before a UI epic's phase gate can pass | Open the branch, click the scenario, fill "observed", sign `vouched-by:` |
| 4 | Phase gate | All tasks in a phase done | Approve / Amend / Reject (blocked if security CRITICAL, or UI-verify RED, or run-book unsigned) |

Everything between gates runs autonomously under `/goal` (capped at 60 turns).

## The UI verification gate — how to make it pass
`ui_verify.sh` (`.claude/scripts/ui_verify.sh`) is the deterministic gate. It **fails closed** — a
missing browser/Lighthouse toolchain is a FAIL, not a skip.

It runs, in order:
1. **structure + links-up + axe** (browser-free; `e2e/ui-verify/structural-check.mjs`) — every in-page
   nav target must exist; one `<main>`; `lang`; zero axe violations.
2. **Playwright** functional click-through.
3. **8-state visual diff** (`maxDiffPixelRatio 0.01`).
4. **Lighthouse** = 100 across perf/a11y/best-practices/seo.
5. **vision check** vs `docs/standards/design/` — **advisory only, never blocks**.
6. **human run-book** sign-off — blocks if missing/unsigned.

**To run the full gate you need the browser toolchain once:**
```
cd e2e/ui-verify
npm ci
npx playwright install --with-deps chromium      # one-time, for steps 2–4
npm run baselines:docker                          # generate pixel baselines in the PINNED Docker
                                                  # image (NOT locally — macOS≠Linux pixels)
```
Then the loop calls it for you. To sanity-check the gate logic without a browser:
```
node e2e/ui-verify/structural-check.mjs e2e/ui-verify/fixtures/broken.html   # exits 1, lists defects
```

**The run-book:** scaffolded from `.claude/spec-templates/ui-runbook.md` and attached to the epic PR.
You open the branch, perform each step, fill the **Observed** column, and set `vouched-by: <name>
<date>`. An unsigned run-book is treated as RED at the phase gate — a screen no human has vouched for
is not done.

## Enforcement you cannot bypass
- `git push/commit --no-verify` and `commit -n` → **blocked** by `check-git-safety`.
- **Pre-push** runs `check-harness-manifest` (blocking — every harness element must have a row in
  `.claude/HARNESS.md`) and a blocking `/security-review`.
- **Phase-gate** blocks Approve on a CRITICAL security finding, a UI-verify non-zero exit, or an
  unsigned run-book.

## Long runs & resume
The loop runs supervised under `/goal` (you're present at the gates). If it is killed mid-phase, just
re-run `/implement` — Step 0 reconstructs in-flight state from the committed `progress.json` + the
`.claude/state/summaries/*.md`, and re-enters at any task still `in_progress`. `progress.json` is the
checkpoint of record (the `.claude/logs/*/events.jsonl` audit stream is local telemetry, not durable).
Fully unattended/headless execution is **deferred** — see `.claude/reports/H4` ADR-H1/H4.

## Keeping the harness honest
`.claude/HARNESS.md` is the manifest — one row per skill/agent/script/module with purpose, who invokes
it, what breaks without it, and `last-vouched-by`. Regenerate after adding/removing a harness element:
```
python3 .claude/scripts/harness_manifest.py generate   # add rows for new elements, flag removed ones
python3 .claude/scripts/harness_manifest.py --check     # structural parity (the pre-push gate)
```
A missing row blocks the push; a `TODO` in `last-vouched-by` only warns — replace it with your name +
date once you've confirmed a row is accurate.

## Deferred (so you're not surprised by what's absent)
AI-feature evals (promptfoo/SHACL), full unattended autonomy, vision-check-as-blocking, harness
self-dogfood invariant tests, and per-row human vouching. Each is a recorded decision with a reopen
trigger in `.claude/reports/H4`.
