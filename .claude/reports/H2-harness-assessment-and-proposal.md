# H2 — Harness Assessment & Refinement Proposal

**Status:** Proposal for review (2026-06-30) — pre-council draft
**Scope:** The `.claude` harness only (the "dark factory that builds the dark factory"), NOT the Weave product.
**Inputs:** H1 (landscape), scratchpad 00 (inventory), 02 (existing-context digest), 03 (loop wiring map); elicitation rounds 1–2.
**Engagement frame (locked with operator):** Golden path = **Graph Explorer**; success = **autonomous build loop**;
scope = **prune + targeted hardening** (subtractive-first); priorities = **UI verification · implement loop · coherence**.

---

## 0. The reframe (read this first)

The fear going in was "AI slop / vibe-coded sprawl." The inventory disproves it: **52 load-bearing elements,
zero "possible-slop."** The harness is a coherent, BMAD/spec-kit-shaped pipeline. The real problems are narrower
and more fixable:

1. **It gates on "tests pass," not "the UI works."** There is no step that launches the app and observes it.
2. **It ships one PR per task,** which is exactly why past runs produced fragments that "didn't link up."
3. **Legibility debt** — undocumented coupling, dead code left in the dispatch table, one stale map, an internally
   contradictory QA category count — makes a healthy harness *feel* untrustworthy.

So this is a **legibility + verification** job, not a teardown. Every change below is justified against deletion
first; we add only where a named gap demands it, and we add by **extending existing skills**, not multiplying them.

---

## 1. Engines & Anchors

### 1.1 Drivers (why this work exists)
- **Build Weave's engines fast, with confidence.** The harness is the production line for Constitution/Build/Events/
  Explorer. Throughput is bounded by how much the operator must babysit.
- **Dogfood the product.** This harness is a working prototype of the Weave **Build Engine** dark factory. Decisions
  made here are design evidence for the product — they must be *portable*, not just locally convenient.

### 1.2 Impediments (what blocks the drivers today) — each with file evidence
| # | Impediment | Evidence |
|---|---|---|
| I1 | **No "run the app & observe" gate** — "done" = tests pass, scores, static analysis | `qa/SKILL.md` 3a–3k; Playwright never invoked in QA; Lighthouse/axe are soft+conditional |
| I2 | **One PR per task** fragments a component; screens don't link up | `implement/SKILL.md` CODIFY 208–214: `gh pr create` per `feature/{TASK_ID}` |
| I3 | **Orchestrator context accumulates** across a 60-turn phase (drift risk on long phases) | `implement/SKILL.md` 120–122 single `/goal … 60 turns`; engineers/QA already fresh, orchestrator is not |
| I4 | **No headless path** for unattended runs | loop is interactive; 3 `AskUserQuestion` HITL gates; no runner script |
| I5 | **Legibility debt** | dead dispatch entries (`eslint.py`, `claude_review.py`, `circular_deps.py`); stale `docs/claude-harness-overview.md` (wrong spec layout); QA category count says 7/8/10/11 in four places; `progress.sh`/`/sync`/`okf_visualize`/state dirs undocumented |

### 1.3 Accelerators (what we already have — do NOT rebuild)
- Coherent per-artifact skill structure + persona orchestration shells (validated by spec-kit/BMAD convergence, H1).
- **Deterministic hook layer** — the single biggest reliability lever (H1 top idea #1); already the right place to pin gates.
- **`/goal … or stop after 60 turns`** native loop bound + Stop-hook `phase_gate()` → HITL (the Ralph-loop spine, H1).
- **`audit.py` event spine** (`events.jsonl` + `transcript.jsonl`) and **committed `progress.json` checkpoint** — the
  autonomy spine is ~80% built (map §4, §6).
- **Rich standards already written** — `testing-ts.md` (8 visual states, Lighthouse-100, axe) and `testing-agents.md`
  (promptfoo, SHACL grounding, Guardrails). The gap is *enforcement wiring*, not authoring.

### 1.4 Required abilities (the minimum set to clear the impediments)
A) Feature-altitude delivery. B) A real UI-verification gate. C) Fresh-context-per-task. D) Checkpoint/resume +
headless spine. E) Legibility artifacts (a harness manifest + doc reconciliation). F) A *reserved slot* for evals.

---

## 2. Event-storm of the harness's real personas

The personas that matter for *refining the harness* are its operators and agent roles (not the Weave product's
end-users). Timeline left→right; **🟥 = break-point** where the loop fails the operator today.

```
OPERATOR (you) ── /po ─────────▶ PO agent ── brief/prd/roadmap/epics (section HITL) ──▶ ✅ specs
OPERATOR ──────── /architect ──▶ Architect agent ── tech-spec + TASK-NNN briefs (HITL) ─▶ ✅ tasks
OPERATOR ──────── /implement ──▶ orchestrator sets `/goal … 60 turns`
   per task:  Architect curates ▶ Engineer (worktree, TDD) ▶ QA (worktree) ▶ CODIFY
                                                              │                 │
                                                        🟥 I1 QA proves         🟥 I2 one PR
                                                        "tests pass", never     per task → reviewer
                                                        opens the screen        can't see the whole
                                                                                component; screens
                                                                                don't link up
   across tasks: orchestrator context grows ── 🟥 I3 drift on long phases
   phase end:  Stop hook phase-check COMPLETE ▶ phase_gate skill ▶ 🟦 HITL Approve/Amend/Reject  ✅
   unattended? ── 🟥 I4 no headless entrypoint; 3 HITL gates assume a human is present
```

**Reading the storm:** the spec side (PO→Architect) is healthy and well-gated. Every break-point sits in the
**implement→verify→deliver** segment — which is precisely the operator's stated priority set. The fix is concentrated,
not diffuse.

## 3. The core need (5-Whys, confirmed with operator)

> Why an autonomous loop? → build engines faster with less babysitting. → Why babysitting now? → fragmented PRs +
> unverified UIs mean the human catches breakage late. → Why unverified? → the loop gates on "tests pass," not "UI
> works/links up." → Why? → there is no inner-loop run-the-app-and-click step. → Why? → the standards exist
> (`testing-ts.md`) but were never wired as loop gates.

**CORE NEED:** redefine "done" so that *a human could open the branch and the screen genuinely works and links
together* — and make the **loop** enforce that, not the operator. Everything else serves this.

*(Six Hats is intentionally delegated to the adversarial council in §7 — five chartered personas are a more honest
"black/yellow/green hat" challenge than me roleplaying all six.)*

---

## 4. Proposal — four workstreams

Ordered by the locked priorities. W0 is subtractive; W1–W2 are the core adds (via extension); W3 hardens; deferred
items are explicitly parked with a slot.

### W0 — Coherence & prune (subtractive, do first)
*Goal: the harness reads as legible and trustworthy; the dispatch table reflects reality.*
- **Remove genuinely dead code:** delete `modules/eslint.py` + its `POST_TOOL_USE_CHECKS` entry + import; delete
  `modules/claude_review.py` + entry + import + the disabled `settings.json._examples` block. (Map §4 confirms both are
  invoked by no wired path — not settings, not git-hooks.)
- **`circular_deps.py` — judgment call (flag to council):** README deliberately says "Disabled — keep the slot." Default
  proposal: **remove the dead dispatch entry** (so the table is honest) but **keep the module** under a clearly labelled
  "planned, re-enable with `madge --circular`" note in the manifest. Honours intent without false density.
- **Delete the deprecated `thinking-tools` skill** (consolidated into `elicit`); remove references in CLAUDE.md/docs.
- **Fix the QA category-count contradiction** (7/8/10/11 → one authoritative number) across `qa/SKILL.md` announce,
  Evaluation, and CLAUDE.md.
- **Reconcile the stale map:** `docs/claude-harness-overview.md` spec-tree → match CLAUDE.md + disk
  (`docs/specs/<entity>/<phase>/`).  *(Note: a parallel branch may be re-merging specs — see §8 risk.)*
- **Document the opaque-but-load-bearing pieces:** `progress.sh` subcommands, `/sync` vs `reconcile`, `okf_visualize`,
  and the `state/context|discovery|summaries` lifecycle — in the manifest below.
- **NEW anti-slop artifact — `.claude/HARNESS.md` (the manifest).** One table: every skill/agent/hook/script →
  *why it exists · who invokes it · what breaks without it · status (active/disabled/deprecated)*. Borrowed from
  harness-kit's declarative-manifest idea (H1 #7). This is the direct cure for "I want to understand what we have."
  **It MUST ship with a freshness mechanism or it rots into the next `harness-overview.md` (that rot is literally
  impediment I5).** Mechanism, decided now (not a council open-question): a `PostToolUse` check that marks HARNESS.md
  stale when any file under `.claude/skills|agents|scripts` or `settings.json` changes (reuse the `mark-anatomy-stale`
  pattern in `wiki.py`), plus a **pre-push `check-harness-fresh`** gate (sibling to `check-anatomy-fresh`) that blocks a
  push when the manifest is stale. The manifest is enforced, not hoped-for.

### W1 — Feature-altitude delivery (fixes I2, the "PRs too small" pain)
*Goal: one reviewable, navigable feature per PR; UI verified on the assembled whole.*
- **`implement/SKILL.md` CODIFY (208–214):** commit per task onto a shared `feature/{epic}` branch; open the PR only when
  the epic/feature is complete (stacked commits → one feature PR — the operator's chosen model and CLAUDE.md's own "stacked
  PRs per phase" convention).
- **`progress.sh`:** add `epic-check <epic-id>` (mirror `phase-check`, filter by epic) and set `epic.status=done` (kanban
  already reads it; nothing sets it today). The loop fires the grouped PR on epic completion.
- **`settings.json weave.git`:** add `prGrouping: "epic"`; keep task branches as stacked children of the epic branch.

### W2 — UI-verification gate (fixes I1, the core need)
*Goal: "done" for a UI story = the screen runs, clicks through, looks right, is accessible, and ships with a run-book.*

**Enforcement location is the whole point (advisor blocker #2).** Today's soft Lighthouse/axe are skippable *because
they live as QA-agent prose*. Adding another "hard FAIL" instruction in the same prose rebuilds that exact problem — an
instruction to fail is still the agent choosing to comply. So the deterministic steps become a **real script the loop
runs regardless of the agent**, mirroring how `phase-gate` Step 2 makes a `security-review` CRITICAL **block Approve
programmatically**:
- **NEW `.claude/scripts/ui_verify.sh`** (deterministic, exit 0/2): launches the built app, runs the Playwright
  click-through, runs the 8-state `toHaveScreenshot` diff (`maxDiffPixelRatio 0.01`), runs `axe` (zero violations) and
  Lighthouse against the app bar. Exit 2 = block. Invoked from the **pre-push git-hook** (alongside `check-anatomy-fresh`)
  AND surfaced as a **programmatic check in `phase-gate`** — not as a sentence in `qa/SKILL.md`.
- `qa/SKILL.md` gets a new category that *calls the script and reports its result* (the agent reads the verdict; it
  cannot wish it away).

The five steps, with their enforcement tier made explicit:
1. **Functional click-through** — `ui_verify.sh` launches the app + runs Playwright as real navigation. **Deterministic gate.**
2. **Visual 8 states** (`testing-ts.md`) — pixel-diff vs baseline; unmatched/drifted blocks. **Deterministic gate.**
3. **Accessibility** — `axe` zero violations + **Lighthouse-100** app bar. **Deterministic gate.**
4. **Vision check** — Claude views the screenshots, judges vs `docs/standards/design/design.md` (CONFIRMED to exist).
   **Advisory/additive only** — it can warn and feed the engineer (evaluator-optimizer, H1 #5); it does not block. This
   is the correct home for the one non-deterministic signal.
5. **Human run-book** — generated numbered "open the branch and click this" scenario, attached to the PR (operator-requested).
- **Wire it:** `implement/SKILL.md` ASSESS (174) calls `ui_verify.sh` for UI tasks; DoD (165) requires the run-book.
- **Demonstrated, not just described (advisor blocker #1):** the repo is greenfield (no app; Graph Explorer is Phase 2),
  so "done" for THIS engagement = the gate is wired **and empirically demonstrated** against the runnable
  `prototypes/weave-prototype/frontend` app (read-only, never committed): it must (a) PASS the known-good screen and
  (b) CATCH a deliberately-broken one (e.g. a removed nav link / contrast regression). Without (b) the gate is unproven.

### W3 — Implement-loop hardening (fixes I3, I4; builds the autonomy spine)
- **Fresh-context-per-task (I3):** replace the single 60-turn `/goal` with a per-task entry that re-reads only
  `progress.sh ready` + the task brief + dependency summaries (the `summaries/{TASK_ID}.md` + `subagent_stop` injection
  channel already exists). Orchestrator sheds drift between tasks; engineers/QA already fresh.
- **Checkpoint/resume (I4, 80% built):** extend `audit.py._summarise` to log task-state transitions (task_id, status,
  retry_count, PR url) → `events.jsonl` becomes a true checkpoint stream. Add a **resume** path to `implement` Step 1 that
  reconstructs in-flight state from `progress.json` + latest summaries instead of assuming a clean start.
- **Headless entrypoint (I4):** NEW `.claude/scripts/run-loop.sh` driving `ready → engineer → QA → update`. It
  **halts-and-waits at every HITL gate** (scaffolding, ASSESS retry, phase gate) — it does NOT auto-approve. (Advisor
  blocker: auto-approve-if-reversible/halt-if-destructive logic was NOT requested, is the newest+riskiest code, isn't
  subtractive, and a greenfield repo has nothing to run unattended yet. The spine — log + resume + entrypoint — is the
  endorsed deliverable; the risk-escalation auto-approve is explicitly deferred to a future, separately-gated step.)

### Deferred — explicitly parked, slot reserved (no rework later)
- **Evals (Theme B):** design W2's gate so a `promptfoo` step (on `prompts/`/`.claude/skills/` changes) and an
  `assert_grounded()` SHACL check (on agent graph writes) slot into the same QA category later. Target standard:
  `testing-agents.md`. Not built this engagement (operator choice).
- **Full unattended autonomy:** W3 builds the spine; running fully lights-out is a later, separately-gated step.
- **Spec-level dedup gate** (catch cross-PRD feature collisions, per spec-hardening findings) — noted, not in scope.

---

## 5. Risks & trade-offs (Law 1)
- **Feature PRs = larger diffs.** Mitigated by stacked per-task commits (reviewable history) + the run-book (reviewer
  clicks, doesn't only read).
- **Vision check is non-deterministic + costs tokens.** Mitigated by making it *additive* — deterministic gates block;
  vision advises. Start with the ~20-case discipline from Anthropic's eval guidance (H1).
- **Fresh-context-per-task can lose nuance.** Mitigated by the existing dependency-summary handoff; this is the proven
  Ralph/Archon pattern, not novel.
- **Headless auto-approve is the riskiest add.** Mitigated by reversible-only auto-approve + halt-on-destructive, and by
  keeping supervised the default. This is the one place to be conservative.
- **Bigger picture:** none of W0–W3 touches the spec side (PO/Architect), which is healthy — footprint stays tight,
  easing the merge with the parallel branch (§8).

## 6. Definition of success for this engagement (the dogfood)
The repo is greenfield, so success is **the harness machinery, enforced and demonstrated** — not a built Graph Explorer:
1. `ui_verify.sh` exists, is wired (pre-push + phase-gate programmatic check), and is **demonstrated** against the
   runnable `weave-prototype/frontend`: PASSES the good screen, **CATCHES** a deliberately-broken one.
2. `/implement` CODIFY produces **one feature PR** (stacked task commits), not one-per-task — verified by reading the
   revised skill + a dry-run trace.
3. The autonomy spine (audit transition log + resume path + `run-loop.sh` that halts at gates) exists.
4. `.claude/HARNESS.md` exists, is freshness-gated, and the operator can explain every element from it.
5. Dead code removed; QA category count consistent; `harness-overview.md` reconciled.
Graph Explorer remains the *aspirational* end-to-end target for when the Platform shell exists — not this engagement's bar.

## 7. For the adversarial council — chartered to real risks (not generalists)
Each persona is mapped to a specific risk this proposal could get wrong:
- **Security/automation persona → enforcement + headless safety:** Is `ui_verify.sh` actually un-bypassable, or can the
  agent skip the pre-push gate? Is even a halt-and-wait `run-loop.sh` a foot-gun on a repo with live AWS/Cognito creds?
- **Harness/automation persona → does feature-altitude PRing fight Claude Code's worktree-per-task model** (engineer
  spawns with `isolation: worktree` per task)? Can stacked commits onto one `feature/{epic}` branch even work across
  per-task worktrees, or does this need rethinking?
- **Pragmatist engineer → is W2 too heavy?** Is demonstrating against a prototype real proof or theatre? Should the
  vision check exist at all in v1, or is functional+visual+axe enough?
- **Anti-slop/legibility persona → manifest rot + scope:** Will HARNESS.md + its freshness hook actually be maintained,
  or is it more machinery to forget? Is anything in W0–W3 still speculative (Law 2)?
- **Product/portability persona → does this design travel** into the Weave Build Engine, or is it a local hack?

## 8. Known external risk
A parallel agent is editing `.claude/` and possibly re-merging specs on `spec/bpmo-reframe-and-hardening`. This branch
(`harness-refine`) is isolated from `61dfc15`/`e6499f8`. Expect conflicts on shared files (`settings.json`, `implement`/
`qa` SKILL.md, CLAUDE.md). Mitigation: surgical edits, well-separated; deliver as a **PR**, reconcile at merge — do not
merge to main blind.
