---
type: Coding Standard
title: Generative UI — Coding Standard
description: "Declarative generative-UI component catalogue + RSC streaming pattern for the Platform Generative Dashboard and Build-generated UI, including intent→component mapping and CE-BRAND-1 design-token consumption."
tags: [standards, generative-ui, frontend, dashboard]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/generative-ui.md
---

# Generative UI Standards

Weave renders UI that an AI composes from a **finite, pre-audited component catalogue** — never
free-form code. This governs two surfaces:

1. **Platform Generative Dashboard** (Platform PRD Epic 1) — a natural-language prompt resolves
   to one component from the catalogue, bound to an engine metrics contract, streamed into the
   dashboard grid.
2. **Build-generated UI** — screens the Build Engine emits compose the same catalogue; they
   inherit the same catalogue, mapping rules, and token consumption.

The architectural decision (Platform PRD §Architecture & decisions): *"Declarative generative
UI (finite component library, RSC streaming) — preserves design consistency; AI maps intent to
a fixed component set, never free-form code."* This standard makes that decision testable.

This standard gates generated code. The catalogue is the **only** vocabulary the AI may emit;
a generated dashboard or Build screen referencing a component outside the catalogue is a hard
failure, the same class as a SAST or package-existence violation.

## The finite component catalogue

The catalogue is a closed set. Adding a component is a deliberate, reviewed change to *this*
standard plus the catalogue module — never an ad-hoc emission by the model. The MVP set is
exactly the one named in the Platform PRD (§Concept + Epic 1):

| Component | Intent it serves | Data shape | Notes |
|---|---|---|---|
| `KpiCard` | single count / status | scalar (+ optional delta) | "count/status → KPI" |
| `LineChart` / `AreaChart` | trend over time | time-series | "trend → line/area" |
| `BarChart` | comparison across categories | categorical series | "comparison → bar" |
| `RankedList` | top-N / ranked entities | ordered list | "ranked → list" |
| `DataTable` | tabular / "as a table" | rows + typed columns | generic `Column<T>` table — the prototype `DataTable` (`prototypes/weave-prototype/frontend/src/components/DataTable.tsx`) is the baseline |
| `ActivityFeed` | event log / recent activity | time-ordered events | "log → activity feed" |
| `PieChart` / `DonutChart` | part-to-whole ratio | proportions | "ratio → pie/donut" |
| `Heatmap` | two-dimensional matrix | matrix | "two-dim matrix → heatmap" |
| `AlertBanner` | alert / threshold breach | severity + message | "alert → banner" |

Every catalogue component:

- Has a stable string `type` id (the AI emits this id, never JSX/markup).
- Has a typed, schema-validated props contract (a Pydantic/Zod schema). A widget definition that
  fails its component schema is rejected — the AI cannot emit arbitrary props.
- Is pre-audited for accessibility (`accessibility.md`): correct catalogue composition yields a
  zero-axe-violation surface by construction. A catalogue component that ships an axe violation
  is a catalogue bug, fixed once upstream of all generated UI.
- Consumes design tokens (below) for all colour/type/spacing — no hard-coded hex/px.

## Intent → component mapping

Intent resolution is a **declarative rule**, not a generative choice of markup (Platform PRD
E1-S2). The AI's job is to (a) classify intent to exactly one `type` and (b) pick an available
data category from an engine metrics contract — not to write a component.

| Detected intent / data shape | Resolved component |
|---|---|
| count / status | `KpiCard` |
| trend over time | `LineChart` / `AreaChart` |
| comparison across categories | `BarChart` |
| ranked / top-N | `RankedList` |
| event log | `ActivityFeed` |
| ratio / part-to-whole | `PieChart` / `DonutChart` |
| two-dimensional matrix | `Heatmap` |
| alert / threshold | `AlertBanner` |
| explicit "…as a table" | `DataTable` (named-type override) |

Rules (each is a test case):

- **Exactly one** component type per resolved intent (E1-S2 AC). No multi-component freeform.
- **Named type overrides the rule:** a prompt naming a type ("…as a table") forces that type
  (E1-S2 AC).
- **Unsatisfiable → decline, never force-fit:** a data shape with no matching component renders
  the defined unsatisfiable-prompt state, *not* an ill-fitting chart (E1-S2 failure AC).
- **No data source → defined unavailable state:** if the owning engine's metrics contract
  errors / is not yet GA, render the "data source unavailable" state (named reason + retry),
  never a blank or hallucinated widget (E1-S1 failure AC, Finding 15).
- Each rendered widget shows a **footer label naming its data-source contract(s)** (E1-S1 AC),
  carried on the span as `weave.data_source_contract` (see `observability.md`).

## RSC streaming convention

Widgets stream server-side and render progressively. The exact transport (Vercel AI SDK
`streamUI` vs Next.js server actions vs a custom streaming endpoint) is an open architect
decision (Platform OQ-02) — these conventions hold whichever is chosen:

- **Streaming header + skeleton first.** A streaming header and skeleton appear within the
  configurable target (default 1 s, tunable per workspace — Platform E1-S1 / FR-003). This is
  the time-to-first-token SLO span in `observability.md`.
- **Server resolves intent and data; the stream carries a typed widget definition** (resolved
  type, params, data-source bindings, title, column span) — never executable client code. The
  client maps `definition.type` → catalogue component.
- **Defined terminal states, never blank:**
  - LLM provider down → the prompt bar shows a defined offline state surfacing HTTP 503 as a
    readable message and the prompt stays retryable — matching the prototype `LlmBar` 503
    behaviour (`prototypes/weave-prototype/frontend/src/components/LlmBar.tsx:49`, the
    `ApiError` `status === 503` → offline message path). (E1-S1 failure AC.)
  - Source metrics endpoint error/timeout / engine not GA → "data source unavailable" tile with
    retry. (E1-S1 failure AC.)
  - Budget cap reached mid-stream → generation halts with the cap message and the partial
    widget is **rolled back (no partial save)** (E1-S1 failure AC); span carries
    `weave.budget_capped = true`.
- **Refine = delta, not restart.** A refine prompt applies as a delta on the current widget
  definition and re-renders; on an inapplicable refine the prior state is preserved with an
  inline error — no silent reset (E1-S3 ACs).
- **Streaming regions are `aria-live="polite"` with `aria-busy`** during the stream
  (`accessibility.md`), so header / unavailable / stale states are announced.
- **Persisted state is the resolved definition, not markup or history.** Pin/publish store the
  resolved intent + params + bindings server-side, scoped to `(tenant, user)` /
  `(tenant, workspace)` — never localStorage-only (E1-S4 / E1-S5 ACs). The streaming layer
  never persists raw HTML.

## Consuming CE-BRAND-1 design tokens

All catalogue components — dashboard and Build-generated — derive colour, type scale, spacing,
and radii from **Constitution-Engine brand tokens via `CE-BRAND-1`**, never hard-coded values.

- **Source of truth:** `GET /api/brand/tokens` returns **flattened design-token JSON** (colour,
  type scale, spacing, radii…) projected from the RDF brand individuals, "so Build can consume
  tokens **without parsing RDF**" (`_inter-engine-contracts.md` CE-BRAND-1; CE PRD FR-016). A
  brand individual failing its SHACL shape never appears in tokens (CE FR-016 AC).
- **Application:** tokens map to CSS custom properties — the prototype token layer
  (`prototypes/weave-prototype/frontend/src/styles/tokens.css`: `--kind-*`, `--accent`,
  `--radius`, `--font`…) is the shape the projection feeds. Components reference
  `var(--token)`; no literal hex or px in catalogue components.
- **Versioning:** the dashboard / Build read tokens at a project-pinned version (CE PRD: "Build
  reads brand tokens via `CE-BRAND-1` and the graph at a pinned version via `CE-READ-1`"). A
  token change carries a PROV-O stamp and is versioned (CE PRD §FR-016 narrative).
- **Build-generated UI conformance:** generated screens are checked for conformance against
  `CE-BRAND-1` — design tokens *and* machine-evaluable VoiceRules — at the generation gate, pass
  bar **default ≥ 90% adherence (tunable), no critical violations** (Build PRD FR-029 / FR-018
  `design_tokens` in the task brief). A generated screen that hard-codes colour/type instead of
  consuming tokens, or drops below the conformance bar, fails the gate atomically.

## Definition of done (generative-UI feature / generated screen)

- [ ] Every rendered widget is a catalogue `type`; no component outside the catalogue is
      emitted.
- [ ] Intent resolves to exactly one type by the declarative rule; named type overrides; no-fit
      prompt declines (does not force a chart).
- [ ] Streaming header/skeleton within the configurable default (1 s); defined offline /
      unavailable / budget-capped / stale states — never blank or hallucinated.
- [ ] Refine applies as a delta; inapplicable refine preserves prior state with an inline error.
- [ ] Persisted state is the resolved definition, server-side, tenant/RBAC-scoped (not
      localStorage).
- [ ] All colour/type/spacing/radii from `CE-BRAND-1` tokens via CSS variables; zero hard-coded
      hex/px in catalogue components.
- [ ] Generated screens pass the `CE-BRAND-1` conformance gate (default ≥ 90%, no critical
      violations) and the axe zero-violations gate (`accessibility.md`).
