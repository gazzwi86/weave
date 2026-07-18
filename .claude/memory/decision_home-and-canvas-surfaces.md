---
name: Canonical Home = Dashboard; ge-canvas = project-scoped Explore
description: T4 coverage-reconciliation product decisions — /dashboard is the canonical post-login Home (role-home folds in); /build/ge-canvas-preview becomes a project-filtered Explore
type: decision
created: 2026-07-18
---

Two surface decisions from the T4 integration-gate coverage-reconciliation (user, 2026-07-18):

1. **`/dashboard` is the canonical Home and the post-login landing page.** `/role-home` is
   demoted. Role-home's unique surface — the next-action banner, role-scoped capability cards,
   and completeness map (plus its guided-tour anchor) — must be **migrated into dashboard first**,
   then role-home delisted. Do not delist before migrating: dashboard already has ChecklistWidget +
   GetGoing (the onboarding-checklist half) but NOT the next-action/capabilities/completeness half.

2. **`/build/ge-canvas-preview` is a kept, intended surface, not a dev artifact.** Rebuild it as a
   project-scoped **filtered Explore** — functional like `/explorer` but showing only the entities,
   processes, and data created/affected/relevant to one project — linked from the build-project nav.
   Optionally model a project-level ontology linked to the parent graph. The point is that users
   build out and augment processes as they build an app / feature / data pipeline.

**Why:** the signed-off refit mock has a single Home screen and no separate dashboard/events/canvas
screens; these calls resolve app routes that exist but weren't in the mock, reversing the default
(role-home looked canonical because it matches the mock's Home; the user chose dashboard instead).
**How to apply:** treat both as feature-sized work, tracked as T5/T6 in
`docs/design/remediation-2-api-gaps.md` — off the T4 remediation critical path, each its own PR.
Related: [[decision_tenancy-workspace-alignment]] (project scoping), G19 canvas-click bug.
