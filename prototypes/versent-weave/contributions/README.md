# contributions/

Drop zone for contribution files exported from **`contribute.html`**. This is the
Phase-0 transport: the browser is the capture client, a markdown file is the
courier, and **Claude Code is the reconciliation engine**. No server, no login.

See `docs/contribution-model.md` for the full model and roadmap.

## The flow

1. **Capture** — a contributor opens `contribute.html`, picks a node (or
   "General"), answers the context-aware questionnaire / leaves feedback /
   proposes a change, then clicks **Download contributions (.md)**.
2. **Deliver** — they email the file to the curator, or drop it straight in here
   (`contributions/contribution-<name>-<date>.md`).
3. **Reconcile** — the curator (the human who runs Claude Code) asks:
   > "Reconcile the new files in `contributions/` into the graph."
   Claude then runs the process below.

## What "reconcile" means (the curator prompt expands to this)

For each new `contribution-*.md`, Claude Code:

1. **Parses** each item against the schema below.
2. **Maps** proposals onto `NODES` / `EDGES` in `versent-ai-first-network.html`,
   using only the 10 node classes and 7 verbs (`docs/versent-model.md`), and
   assessing each against the AI-first north star (prune plumbing, keep strategy).
3. **Diffs** every proposal against current data **and against the other
   pending contributions** — looking for: duplicates, contradictions (two people
   describe the same thing differently), and edits that fight existing data.
4. **Writes a reconciliation report** — `contributions/_report-<date>.md` — with
   three buckets: **Accepted** (applied), **Needs a decision** (curator picks),
   **Conflicting** (contributors disagree; names attached).
5. **Applies** the accepted changes. Anything contested or not-yet-ratified is
   added with **`proposed:true`** so it shows up dotted-magenta on the graph and
   is visibly "under review" until the curator resolves it.
6. Lets the **validate hook** run (dangling/duplicate/orphan/parity checks) and
   **updates `docs/versent-model.md`** if the model changed.
7. **Archives** processed files (move to `contributions/_processed/`).

The curator stays in the loop — Claude proposes and flags; the human arbitrates.
True multi-party self-service alignment is a Phase-2 feature (needs identity);
Phase 0 *surfaces* conflict and lets the curator resolve it.

## Contribution file format

A downloaded file bundles one or more contributions. Front-matter carries the
contributor; each `##` section is one item with its own YAML block:

````markdown
---
contributor: { name: "Jane Doe", team: "Data & AI" }
exported: 2026-06-16T...
count: 2
---
## 1. questionnaire — AWS SCA
```yaml
kind: questionnaire
context_node: awssca
at: 2026-06-16T...
```
**Q: What capabilities do those initiatives require to be delivered?**

Cloud migration at scale, plus FinOps which the map is missing.

## 2. proposed-change — General
```yaml
kind: proposed-change
context_node: null
```
**Proposed: add-node**
```
add-node: { label: "FinOps", cls: cap, status: emerging, desc: "..." }
add-edge: [awssca, <new>, uses]
```
````

`kind` is one of `questionnaire | freeform | proposed-change`. `context_node` is
a node id or `null`. See `_example-contribution.md` for a complete sample.
