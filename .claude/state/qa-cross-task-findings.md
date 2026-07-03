# QA cross-task findings

Findings discovered during one task's QA pass that affect work in other (not-yet-QA'd or
already-delivered) tasks. Subsequent QA passes for any task listed in `affects` MUST read
this file before validating.

| Raised in | Finding | Severity | Affects | Note |
|---|---|---|---|---|
| PLAT-TASK-002 | No `lighthouserc.json` (or equivalent CI config) pins the canonical Lighthouse methodology (mobile-simulated-throttling vs. desktop preset, `numberOfRuns`). Measured on `/`: default preset scores performance 98/a11y 100/best-practices 100/SEO 100 (LCP 2.5s trips simulated 4G); `--preset=desktop` scores 100/100/100/100 on the identical build. "100 across all four categories" (Law #2 / Category 15) is ambiguous without a pinned preset. | Warn | [PLAT-TASK-003, PLAT-TASK-004] | Owner: Architect — commit a `lighthouserc.json` (or note in `testing-strategy.md`) choosing the preset/throttling method before the next Lighthouse-gated QA pass, so pass/fail isn't preset-dependent. |
| PLAT-TASK-002 | Design token taxonomy is incomplete: `typography.md` defines 9 type-scale tokens (`--text-display`, `--text-h1`..`--text-h4`, `--text-body-lg`, `--text-body-sm`, `--text-overline`, `--text-mono`/`-sm`); `app/globals.css` only implements 3 (`--text-body`, `--text-label`, `--text-caption`). Any task adding a heading/page title has no token to reach for and will fall back to raw Tailwind classes (already happened in `app/page.tsx`'s `<h1>`, not caught by AC-6 since that AC only scoped Button/Input/Badge/Card). | Warn | [PLAT-TASK-003, PLAT-TASK-004] | Owner: Engineer — extend `globals.css` with the missing type-scale tokens (and fix `app/page.tsx`) in the next frontend task that touches typography, before more pages compound the gap. |

