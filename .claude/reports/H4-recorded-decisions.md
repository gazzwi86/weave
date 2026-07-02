# H4 — Recorded Decisions (deferred-but-not-dropped)

**Status:** Decision record (2026-06-30). These are choices the council surfaced that we deliberately
deferred this engagement. Recording them here so they are *decisions*, not forgotten gaps. Each has a
trigger that should reopen it.

---

## ADR-H1 — Single deterministic loop driver + portability split (when unattended is needed)
**Context.** The harness-expert seat proved that "fresh-context-per-task" is incoherent while
`/goal … 60 turns` remains the spine (a skill cannot `/clear` itself and keep driving) — they are one
coupled decision. Four other seats said don't build an unattended runner on a greenfield repo.
**Decision (deferred).** Keep `/goal … or stop after 60 turns` as the supervised spine and the cost
ceiling. Do NOT build `run-loop.sh` or fresh-context-per-task now. WHEN unattended/headless execution
is genuinely needed (or when productizing into the Build Engine), introduce `run-loop.sh` as the
*single deterministic driver* for both supervised and headless: each task a fresh invocation reading
disk state (`progress.json` + summaries). Make the **portability split** explicit at that point:
- *Portable spine* (travels into the Build Engine): `run-loop.sh` + `progress.json` + `audit.py`.
- *Claude-Code adapter* (swapped per runtime): `/goal`, Stop-hook `exit 2` injection, Skill dispatch.
**Trigger to reopen.** First requirement for an overnight/CI/headless run, or Build-Engine productization.
**Reopened 2026-07-02.** Trigger fired: operator requires limit-spanning long runs through M1.
`run-loop.sh` built at `.claude/scripts/run-loop.sh` as the single deterministic driver — fresh
`claude -p "/implement"` invocation per iteration reading disk state, halting (exit 3) whenever an
invocation ends without advancing `progress.json`/HEAD (a HITL gate needs a human). Usage-limit
handling lives in the Claude-Code adapter layer as designed: primary→fallback model switch
(default `claude-fable-5` → `claude-opus-4-8`), then sleep-until-window-reset, fed by the
`StopFailure` hook (`modules/limits.py` → `.claude/state/limit-hit`).

## ADR-H2 — Vision check stays advisory until it can be deterministic
**Context.** 3 seats wanted the LLM vision check cut as soft/skippable; operator kept it advisory;
Karpathy: acceptable only if the *human* check is mandatory (it is — the signed run-book).
**Decision.** Vision check is advisory (never blocks) for v1. Promote it to a blocking gate only when
`docs/standards/design/` exposes machine-extractable token rules AND the check emits a structured,
`jq`-parseable verdict with an exit code (no free-text "looks fine").
**Trigger.** Design tokens become machine-extractable; or repeated escapes that only a vision check catches.

## ADR-H3 — Pixel-diff baselines must be Docker-pinned before they block
**Context.** DevEx: committed screenshots are macOS→Linux flaky at `maxDiffPixelRatio 0.01`; the rot
path is teams merging `--update-snapshots` to silence CI.
**Decision.** v1 blocking visual check = structural assertions (`structural-check.mjs`). The 8-state
pixel-diff (`nav.spec.ts`) blocks ONLY once baselines are generated in the pinned Playwright Docker
image (`e2e/ui-verify/update-baselines.sh`). Never loosen `maxDiffPixelRatio` to absorb platform drift
— pin the generation platform instead. Baselines are intentionally uncommitted until Docker-generated.
**Trigger.** Docker available in dev+CI; first real component with the 8 states.

## ADR-H4 — Unattended autonomy deferred (supervised-only for now)
**Context.** Operator chose "build the spine, defer full unattended." Auto-approve-if-reversible was
cut as the riskiest, unrequested code; greenfield has nothing to run unattended.
**Decision.** Supervised long runs only (`/goal` + phase-gate HITL). `run-loop.sh`, when built (ADR-H1),
halts at every gate. Before any lights-out run, REQUIRE: durable event log (beyond gitignored
`events.jsonl`), a global kill-switch / cost ceiling, and a scoped non-prod `AWS_PROFILE` assertion
that hard-exits on a prod profile (DevEx — the harness sits near AWS/Cognito/Bedrock creds).
**Trigger.** A concrete need for overnight/CI execution.
**Reopened 2026-07-02 (partially).** See ADR-H1 reopen note. Preconditions delivered: kill switch
(`touch .claude/state/run-loop.stop`), cost ceiling (`--max-iterations`, default 25, atop /goal's
60-turn cap), and the non-prod `AWS_PROFILE` assertion (exit 6 on `*prod*|*prd*|*live*`). Still
deferred: durable event log beyond the append-only `.claude/logs/run-loop.log` — reopen at the
first real overnight run. The gates themselves remain human-only; run-loop never auto-approves.

## ADR-H5 — Harness should pass its own dogfood invariants
**Context.** Anti-slop seat: `docs/standards/testing-agents.md` specifies dark-factory behaviour
invariants for the *generated* Build Engine — no self-approval at gates, retry-class ceilings,
immutable/append-only audit — that also describe THIS harness's loop. The harness is the Build Engine's
prototype; it should pass its own tests.
**Decision (next engagement).** Add coupling tests asserting, against the harness itself: phase-gate
cannot self-approve (already true: HITL is human + security CRITICAL blocks programmatically);
retry-class ceilings (3/1/1/0) hold; `audit.py` is append-only. Not built this engagement.
**Trigger.** Next harness-hardening pass, or first incident where one of these invariants is violated.

## ADR-H6 — Authorship contract on HITL artifacts
**Context.** Anti-slop seat: "a computer can't be held accountable" — every human-in-the-loop artifact
needs a named human + date, or "human in the loop" is a claim not a property.
**Decision.** `vouched-by: <name> <date>` is required on: the UI run-book (implemented, gates UI work),
HARNESS.md rows (field present; WARN-only at bootstrap). EXTEND to the phase-gate Approve record (write
the approving human's name + date into `PHASE-<N>.md`).
**Trigger.** Phase-gate skill's next edit; or any audit asking "who approved this?".

---

### Not in scope (recorded so the omission is explicit, not an oversight)
- **Spec-level dedup gate** (cross-PRD feature-ownership collisions) — a real finding from spec-hardening,
  but a *spec* concern owned by the parallel spec branch, not this harness pass.
- **`docs/claude-harness-overview.md` + CLAUDE.md spec-path reconciliation** — the spec layout is in flux
  on the parallel `spec/bpmo-reframe-and-hardening` branch; reconciling here would collide. Left to that branch.
