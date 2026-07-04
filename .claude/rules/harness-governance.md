# Harness governance

The **harness** is safety-critical infrastructure: it gates the agents, so the agents do not get to
re-gate themselves. A generation-tier model (sonnet) must never quietly rewrite the machinery that
constrains it. This rule makes every harness change pass a higher-power review first.

## What counts as "the harness"

**Requires governance (a change here is a "harness change"):**

- everything under `.claude/` **except** the exempt paths below — in particular
  `.claude/scripts/**`, `.claude/skills/**`, `.claude/agents/**`, `.claude/rules/**`,
  `.claude/commands/**`, `.claude/hooks/**`, `.claude/spec-templates/**`, `.claude/settings.json`,
  `.claude/HARNESS.md`
- `CLAUDE.md` (root and any nested) — the always-loaded operating instructions
- `docs/standards/**` — the rubrics the agents are graded against (code-review, testing, git-workflow)

**Exempt (normal agent-written state/data — no consult, no gate):**

- `.claude/state/**` — progress spine, summaries, QA ledgers
  (`qa-cross-task-findings.md`, `qa-project-issues.md`), session summaries, advisor-consult records
- `.claude/memory/**` — committed team memory (written by `/remember`)
- `.claude/plans/**` — plan scratchpads

If a path is ambiguous, treat it as a harness change (fail safe).

## The rules

1. **Advisor consult, always.** No harness change may be committed without a review by the advisor
   model (`advisorModel` in `settings.json` — currently `fable`). Spawn the advisor over the
   **planned overall change** (not file-by-file), record its verdict
   (`APPROVE` / `APPROVE-WITH-CHANGES` / `BLOCK`) in
   `.claude/state/advisor-consults/ADV-NNN.md`, and put the trailer `Advisor-Consult: ADV-NNN` on
   the commit(s). Address every blocking item before merge.
2. **HITL, additionally, for the enforcement core.** Changes touching the machinery that enforces
   the gates — `.claude/settings.json`, `.claude/scripts/hooks.py`, `.claude/scripts/modules/**`,
   `.claude/rules/**` — require explicit human approval (AskUserQuestion) before commit, regardless
   of the advisor verdict. These are wired into `permissions.ask` so the prompt is deterministic.
3. **Sonnet never self-modifies the harness unilaterally.** If a generation-tier agent hits a harness
   bug mid-task, it logs the finding to the QA ledger and continues — it does not fix it inline. The
   fix goes through the phase-gate remediation sweep (advisor-consulted) or an explicit harness PR.
4. **Weakening a gate is never a valid fix for a failing gate** (see
   [`git-safety.md`](git-safety.md)). Relocating enforcement to a better altitude is fine; removing
   it is not.

## Enforcement (defence in depth)

- **This rule** is always-loaded (`.claude/rules/*.md`), so it binds every session.
- **`permissions.ask`** in `settings.json` prompts the human on every `Edit`/`Write` to the
  enforcement core (rule 2) — the HITL requirement made deterministic, no new code.
- **Advisor-consult trailer check** (pre-commit): if staged paths include a harness file, the commit
  must carry an `Advisor-Consult: ADV-NNN` trailer whose record exists. *(Tracked follow-up — see
  the QA ledger; until it lands, the trailer is authored by convention and the advisor consult is
  invoked manually as in ADV-001.)*

Honest limit: local enforcement verifies a consult *record* exists, not that the consult was
genuine. Rule 2's human prompt on the enforcement core is what makes a fabricated consult
non-silent. This is as strong as local enforcement gets without server-side branch protection
(which this repo does not have — see [`git-safety.md`](git-safety.md)).
