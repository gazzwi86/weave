# CLAUDE.md — Versent AI-First Network

Single-file interactive knowledge graph: **`versent-ai-first-network.html`**
(inline HTML/CSS/JS, Cytoscape.js from CDN, no build step). Open it directly in a
browser.

A companion capture page, **`contribute.html`**, gathers content/feedback into
markdown files (Phase-0 contribution MVP — no hosting, no login). Keep the strategy
graph **pure**; capture lives next door. Model + roadmap:
**`docs/contribution-model.md`**; reconcile process: `contributions/README.md`.

## North star
This is a **"business strategy on a page" as a graph** — how Versent's levers
compose into an **AI-first consultancy**. AI-First is the centre; everything else
must help articulate how the firm gets there. **Assess every change against this:
prune delivery plumbing and bookkeeping; keep strategy.**

## Read first
**`docs/versent-model.md`** is the living reference — the operating-model story,
node classes, the 7-verb relationship taxonomy, layout logic, and what's
deliberately out of scope (and why). Read it before changing the data model.

## Working rules
- **Keep the doc in sync.** When an instruction changes the model, update
  `docs/versent-model.md` in the same pass (incl. its change log).
- **Flag conflicts.** If a new instruction contradicts existing data or an earlier
  decision, call it out rather than silently overwriting; tidy the data as you go.
- **Data conventions:** node = `{id, label, cls, status:'live'|'emerging', desc}`
  (+ optional `proposed:true` for contested/unratified contributions — see the
  doc); edge = `[from, to, type]`. Use only the 7 verbs and the registered node
  classes (see the doc). No grouping/umbrella container nodes — wire leaves to
  their real parent. Capabilities and competencies are one class (`cap`).
- **Keep `contribute.html` in parity.** When `NODES` change, update the `DIR`
  mirror (id/label/cls) in `contribute.html`. The validate hook warns on drift.
- **Reconcile contributions** in `contributions/` per `contributions/README.md`:
  parse → map to the model → diff for conflicts → write a report → apply safe
  changes (mark contested ones `proposed`) → archive. The curator arbitrates.
- **One view:** the radial "rings" layout is the strategic view; don't reintroduce
  alternate layouts without being asked.
- **Verify after edits.** `.claude/validate-graph.cjs` runs automatically
  (PostToolUse hook) and reports dangling/duplicate/orphan/unknown issues. For a
  JS syntax check: extract the `<script>` and run `node --check`. For behaviour,
  drive it headless with Playwright and screenshot.

## Not a git repo yet
Run `git init` if you want history + a pre-commit hook. `.claude/validate-graph.cjs`
is ready to wire as `.git/hooks/pre-commit` (it exits 0 = warnings only).
