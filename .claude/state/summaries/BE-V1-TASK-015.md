# Progress: BE-V1-TASK-015 — Registry Grid + Project Settings UI + Contributors UI (FR-006/008/009/011, E2-S4)

`build-engine` EPIC-002. First UI task in the epic. Coordinator-authored from the engineer's
incremental commits (engineer capped 4× on this token-heavy UI task; coordinator committed the
Playwright E2E tail + fixed one tsc error in the E2E spec). Written before QA so preflight passes.

## Outcome

Impl complete + committed (all 5 surfaces). Vitest 17/17 pass, lint 0 errors (11 warnings), tsc
clean. QA full checklist pending (this summary unblocks preflight). **Full `ui_verify --full`
cross-screen check runs at epic close (Step 14) on the assembled app — this epic is now UI-bearing.**

## What shipped (frontend, `packages/frontend/app/build/`)

- **Registry grid** (`registry-grid.tsx`, `project-card.tsx`, `use-project-grid.ts`) — keyset
  pagination + filter/search hook, lifecycle chips (`56a002f`).
- **New-project modal + Registry page** (`937fe9f`, AC-6/AC-8).
- **Role-gating UX** (`deriveProjectRole`, `44ad0a2`, AC-4) — derives admin/editor/reader to
  show/hide/disable mutation controls.
- **Contributors tab UI** (`6f4d582`, AC-5) — list + add/remove, role badges.
- **Project settings panel** (`projects/[id]/settings/`: governance-form + binding-slots + panel
  orchestrator, split for complexity, `3322a7a`, AC-1/2/3).
- **Next.js proxy routes** `/api/build/projects` (grid+create), `/[id]`, `/[id]/settings`,
  `/[id]/contributors` — forward to the TASK-014 backend API.
- **Playwright E2E** (`tests/e2e/project-settings.spec.ts` + `build-request.spec.ts`, `8bff861`) —
  assert BACKEND STATE (settings PATCH persists; non-admin disabled controls). Written + type-check;
  **need the live stack (app+backend) to RUN — executed at epic-close ui_verify, not task-level.**

## Decisions / design

- Built against `docs/standards/design/` tokens per the brief's appended **Design Requirements**
  section (no ad-hoc hex/px). Money rendered as `float` (per TASK-014 wire type).
- Role-gating is UX-only (hide/disable) — the real enforcement is TASK-011's `require_project_role`
  guard server-side; the UI must not be the only gate.

## Known / GAPS (from the design-agent brief section)

- Design system has **no pagination component** and **lifecycle-chip colours unpinned** — engineer
  made token-based choices; flag for design-system follow-up.
- ADR-013-vs-settings-503 doc inconsistency (settings PATCH project-scope error path) — phase-gate.

## Gates (coordinator-run)

- Vitest `app/build`: **17/17 pass** (5 files). ESLint `app/build`: **0 errors**, 11 warnings
  (incl. one `react-hooks/exhaustive-deps` on `use-project-grid.ts` — QA to judge). `tsc --noEmit`:
  clean. Coverage + a11y + full design-QA: QA to run.

## Commits

- proxy routes `d7e78c8`/`ebce269`/`efeffdc`/`88d59c9`/`744261c` · `56a002f` grid · `937fe9f` modal ·
  `44ad0a2` role-gating · `6f4d582` contributors · `3322a7a` settings panel · `8bff861` E2E

## Dependencies unlocked

- **TASK-022** (External-Space Bindings), **TASK-023** (Source-Control Provider Config UI).
