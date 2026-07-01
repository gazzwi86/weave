# UI-verification gate (`ui_verify`)

The deterministic gate that makes "done" mean *"a human could open the branch and the screen
genuinely works and links up"* — not "tests pass". Driven by `.claude/scripts/ui_verify.sh`;
re-executed (and blocking) by the `phase-gate` skill and the pre-push git hook.

## What it checks

| Step | Check | Tier | Runs without a browser? |
|---|---|---|---|
| A | structure (`<main>`, single `<h1>`, `lang`) + **links-up** (every in-page nav anchor resolves) + axe a11y | **deterministic (blocks)** | ✅ yes — `structural-check.mjs` (jsdom + axe-core) |
| B | Playwright functional click-through + 8-state visual diff (`maxDiffPixelRatio 0.01`) | **deterministic (blocks)** | ❌ needs Chromium |
| C | Lighthouse = 100 across perf/a11y/best-practices/seo | **deterministic (blocks)** | ❌ needs Chrome + served URL |
| D | Claude vision check of screenshots vs `docs/standards/design/` | **advisory (never blocks)** | ❌ |
| E | human-signed run-book (`vouched-by:` filled) | **deterministic (blocks)** | ✅ yes |

Deterministic steps **fail closed**: a missing toolchain is a FAILURE, not a skip (that is the
soft-gate anti-pattern this gate exists to kill). The vision check is the single probabilistic
signal and is advisory only; the human-signed run-book is the mandatory human-judgment gate.

## Usage

```bash
# Real screen (full gate):
.claude/scripts/ui_verify.sh --target http://localhost:3000/explorer --runbook docs/.../EPIC-007-runbook.md

# Fixture self-test / pre-scaffold bootstrap (browser-free subset, loudly labelled PARTIAL):
.claude/scripts/ui_verify.sh --target e2e/ui-verify/fixtures/good.html --structural-only
```

## Validation status (honest)

- **Step A — DEMONSTRATED.** `structural-check.mjs` passes `fixtures/good.html` and catches
  `fixtures/broken.html` (8 defects incl. the dead `#inspector` nav link). Reproduce:
  `npm ci && node structural-check.mjs fixtures/broken.html` (exit 1).
- **Steps B & C — WIRED, full-browser validation PENDING.** Require `npx playwright install
  --with-deps chromium` and, for non-flaky baselines, Docker (`npm run baselines:docker`). Docker
  was not running in the authoring environment, so the pixel-diff baselines are intentionally NOT
  committed yet — generate them in the pinned image first (see `update-baselines.sh`).
- **Step D — advisory stub**, activated when `docs/standards/design/` exposes machine-extractable
  token rules.

## Fixtures
`fixtures/good.html` is a known-good screen; `fixtures/broken.html` deliberately fails structure,
links-up, and a11y. They are the gate's regression bench — extend them when you find a new class of
"looked fine, was broken" defect (the hardening loop).
