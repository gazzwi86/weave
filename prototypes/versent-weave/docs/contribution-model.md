# Contribution & Feedback Model — proposal

> How we gather, reconcile, and align content for the AI-First Network graph.
> Companion to `versent-model.md` (the data model) and `CLAUDE.md` (working rules).
> Status: **proposal** — Phase 0 (MVP) is the recommended starting point.

---

## 1. The core insight (why this needs almost no infra)

The "agentic AI tooling that receives questionnaires/feedback, captures it in
markdown, applies the changes to the graph, and flags conflicts" **already exists
— it is Claude Code operating on this repo.** The repo already has:

- inline `NODES` / `EDGES` (the graph data),
- a living model doc (`versent-model.md`),
- a validation hook (`.claude/validate-graph.cjs`),
- the working rules that say *flag conflicts, keep the doc in sync, prune to the
  north star*.

So the AI "agent" in the loop is the **dev-loop curator agent**, not a hosted
service. That collapses the infrastructure requirement for an MVP to **zero**:
the browser is the capture client, a markdown/JSON file is the transport, and
Claude Code is the reconciliation engine.

**Honest framing:** this is a **curator funnel**, not autonomous tooling. Many
people contribute; **one technical curator (Gareth)** triggers Claude Code to
reconcile. In a zero-infra world a human must trigger the agent — that is fine,
but we should not imply Phase-2 autonomy from a Phase-0 build.

---

## 2. What "done" means — two halves, delivered in different phases

The brief asks for two distinct things. They have very different costs:

| Capability | Cost | Phase |
|---|---|---|
| **Capture** content/feedback (questionnaires, free-form, elicitation) | low | MVP |
| **Surface** conflict / misalignment between contributors | low–med | MVP |
| **Resolve & align** — multi-party, self-service agreement | high | Phase 2 |

MVP delivers *capture* + *surface*; the curator arbitrates conflicts. True
**self-service multi-party alignment** is the part that genuinely forces identity
and a shared place to hold the conversation — that is the Phase-2 trigger, not an
MVP feature.

---

## 3. A fork to decide up front — keep the strategy artifact pure

`CLAUDE.md` is fierce: *"business strategy on a page," "one view," "prune
plumbing, keep strategy."* Bolting a whole Contribute mode + questionnaires into
`versent-ai-first-network.html` is in tension with that north star.

**Recommendation: a separate companion capture page** (e.g.
`contribute.html`) that links to/from the graph, leaving the strategy artifact
pure. The graph stays the read view; capture lives next door.

Two real choices here (decide before building):

1. **Build vs reuse the questionnaire.**
   - *Recommended:* build a small in-browser, **context-aware** capture page so a
     contributor can launch *"what initiatives exist for the SCA?"* **from the SCA
     node** — context is the whole value, and it reuses the existing drawer/notes
     pattern.
   - *Cheaper alternative:* an off-the-shelf form (Tally / Google Form) → CSV →
     Claude reconciles. Less work, keeps the artifact clean, loses node context.
2. **Companion file vs bolt-on.** Recommended: companion file. Bolt-on only if we
   decide the graph page should be the single entry point.

---

## 4. Phase 0 — the MVP (no infra, no hosting, no login)

### 4.1 Capture (in the browser)
Extend the existing `drawer` + localStorage-notes pattern into **structured
questionnaires**, opened in-context from a node:

- **Templated prompts per node class.** e.g. from an `initiative` node: *"What
  initiatives exist for this? What capabilities do they need? What tools? What
  assets must be created?"* From a `cap` node: *"What certifications/training
  empower this? What assets help develop it?"*
- **Three input modes**, matching the brief: (a) structured questionnaire,
  (b) free-form Q&A / feedback notes, (c) a "propose a direct change"
  (add node / add edge / edit desc) form.
- All contributions accumulate in `localStorage` (reuse `getStore`/`setStore`),
  keyed by contributor + node.
- A **name + team** field gives us attribution **without auth**.

### 4.2 Transport (export, don't upload)
A **"Download my contributions"** button serialises everything to a single
markdown file with YAML front-matter (schema below). No server, no login. The
file *is* the transport — emailed or dropped into the repo's `contributions/`
folder.

### 4.3 Reconciliation (Claude Code, in-repo)
The curator drops contribution files into `contributions/` and asks Claude Code
to reconcile. Claude:

1. parses each file against the contribution schema,
2. maps proposals onto `NODES` / `EDGES` using the 7-verb taxonomy + registered
   classes (per `versent-model.md`),
3. **diffs** proposals against current data **and against each other**,
4. writes a **reconciliation report** (`contributions/_report-<date>.md`):
   accepted / needs-decision / conflicting, with provenance (who proposed what),
5. applies the safe/accepted changes; the validate hook runs automatically.

### 4.4 Surfacing conflict (in the graph)
Add a lightweight **`proposed`/disputed visual state** so contested or
not-yet-accepted items are visibly distinct until the curator resolves them
(see §6 — this is a small schema change, so the doc + validator must move with
it). The reconciliation report is the human-readable conflict ledger.

### 4.5 Distribution
Single static file(s). Email the HTML, or host as a **static** page (e.g. GitHub
Pages) — still no backend, no identity.

**What MVP does *not* do:** no automatic receipt of submissions, no per-person
accounts, no real-time merge, no self-service resolution. The curator is the
loop-closer.

---

## 5. Roadmap — keyed by forcing trigger, not by date

Build each capability **only when its trigger fires.**

### Phase 1 — frictionless collection (still no servers we run)
- **Trigger:** passing files by hand becomes the bottleneck.
- **Add:** contributions POST to a managed sink — Tally/Google Form, **or** a
  GitHub Issue/PR template via a form action. A scheduled cloud agent or GitHub
  Action batches and runs the same reconciliation Claude does today.
- **Still avoided:** identity (a name field suffices), hosted compute we operate.

### Phase 2 — identity + hosted agent + resolution UI
- **Triggers (any one):**
  - a **public endpoint** invites spam/abuse → need authn,
  - we must **trust attribution** (who really said this),
  - **per-person resolution** — pinging specific contributors to align,
  - **real-time / self-service merge** — no curator available, or scale.
- **Add (only what the trigger demands):** managed identity (Auth0 / Clerk /
  Cognito — never roll our own), a small datastore, a hosted agent endpoint
  (Anthropic API) for live elicitation, and a proper **review/merge + alignment
  UI** where contributors see conflicts and reconcile with each other.
- This is the **only** phase that genuinely needs hosting + login. Defer it until
  a trigger above actually fires.

---

## 6. Schema notes

### 6.1 Contribution file (Phase 0 export)
```markdown
---
contributor: { name, team }
created: <iso>
context_node: <node id or null>
kind: questionnaire | freeform | proposed-change
---
## proposals
- add-node: { label, cls, status, desc }
- add-edge: [from, to, type]
- edit: { id, field, value }
## notes
<free-form text / answers>
```

### 6.2 `proposed` status (small model change)
Surfacing conflict needs a way to mark contested items. Options:
- reuse `status:'emerging'` (no schema change, but overloads its meaning), **or**
- add a `proposed: true` flag / a `disputed` marker (cleaner, but touches the
  **node schema → `validate-graph.cjs` → `versent-model.md`**, per the
  keep-the-doc-in-sync rule).

Decide before building §4.4.

---

## 7. Open decisions (need a call before building)
1. Companion `contribute.html` vs bolt-on into the graph page? *(rec: companion)*
2. Build in-browser context-aware capture vs off-the-shelf form? *(rec: build)*
3. `proposed` flag vs reuse `emerging` for disputed items? *(rec: explicit flag)*
4. Who is the curator, and is a single curator acceptable for now? *(assumed: yes)*
