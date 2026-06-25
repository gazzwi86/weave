# Versent AI-First Network — Reference Model

> Living reference for `versent-ai-first-network.html`. Keep this in sync with the
> graph data (`NODES` / `EDGES`). When instructions change the model, update this
> doc in the same pass, flag conflicts, and tidy the data.

_Last updated: 2026-06-16 · 63 nodes, 131 edges._

---

## 1. North star — what this is

A **business strategy on a page, represented as a graph.** It shows how Versent's
levers — pillars, practices, delivery modes, offerings, capabilities, cultural
components, tools, assets, partners — **compose and relate to create an AI-first
consultancy.** AI-First is the centre; everything else exists to enable it.

This is the lens for every decision: **does a node/edge help articulate how
Versent becomes AI-first?** If not, it doesn't belong here. Prune delivery
plumbing and bookkeeping; keep the strategy.

---

## 2. How Versent operates (the story the graph tells)

1. **AI-First** (centre) — a rebuilt operating model: human-led, outcome-priced,
   agent-amplified. Judgment amplified, not replaced.
2. **Five pillars enable it** — Principles, People+Agents, Toolkit, Knowledge and
   Culture (Culture is an enabler; its cross-cutting nature is shown via `intersects`
   edges to Principles and People+Agents, not a separate node type).
3. **People+Agents holds the practices** — Digital+AI (with Data & AI as a
   sub-practice), Security & Identity, Cloud, Growth, Modernisation, and the new
   **Operating Model** practice (consumes ontologies).
4. **Practices deliver offerings** — AI Pathfinder, Data Pathfinder, Agentic
   Experience, Data Accelerators, Developer Experience, Future of Work, CIAM, etc.
5. **The ontology flywheel** — pathfinder offerings leave behind an ontology of a
   client's data and rules; agents (**BluShift**, **VEEP**) read it to reason about
   the business, so every engagement accelerates the next.
6. **The AWS SCA** (`initiative` class) — a five-year Strategic Collaboration
   Agreement undertaken in partnership with AWS; funds the AI-first push (AI-Led
   Cloud Migrations, Agentic AI Modernisation, Sovereign-by-Design Cloud) and builds
   assets like BluShift and App Xray. **AWS itself is a `partner`; the SCA is the
   `initiative`** — the two are linked (`AWS enables AWS SCA`).
7. **Partner ecosystem** powers delivery — AWS, Microsoft, Ping Identity, HashiCorp,
   Databricks, Snowflake.
8. **Capabilities** (people's skills) underpin everything — Cloud Migration,
   Solution Architecture, Application Engineering, Data Engineering, MLOps & AI
   Engineering, IAM/CIAM, Cyber, SRE, Advisory — grown through guilds,
   Certapalooza and culture, applied through Build.

---

## 3. Data model

### Node classes (`CLS`)
| class | meaning | colour |
|---|---|---|
| `core` | the goal (AI-First) | `#39ff7a` neon green |
| `pillar` | enabler / pillar (incl. Culture) | `#62d98a` soft green |
| `cap` | capability / skill (disciplines **and** people-skills — unified) | `#ffb84d` amber |
| `asset` | asset / product (BluShift, VEEP, certs) | `#ff6b6b` red |
| `offering` | productised offering | `#c08bff` violet |
| `initiative` | strategic initiative (the AWS programme) | `#ff9d3c` orange |
| `tool` | tool (Claude Code, Anthropic, Notion…) | `#c8cdd6` grey |
| `ritual` | ritual / community of practice (guilds, Certapalooza…) | `#8fd6ff` light blue |
| `practice` | practice / discipline of the firm | `#3fd9c4` turquoise |
| `partner` | partner / alliance | `#9aa6b8` steel |

Vivid hues are reserved for **nodes**; **edge** colours are a separate muted/neutral
set (steel, dark-grey, green-teal, blue, grey, mauve, tan) so a colour never means
two things. Edge style adds a second cue: solid / dashed / dotted (with clearer
dash patterns), arrowed except `intersects`.

### Relationship taxonomy (`EDGE_TYPES`) — 7 verbs
| verb | meaning |
|---|---|
| `enables` | makes possible / empowers (pillars→goal, partners→SCA→goal, guilds/certs→capabilities) |
| `comprises` | is made up of (containment) |
| `delivers` | produces the value of (practices→offerings, →ontologies, →assets) |
| `uses` | draws on at run time (practices→partners & capabilities, agents→tools & ontologies) |
| `intersects` | shares membership (pillar↔pillar, e.g. Culture↔Principles/People) |
| `instance-of` | is an example of (assets & skills → Agentic Engineering; cert→Anthropic) |
| `informs` | feeds knowledge into (ontologies→Knowledge/People, Agentic Eng→People, AI Guild→Agentic Eng, Principles→People) |

### Layout
Single **radial "rings"** view. A node's ring = undirected BFS hop-distance from
`aifirst`; each subtree gets an angular wedge (blended equal-share + subtree-weight
so nothing crowds). Deterministic — computed once (`RADIAL`). Status: `live` =
solid border, `emerging` = dashed.

### Conventions
- **Node:** `{id, label, cls, status:'live'|'emerging', desc}` — plus an optional
  `proposed:true` flag (see below).
- **Edge:** `[from, to, type]` using the 7 verbs above.
- **`proposed` (optional):** marks a node that came from a contribution and is
  **not yet ratified** — disputed, or awaiting the curator's decision. Renders
  dotted-magenta ("under review") and is dropped (or the flag removed) once
  resolved. Set by the reconcile step, not authored by hand. Edge-level
  `proposed` is deliberately deferred (node-level is enough for MVP).
- **No grouping/umbrella nodes** (e.g. a "Partners"/"Practices" container) — they
  add comprises-spoke noise. Wire leaves directly to their real parent (a pillar or
  the core).
- **One capability class** — capabilities and competencies are unified under `cap`.
- Keep additions AI-first-relevant; assess against the north star (§1).

---

## 4. Deliberately OUT of scope (and why)

Removed because they're delivery plumbing / bookkeeping, not AI-first strategy:
- **Ownership:** Infosys, Telstra (corporate structure, not a strategy lever).
- **Cloud IP/platforms:** Stax, Versent Landing Zone, Versent Managed Services (VMS).
- **Cloud accelerators/methods:** Yellow Brick Road (YBR), Enterprise Native Cloud (ENC).
- **AWS Digital Sovereignty Competency** (delivery credential).
- **Product practice & Product Management capability** — distinct/separate; won't
  drive the SCA initiatives or AI-first products for now.
- **Delivery-mode nodes** (Advisory / Build / Run) and the `mode` class — they did
  little on the graph; the advisory/build/run framing lives in capability and
  offering descriptions instead.
- **`cross` class** — Culture is now a `pillar`; its cross-cutting nature is carried
  by `intersects` edges, not a separate node type.

(Verified facts about these live in the research note if needed again — see §6.)

---

## 5. App features
Welcome modal on load (promotes the guided tour) · single Rings view · node detail
drawer with persistent notes (localStorage) · hover tooltips (nodes + edges) ·
edge-label toggle · always-on filter dock (edge-type + node-type, with
Live/All/Emerging status + Reset) · header search (`/` or ⌘K) · 10-step guided
Story tour · About panel (legend + glossary) · header **Contribute** link →
`contribute.html`.

### Companion: contribution & feedback (Phase 0)
`contribute.html` is a separate capture page (keeps the strategy graph pure). It
offers context-aware questionnaires launched per-node, free-form feedback, and
"propose a change" — accumulating in localStorage and **exporting to a markdown
file**. The curator drops those files in `contributions/` and asks Claude Code to
reconcile them into the graph (flagging conflicts, marking contested items
`proposed`). No hosting, no login. Full model + roadmap:
**`docs/contribution-model.md`**; reconcile process: `contributions/README.md`.
The page embeds a `DIR` mirror of node id/label/cls — kept in parity by the
validate hook (warns on drift); update it when `NODES` change.

---

## 6. Open questions / to confirm
- Current AWS Partner tier and full competency list (the "Premier" claim was refuted).
- Depth of the Microsoft/Azure practice (evidence is AWS-centric).
- Whether any client/case-study representation is wanted (ClientX was scrapped).

---

## 7. Change log
- 2026-06-15 — Refocused on the AI-first north star: pruned plumbing + ownership +
  Product; removed all grouping/umbrella nodes; unified competency→capability;
  rationalised taxonomy to 7 verbs (dropped `governs`); reduced to the single Rings
  view. Wired Application Engineering & Solution Architecture to agentic
  engineering, Claude Code/Desktop, the skills library and ontologies.
- 2026-06-15 (later) — Refined the palette (distinct node hues, muted edge set).
  Deleted Advisory/Build/Run nodes + `mode` class. Culture → `pillar`, deleted
  `cross` class. Added an `initiative` class: **AWS SCA** is the initiative (holds
  the BluShift/App Xray/sub-initiative edges), **AWS** stays a `partner`, linked by
  `AWS enables AWS SCA`. Added a welcome modal that promotes a richer 10-step tour.
- 2026-06-16 — Added the **Phase-0 contribution MVP**: companion `contribute.html`
  (context-aware questionnaires + feedback + propose-change → markdown export),
  `contributions/` drop zone + reconcile process, and an optional node-level
  `proposed` flag (dotted-magenta render) for contested/unratified items. Validator
  now also checks contribute.html ↔ NODES parity. Corrected node/edge counts to
  63/131. New reference: `docs/contribution-model.md`.
