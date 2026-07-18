---
name: Dumb/smart component split is enforced
description: Every UI component lives in Storybook (atomic design); app pages/containers are data-binding
  only — no bespoke CSS or presentational markup. Enforce and resolve violations on sight.
type: feedback
created: 2026-07-17
---

Every presentational UI component must live in the Storybook atomic library
(`packages/frontend/components/ui|molecules|organisms|templates`) with stories. Route pages and
`shell/` containers are **smart/data-binding only**: they fetch, hold state, and compose library
components — they own **no CSS classes and no presentational markup**. One source of truth per
surface (e.g. the live header must consume `organisms/AppHeader`, never re-implement it).

**Why:** Autonomous build produced parallel implementations (hand-composed `shell/app-shell.tsx`
header vs unused `organisms/AppHeader.tsx`), causing the built UI to drift badly from the approved
design. User ruled this a project principle (2026-07-17), hardening the 2026-07-09 Storybook
delivery ruling in `docs/design/visual-direction.md`.

**How to apply:** When touching any UI surface, check the page for inline presentational JSX/CSS —
refit it to consume the library component; if the component is missing, add it to the design system
first (with stories), then consume it. Flag violations in review/QA as majors.
