# Weave — Frontend

A colourful, interactive knowledge-graph editor for **Weave** ontologies, built
with React + TypeScript + Vite over the FastAPI backend.

## Stack

- **React 18** + **TypeScript 5** + **Vite 5**
- **@tanstack/react-query 5** — all server state
- **Cytoscape 3** + **fcose** — the primary Explore graph canvas
- **@xyflow/react 12** (React Flow) — the Model projection
- **Vitest** + Testing Library — unit tests; **Playwright** — e2e smoke
- Plain CSS with a `tokens.css` design-token sheet (no Tailwind)

## Getting started

```bash
npm install
cp .env.example .env          # set VITE_API_BASE_URL if not :8000
npm run dev                   # http://localhost:5173
```

The app talks to the backend at `VITE_API_BASE_URL` (default
`http://localhost:8000`). Start the backend (`uvicorn app.main:app --reload`
in `../backend`) so the demo project and graph load.

## Scripts

| Script                  | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Vite dev server (HMR) on :5173                |
| `npm run build`         | Type-check (`tsc -b`) + production build      |
| `npm run preview`       | Serve the built app on :5173                  |
| `npm run lint`          | ESLint (flat config)                          |
| `npm run typecheck`     | `tsc --noEmit`                                |
| `npm run test`          | Vitest unit tests (run mode)                  |
| `npm run test:watch`    | Vitest watch mode                             |
| `npm run test:e2e`      | Playwright smoke (needs backend + preview)    |
| `npm run lint:lighthouse` | Lighthouse CI against `dist/`               |

## Environment variables

| Variable             | Default                 | Purpose                       |
| -------------------- | ----------------------- | ----------------------------- |
| `VITE_API_BASE_URL`  | `http://localhost:8000` | Base URL of the Weave backend |

Vite bakes `VITE_*` vars at build time. The Docker image accepts it as a
`--build-arg`.

## Features

- **App shell** — top bar with project switcher (create empty / from-demo,
  delete non-demo projects) and view tabs.
- **Explore** — Cytoscape canvas, kind-coloured nodes, labelled edges, fcose
  layout, spotlight highlight, legend, add-node / add-relationship forms, an
  Inspector drawer (edit/delete), and a natural-language LLM bar.
- **Model** — the same graph projected through React Flow (draggable nodes).
- **Glossary** — SKOS concept table.
- **Inventory** — systems / services table with dependencies.

## Docker

```bash
docker build -t weave-frontend \
  --build-arg VITE_API_BASE_URL=http://localhost:8000 .
docker run -p 8080:80 weave-frontend     # http://localhost:8080
```

Multi-stage build (Node → Nginx) with SPA fallback in `nginx.conf`.

## Testing notes

- Unit tests mock `fetch`; no backend required: `npm run test`.
- The Playwright smoke spec assumes the backend is on :8000 with the demo
  project seeded and the preview server on :5173 (started via `webServer`).
  Browser binaries may need `npx playwright install` first.
