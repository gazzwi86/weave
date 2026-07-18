# V7 — Audit/Build card panel styling

## Outcome

No code change. Both requested styling fixes were already satisfied by existing code;
see `.claude/state/escalations/TASK-V7-blocker.md` for the full investigation.

## What was checked

- `components/ui/card.tsx` (shared `Card` primitive, imported by every consumer under
  `app/audit/**` and `app/build/**`) already implements the mock's `.side-card` panel
  recipe with the exact same token values (`--color-surface`/`--surface`,
  `--color-border`/`--border`, `--radius-lg`, `--space-4`/`--sp-4`).
- Both `app/audit/page.tsx` (all stat cards) and `app/build/project-card.tsx` +
  `app/build/registry-grid.tsx` (project cards, empty state) already route through this
  recipe. No hand-rolled flat panel found on either screen.
- `app/audit/page.tsx`'s `ModelEditsByKindCard` never renders bars — always a
  "Not available yet" pending state, because no backend field carries a per-kind edit
  breakdown (gap G5, documented in-code). Nothing exists there to apply the gradient to.
- The only real bars on `/audit` (`components/molecules/BarChart.tsx`, "Events by
  category") are flat in the mock too (`.bar.prev`/`.bar.cur`, solid colour) — so those
  were correctly left alone.

## Decision

Escalated per Law 11 rather than inventing a mock-deviating change (e.g. bumping to
`--color-border-strong`, or fabricating bars with no backing data) to "look more
bordered." Filed PR #155 documenting the finding; branch `feature/v7-card-panel-styling`
carries one docs-only commit (the escalation note), no app-code diff.

## Follow-up for whoever picks this up

The perceptual "flat" read in the T4 visual matrix is most likely explained by T4's own
theme #2 (DATA/SEED — empty "Not available yet" cards). If/when the busiest-entities,
kind-edits, and Build budget-bar backend fields land, re-run the visual comparison before
assuming any further styling work is needed.
