# V7 escalation — both DO items already satisfied at the token/CSS level; premise is stale

Task V7 asked for two styling changes on Audit (`/audit`) and Build (`/build`) cards:

1. Give Audit cards + Build project cards the mock's bordered-panel treatment (border + surface
   bg + radius + padding), using design tokens.
2. Change the "Model edits by kind" bar fill from flat solid cyan to the mock's blue→teal gradient.

Investigation before writing any code found neither change has an actionable target in the current
code.

## DO #1 — card panel borders

`components/ui/card.tsx` (the shared primitive every card-like surface in this codebase imports)
already renders exactly the mock's `.side-card` recipe, token-for-token:

- app `Card`: `bg-[var(--color-surface)] border-[var(--color-border)] rounded-[var(--radius-lg)]
  p-[var(--space-4)]`
- mock `.side-card`: `background:var(--surface); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:var(--sp-4)`
- Both token sets resolve to the **same hex values** (`--surface`/`--color-surface` = `#0e1420`,
  `--border`/`--color-border` = `#1f2937`).

Confirmed both `/audit` (`app/audit/page.tsx`, every stat card wrapped in `<Card>`) and `/build`
(`app/build/project-card.tsx`'s `ProjectCard`, `app/build/registry-grid.tsx`'s empty-state div —
same border/bg/radius/padding classes by hand) already route through this recipe. There is no
hand-rolled flat `<div>` panel anywhere in the Audit or Build card surfaces to fix.

I also rendered the shared `Card` story (Storybook, dark) and the mock's own `.side-card` directly
in a browser to sanity-check "does this look like a bordered panel or a flat block" — both render a
very subtle, low-contrast 1px edge (the token pairing itself is low-contrast: `#0e1420` panel on
`#0a0e14` page, `#1f2937` border). The perceptual "flat" read T4 recorded is consistent with T4's
own theme #2 in `docs/design/t4-visual-matrix.md` ("Empty 'Not available yet' cards (DATA/SEED)")
— Audit's stat cards are mostly pending-text placeholders, and Build's project cards are missing
the budget-bar/stat line (explicitly deferred by this same task brief). Content-empty panels read
flatter than populated ones even with an identical border; that's a data-population effect, not a
CSS defect.

## DO #2 — gradient bars

The mock's gradient (`--gradient-accent: linear-gradient(120deg,#22D3EE,#A78BFA)`) is only applied
to `.actor-row .bar-fill`, used by the mock's "Model edits by kind" and "Busiest entities" side
cards. In the app, `ModelEditsByKindCard` (`app/audit/page.tsx`) always renders a pending-state
message ("Not available yet — per-kind edit counts need a backend breakdown") — there is no backend
field for a per-kind edit breakdown (documented in-code as gap G5), so no bar ever renders there to
re-colour.

The only bars that actually render on `/audit` today are `BarChart`
(`components/molecules/BarChart.tsx`, used by "Events by category"), which are flat solid colour —
and the mock's own "Events by category" bars (`.bar-pair .bar.prev` / `.bar.cur`) are **also flat**
(`--border-strong` / `--accent`), not gradient. Making those bars gradient would make them diverge
from the mock, not match it.

## Options

(a) Close V7 as satisfied — no code change needed for either DO item; both are already
    token-faithful to the mock. File the "flat" perception under the existing DATA/SEED remediation
    track (T4 theme #2 / Build's already-deferred budget-bar line) rather than as a styling gap.

(b) Make a mock-deviating change anyway (e.g. bump the border to `--color-border-strong`, or
    fabricate a gradient on the non-existent kind-edit bars) to visually satisfy the "looks more
    like a panel" intent even though it stops matching the mock's literal token values.

(c) Leave V7 open and re-scope it once the DATA/SEED track (busiest-entities/kind-edits backend
    fields, Build budget-bar) lands, since populated cards may be what actually closes the
    perceptual gap — re-review styling only after that data exists.

## Recommendation

(a). The task brief's own instruction was "using tokens... grep the exact names from
`globals.css`/`docs/standards/design`" — I did, and the exact names are already wired up correctly.
Inventing a deviation from the mock (option b) would fail the task's own "matching the mock" success
criterion in order to satisfy a fidelity score that's actually a data-population gap, not a token
gap. No files changed; no commit; branch `feature/v7-card-panel-styling` left at its point of
divergence from `main` (empty diff) pending human confirmation.
