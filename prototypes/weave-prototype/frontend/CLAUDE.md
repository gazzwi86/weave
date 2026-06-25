# frontend/CLAUDE.md

React 18 + TypeScript + Vite SPA for Weave. Dual-canvas ontology visualisation with forms and LLM editing.

## Key commands (run from `frontend/`)

```bash
npm run dev          # dev server — http://localhost:5173
npm run build        # tsc -b && vite build (production bundle)
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (unit tests, no watch)
npm run test:watch   # vitest (watch mode)
npm run test:e2e     # playwright test (needs browsers installed: npx playwright install)
npm run lint:lighthouse  # Lighthouse CI
```

The session-start hook (`../.claude/hooks/session-start.sh`) runs `npm install` automatically if `node_modules` is absent.

## Directory layout

```
src/
  main.tsx           — React root; QueryClientProvider wrapper
  App.tsx            — tab router (Explore/Model/Objects/Glossary/Inventory/Rules); ProjectSwitcher
  types.ts           — shared TypeScript types (Node, Edge, Project, LlmOperation, …)
  App.css            — design tokens + global layout
  styles/            — additional CSS modules
  lib/
    api.ts           — typed fetch client (all backend calls go through here)
    cytoscape.ts     — Cytoscape stylesheet + reconcile helper
    graph.ts         — graph projection utilities
    colors.ts        — colour-by-kind palette
    export.ts        — toCsv, toMarkdownTable (pure); exportCsv, exportMarkdown (side-effects)
    objects.ts       — objects-table helpers
    rules.ts         — rules-view formatting helpers
    reactflow.ts     — React Flow node/edge mapper
    *.test.ts        — vitest unit tests co-located with each helper
  hooks/
    queries.ts       — all TanStack Query hooks (useGraph, useGlossary, useRules, useLlmPropose, …)
  components/
    CytoscapeGraph.tsx   — Cytoscape.js canvas wrapper (instance preserved, reconciled in place)
    Legend.tsx           — colour legend; doubles as per-kind visibility filter (ADR-018)
    Inspector.tsx        — selected node/edge detail + edit/delete
    AddNodeForm.tsx      — add-node form using <FormField>
    AddEdgeForm.tsx      — add-edge form using <FormField>
    DataTable.tsx        — shared sortable/filterable table (Glossary/Inventory/Objects)
    FormField.tsx        — shared form input primitive (label + input/select)
    LlmBar.tsx           — NL prompt → propose → review diff → approve
    CanvasToolbar.tsx    — export buttons, layout controls
    ImportSchemaForm.tsx — CSV/JSON-schema upload form
    ProjectSwitcher.tsx  — project select/create/rename/delete
    *.test.tsx           — component tests (Testing Library + jsdom)
  views/
    ExploreView.tsx      — Cytoscape canvas + Inspector + forms + LlmBar
    ModelView.tsx        — React Flow canvas
    ObjectsView.tsx      — Objects table view
    GlossaryView.tsx     — Glossary table + export
    InventoryView.tsx    — Service inventory table + export
    RulesView.tsx        — SHACL-derived rules grouped by category
```

## Adding a new tab/view

1. Create `src/views/MyView.tsx` — props: `{ projectId: string }`.
2. Add a query hook in `src/hooks/queries.ts` if new data is needed (follow the `useGraph` pattern: `queryKey` + `queryFn` calling `api.*`).
3. Add the API call to `src/lib/api.ts`.
4. In `App.tsx`:
   - Add the name to the `TABS` const tuple.
   - `lazy()`-import the new view (keeps the bundle split).
   - Add a `case` in `ActiveView`'s switch.
5. Ship a unit test in `src/views/MyView.test.tsx` (or co-located in the view file).

See `/new-view` slash command for a step-by-step scaffold prompt.

## Component conventions

- Views receive `projectId: string` as a prop; they call hooks, not `api.*` directly.
- Shared primitives live in `components/`: `<DataTable>`, `<FormField>`. Prefer these over new one-offs.
- Heavy libraries (Cytoscape, React Flow) are lazy-loaded via `React.lazy`. Do not eagerly import them from views.
- Mutations call `useInvalidateProject()` on success to refresh all project-scoped queries.
- `queryKeys` in `queries.ts` is the single registry for cache keys — always use it, never inline strings.

## Test patterns

- Unit tests use vitest + Testing Library + jsdom (configured in `vite.config.ts`).
- Pure helpers (`lib/*.ts`): test the function directly; no browser stubs needed.
- Components: render with `<QueryClientProvider>` wrapping; mock `api.*` calls.
- e2e: Playwright (`test:e2e`); browser download may be blocked in some CI sandboxes — check first.

## Complexity notes

- No direct RDF/SPARQL in frontend code. All semantics go through `api.*` → backend.
- `types.ts` uses the backend's node/edge/kind vocabulary — not RDF types.
