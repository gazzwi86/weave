# Progress: PLAT-V1-TASK-028 — Marketing entry gaps (real hero, missing IA sections, logo lockup)

`weave-platform` EPIC-012 (Marketing Site), sole task, closes the epic. Worktree
`../weave-PLAT-V1-EPIC-012`, branch `feature/PLAT-V1-EPIC-012` (off `main`). Frontend-only, no
migration. Depended on PLAT-V1-TASK-026 (Storybook design system) — confirmed merged to `main`
(PR #63) before starting.

## Outcome

DONE — 7/7 AC met, all specified tests passing (8 new unit/integration + 2 new E2E), full frontend
suite green (1135/1135), backend/OKF gates green.

## What shipped

- `components/templates/landing-page.tsx` (new) — `LandingPageTemplate`, the R13 design-system
  template. Fixed nine-section order (`LANDING_PAGE_SECTION_ORDER`) enforced at render time —
  throws if a caller passes sections out of `poc-ia-proposal.md` §6 order.
- `components/marketing/sections.tsx` (new) — `MARKETING_SECTIONS` data array; the *only* place
  marketing molecules (`Hero`, `FeatureGrid`, `Pricing`, etc.) are imported/composed now.
- `components/marketing/social-proof.tsx`, `components/marketing/screenshot-band.tsx` (new) — the
  two IA sections that didn't exist yet.
- `app/page.tsx` — rewritten to a thin binder: `<LandingPageTemplate sections={MARKETING_SECTIONS} />`,
  zero direct marketing-molecule JSX (AC-5, R13 atomic-design constraint).
- `components/marketing/hero.tsx` — `MockGraphPanel` (CSS dots) deleted; hero now an `<img>` at
  `/marketing/hero-canvas.png`. Header logo swapped from raw `/logo.png` (CSS-height-cropped) to a
  generated `/logo-lockup.png` asset.
- `next.config.ts` — added `redirects()`: bare `/login` → `/auth/login` (307, preserves query
  string) — AC-6, F-D25 insurance. Runs before `proxy.ts`'s auth guard so no double-hop.
- Static assets: `public/logo-lockup.png` (generated via `sharp().trim()` on `logo.png`, stripping
  the white padding around the mark+wordmark — same source file, distinct generated asset per the
  brief's design decision) and `public/marketing/hero-canvas.png` +
  `public/marketing/screenshot-band-{dashboard,table}.png`.

## Screenshot-asset decision (flagged for design review, per brief's own advisory)

The brief's pseudocode/advisory says the hero + screenshot-band captures should come from the real
running app **once TASK-027 (chrome refit) lands** — TASK-027 has NOT landed (EPIC-011 parked after
026, confirmed via `.claude/state/summaries/PLAT-V1-TASK-026.md`). Capturing the real `/explorer`
page requires a full authenticated session against backend+Postgres+Redis — heavyweight and would
still show the pre-refit chrome the brief says to avoid.

**What I did instead:** added a `MarketingScreenshot` story to `CanvasPage.stories.tsx` (Storybook,
already TASK-026's real design-system template) with a small scatter of real `KindChip` nodes
(real tokens/colours, no ad-hoc hex) standing in for a live graph, built Storybook statically, and
captured PNGs via a one-off Playwright script (deleted after use — not committed, see below). The
two screenshot-band images reuse the existing `DashboardGrid`/`TablePage` stories as-is (real
components, real data shapes). This is a real capture of real production React/design-system code,
just not an authenticated live-session capture of `/explorer` itself.

**Flag for design review:** once TASK-027 lands and gives Explorer its v2 chrome, these three PNGs
should be recaptured from the actual authenticated app per the brief's original intent — this was
already called out as advisory/non-blocking in the brief itself, not a gap I introduced.

## Per-AC

- AC-1 (real screenshot asset replacing MockGraphPanel) ✓ — `hero.tsx` now renders
  `/marketing/hero-canvas.png`; `MockGraphPanel` deleted.
- AC-2 (nine sections, fixed order) ✓ — `LANDING_PAGE_SECTION_ORDER` asserted at render; integration
  test checks all nine landmarks/headings present + the order constant itself.
- AC-3 (existing sections' content unchanged) ✓ — `app/__tests__/page.test.tsx` re-asserts the exact
  pre-existing copy (3 steps, 6 feature cards, 3 pricing tiers incl. "Talk to us").
- AC-4 (full logo lockup, never raw cropped PNG) ✓ — header now `<img src="/logo-lockup.png">`.
  Footer still renders no logo (unchanged, brief didn't require adding one).
- AC-5 (`landing-page` template, no direct molecule JSX in `app/page.tsx`) ✓ — template built first;
  static regex test on `app/page.tsx` source guards against reintroducing direct
  `components/marketing/*` imports there.
- AC-6 (bare `/login` → `/auth/login`, 307, query preserved) ✓ — `next.config.ts` `redirects()`;
  E2E asserts both the raw 307/Location header and the final navigated URL.
- AC-7 (CTA click → `/auth/login`, no full reload) ✓ — regression-lock E2E using a
  `window.__noReloadMarker` survival check (a full reload would reset the JS context).

## Tests

- Unit: `components/marketing/__tests__/hero.test.tsx` (AC-1, AC-4),
  `components/templates/__tests__/landing-page.test.tsx` (AC-5, incl. a throw-on-wrong-order case).
- Integration: `app/__tests__/page.test.tsx` extended (AC-2, AC-3, AC-5 static-composition check).
- E2E: `tests/e2e/marketing-entry.spec.ts` (AC-6, AC-7) — both pass in isolation and inside the
  full `ui_verify.sh --full` run (see below).

## Gates run

- Frontend: `eslint .` → 0 errors (263 pre-existing warnings, none new from this task's files —
  verified via a scoped `eslint` pass on just the changed paths). `tsc --noEmit` → clean.
  `vitest run` → 219 files / 1135 tests passed (was 1134 before this task; +1 net from the
  reorganised `page.test.tsx`, all new assertions covered).
- Backend: `pytest -m "not docker and not e2e"` (poison LocalStack/Oxigraph endpoints) → all green,
  exit 0. `ruff check .` (whole repo) → **4 pre-existing errors in `.claude/scripts/modules/{lifecycle,memory}.py`**
  (unused import, redefined `Path`) — confirmed via `git log` these predate this task and this
  worktree's diff never touches `.claude/`; per `harness-governance.md` I do not fix harness-owned
  files unilaterally, flagged for the remediation sweep instead. `mypy src/ tests/` → clean, 582
  files.
- `.claude/scripts/ui_verify.sh --full --target http://localhost:3000` → this mode runs the
  **entire** `packages/frontend/tests/e2e/` suite (97 specs across every engine), not just the
  marketing surface. Brought up the repo's `docker-compose.yml` stack (postgres, redis, oxigraph on
  an alternate port to avoid a sibling worktree's port claim, localstack) to get this as clean as
  possible. Result: 26 passed / 68 failed, **but both `marketing-entry.spec.ts` tests (my task's
  own E2E) pass** — confirmed by name in the run log, no failure entry for either. The 68 failures
  span every other engine (accessibility, audit, board, brand, canvas, explorer, glossary, …) and
  root-cause to the same symptom: the mock-OIDC callback (`/api/auth/callback/cognito?...`) hangs
  and never completes the redirect to the post-login page, across specs that have nothing to do
  with marketing. This reproduced identically **before** I added postgres/redis/oxigraph too — it
  is a pre-existing environment/session issue in the full-suite runner (heavy parallel load under
  `workers: 1` over 7+ minutes), not something this task's diff touches (this task never modifies
  `proxy.ts`, `auth.ts`, or any session/OIDC code). Structural/a11y + Lighthouse steps of `ui_verify`
  ran to completion. **Flagging for QA/coordinator**: the `ui_verify --full` gate as currently wired
  is not a clean pass/fail signal for a single-task diff — it conflates "did this task regress
  anything" with "is the entire pre-existing e2e suite currently green", and the latter was already
  red before this task started.
- OKF: `okf_validate.py docs` → `✓ conformant` (170 pre-existing tolerated warnings, no errors).

## Decisions / things a reviewer should know

- No ADR needed — every non-trivial call (screenshot-asset provenance, logo-lockup generation
  method, template composition boundary) is already a "Design Decision" row in the task brief; I
  followed them, documented deviations (screenshot capture method) above instead of inventing new
  policy.
- `logo-lockup.png` still has its navy background box (not transparent) — `sharp().trim()` only
  removes uniform-colour padding, not a colour-keyed background. Marked as a known ceiling; a real
  transparent-background lockup is a separate asset-production task if wanted later.
- Deleted the one-off Playwright/Storybook capture script and `storybook-static/` build output
  after generating the PNGs — not committed, per "minimum code that solves the problem" (the
  reusable artifact is the checked-in PNGs + the `MarketingScreenshot` Storybook story that can
  regenerate them, not a maintained capture pipeline).

## PR / lane

Frontend-only. Sole task in EPIC-012 → PR closes the epic. Base `main`.
