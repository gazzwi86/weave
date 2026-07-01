# H3 — Council Synthesis & Revised Change-Set

**Status:** Post-council reconciliation (2026-06-30). SUPERSEDES H2 §4–§7 (the change plan). H2 §0–§3 (reframe,
engines/anchors, event-storm, 5-Whys core need) still stand.
**Council:** 6 members, all returned **ship-with-major-changes**. Full critiques in scratchpad `council-*.md`.

| Seat | Model | Verdict | Sharpest contribution |
|---|---|---|---|
| Boris Cherny | Opus | major-changes | `run-loop.sh` reinvents native headless; HARNESS.md should be *derived* not transcribed; phase-gate must *re-execute* ui_verify; pre-push is bypassable |
| Karpathy | Opus | major-changes | blocking gates are proxies not intent; epic PRs *lengthen* the human leash; demo n=1 ≠ false-pass rate |
| Harness-expert | Opus | major-changes | fresh-context-per-task is **incoherent** with keeping `/goal` as spine; `events.jsonl` is gitignored so not a durable checkpoint; pick ONE deterministic driver |
| Pragmatist | Sonnet | major-changes | `run-loop.sh` = tooling for a repo with no engine (blocker); freshness hook = scope creep; "zero-slop" framing self-contradictory |
| Anti-slop | Sonnet | major-changes | generated run-book *inverts* vouching; HARNESS.md needs structural row-parity + `last-vouched-by`, not mtime; harness should pass its own dogfood invariants |
| DevEx/CI | Sonnet | major-changes | **BLOCKER: `git push --no-verify` bypasses every pre-push gate**; pixel-diff macOS→Linux flaky; demo on throwaway = theatre |

---

## 1. The central conflict — `run-loop.sh` — and its resolution

**The split:** 4 seats say CUT it (greenfield has nothing to run unattended; it reinvents native `claude -p`; off-leash;
premature). The harness-expert says BUILD it as the *single deterministic driver* and retire `/goal…60 turns`.

**Why they're not actually opposed — and the resolution:** The harness-expert's deepest point is a *coherence* proof, not
an autonomy demand: you **cannot** claim "fresh-context-per-task" while keeping `/goal…60 turns` as the spine, because a
skill cannot `/clear` itself and keep driving. Fresh-context-per-task and an external driver are **coupled** — you get
neither or both. Since 5 of 6 seats (and operator scope = supervised, greenfield, targeted-hardening) say *don't build the
unattended driver now*, the coherent move is:

- **DEFER `run-loop.sh` and fresh-context-per-task together** (they're one decision, not two). Do **not** claim
  fresh-context in W3; **keep `/goal…60 turns`** — it is native, bounded, and is also the *cost ceiling / kill-switch* the
  harness-expert worried we'd lose.
- **RECORD the harness-expert's design as an ADR for when unattended is needed:** `run-loop.sh` as the single
  deterministic driver, each task a fresh invocation reading disk state, with the **portability split** made explicit —
  *portable spine* (`run-loop.sh` + `progress.json` + `audit.py`) vs *Claude-Code adapter* (`/goal`, Stop-hook `exit 2`,
  Skill dispatch). This directly serves the dogfood→Build-Engine framing without building prematurely.
- **KEEP only the durable, uncontested W3 pieces:** the **resume path** in `implement` Step 1 (reconstruct in-flight state
  from the *committed* `progress.json` + `summaries/*.md` — NOT `events.jsonl`, which is gitignored/local, per
  harness-expert) and a cheap `audit.py` task-transition log line (telemetry only, not the checkpoint of record).

This resolves the conflict honestly: it neither over-builds (4 seats) nor ships an incoherent autonomy claim (harness-expert).

---

## 2. Reconciled change-set (KEEP / CUT / REVISE)

### BLOCKERS — do these first (they make every other gate real)
- **B1 — Block `--no-verify` (DevEx, the single most-cited fix).** Add a `PreToolUse Bash` matcher in `settings.json` +
  `hooks.py` that rejects `git (push|commit) … --no-verify`. Without it, *every* pre-push gate — including the existing
  `check-anatomy-fresh` — is one Bash call from bypass. Cheap, foundational, fixes a pre-existing hole. **Ship first.**
- **B2 — Phase-gate RE-EXECUTES `ui_verify.sh` (Cherny + DevEx).** The enforcing seam is the Stop-hook→phase-gate path
  (`exit 2` blocks Approve, like `security-review` CRITICAL). It must *run the script and read the exit code*, not trust a
  cached PASS or agent prose. Pre-push is the secondary/advisory layer; **server-side CI is named as the true
  un-bypassable layer, deferred until an app exists.**

### W2 — UI-verification gate (KEEP, REVISED — this is the priority; build it early per Cherny's "one change")
- **KEEP:** deterministic functional click-through (Playwright launches the app, navigates, asserts) + axe zero-violations.
- **REVISE — v1 deterministic UI assertion = STRUCTURAL, not pixel (DevEx).** Assert ARIA roles / visible text / nav
  reachability / element existence. **Defer 8-state pixel-diff** until baseline generation is pinned to the CI Docker image
  (document this as the prerequisite; `testing-ts.md` keeps mandating it, but enforcing it un-pinned is the rot path).
- **CUT — vision check (W2.4) from v1 (Pragmatist + DevEx + Anti-slop; Karpathy neutral-advisory).** An advisory LLM verdict
  on top of deterministic checks is the *same* soft-skippable anti-pattern we're removing. Record as future option once
  `design.md` exposes machine-extractable token rules + a structured/`jq`-parseable verdict.
- **REVISE — run-book is human-authored, not AI-authored (Anti-slop, the inversion fix).** The agent scaffolds the template
  (screen names, nav path, expected states from ACs); the PR **blocks until a named human fills the "observed" column and
  signs** (`vouched-by: <name> <date>`). Playwright trace export attaches as supporting evidence.
- **REVISE — demonstrate against a COMMITTED fixture, not the throwaway prototype (DevEx + Anti-slop + Pragmatist).** Add
  tiny committed `good.html` + `broken.html` (missing nav link / contrast violation) static fixtures; `ui_verify.sh` must
  PASS good and CATCH broken — deterministic, builds identically everywhere. Real-stack validation explicitly deferred to
  the first `create-next-app` scaffold and documented as "wired, validated-on-fixture, real-stack-pending."

### W1 — Feature-coherent delivery (KEEP the goal, REVISE the mechanism)
- The user's pain (PRs too small; screens don't link up) is real, but the council showed naive "stack across per-task
  worktrees" is **mechanically broken** (a branch can't live in two worktrees — Cherny/harness-expert) and bigger PRs alone
  **lengthen the leash** (Karpathy).
- **REVISE:** group the PR at the **epic boundary** via a new `progress.sh epic-check`; run an epic's tasks **sequentially on
  the shared `feature/{epic}` branch** (drop per-task worktrees *for grouped epics*); and — the actual fix for "screens
  don't link up — run `ui_verify.sh` + a **cross-screen navigation integration check** on the *assembled* epic branch.
- **CUT** the bare `settings.json prGrouping` key (Pragmatist) — the CODIFY skill change + `epic-check` is sufficient.
- **Recorded trade-off (Karpathy dissent):** deterministic checks stay per-task (fast); human judgment + UI-assembly happen
  at the epic PR. Karpathy would want the human loop tighter (per-task). Operator can dial this; default = epic.

### W0 — Coherence & prune (KEEP, REVISED)
- **KEEP:** delete genuinely-dead `eslint.py` + `claude_review.py` (+ dispatch entries/imports + disabled `_examples`);
  delete deprecated `thinking-tools`; fix the QA category-count contradiction (7/8/10/11→one number); reconcile stale
  `harness-overview.md`; document `progress.sh`/`/sync`/`okf_visualize`/state dirs; dispose of dormant `drift_check`
  (document as local-LLM-gated, keep) and vestigial `review` status.
- **REVISE — `circular_deps.py`:** remove the dead *dispatch entry* (honest table) but keep the module per the README's
  "keep the slot," noted in the manifest.
- **REVISE — HARNESS.md (Cherny + Anti-slop, combined).** Not a hand-written doc with an mtime freshness badge (theatre).
  Instead: **rows derived/scaffolded from `settings.json` + skill/agent frontmatter**, and a `check-harness-manifest`
  gate that asserts **structural row-parity** (every skill dir / agent dir / module has a row) + a per-row
  `last-vouched-by: <name> <date>`. Enforced on structure, vouched by a human — not policed by file-touch.
- **REVISE framing:** drop the "zero-slop" claim (Pragmatist) — W0 itself prunes dead code; say "coherent but carrying
  legibility debt + a little dead code."

### W3 — Loop hardening (CUT most, KEEP the durable bit) — see §1
- **CUT:** `run-loop.sh`, fresh-context-per-task rebuild, retiring `/goal`. **KEEP:** resume path from committed
  `progress.json` + summaries; cheap `audit.py` transition log line. **RECORD:** ADR for the future deterministic driver +
  portability split.

### Recorded for the future (ADRs, not built now)
Deterministic driver + portability split · vision check (when tokens are machine-extractable) · 8-state pixel-diff (when
Docker-pinned baselines exist) · unattended/headless autonomy · harness self-dogfood tests (assert `testing-agents.md`
invariants — no self-approval, retry ceilings, immutable audit — against *this* loop) · authorship contract on all HITL artifacts.

---

## 3. Revised build order (sequenced)
1. **B1** block `--no-verify` (foundational; ~1 hook).
2. **W2 core**: `ui_verify.sh` (functional click-through + structural assertions + axe) + committed good/broken fixtures;
   prove PASS/CATCH. **B2** wire phase-gate to re-execute it.
3. **W2 run-book**: human-authored template + sign-off gate.
4. **W1**: `epic-check` + sequential-on-epic-branch CODIFY change + cross-screen integration check on assembled epic.
5. **W0**: prune dead code, fix QA count, reconcile overview, document opaque pieces; build derived **HARNESS.md** +
   `check-harness-manifest` structural gate.
6. **W3 durable**: resume path + audit transition log.
7. **ADRs** for the recorded-future set.
8. Verify (incl. running ui_verify on fixtures), commit, push `harness-refine`, open PR.

## 4. Open decisions for the operator (genuine forks)
- D1: Confirm **cut vision check from v1** (3 seats cut, 1 advisory). *Recommend cut.*
- D2: Confirm **structural assertions over pixel-diff for v1** (defer pixel-diff to Docker-pinned baselines). *Recommend.*
- D3: Confirm **W1 = epic PR via sequential-on-epic-branch + integration check** (vs keep small task PRs + integration gate
  only). *Recommend the epic reframe; it matches your stated pain.*
- D4: Confirm **defer `run-loop.sh`/unattended entirely**, record as ADR. *Recommend.*
- D5: Verification granularity (Karpathy): per-task human review (tighter leash) vs epic-PR human review (coherence). *Recommend epic, dialable.*
