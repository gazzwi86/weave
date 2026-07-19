---
name: Legacy "admin" role is the super-admin sentinel — do not canonicalize
description: Demo seed admin/client roles MUST stay "admin"/"author"; provisioning gates on literal "admin"; SE2 fixed at frontend label (#181)
type: reference
created: 2026-07-19
---

The demo seed's super-admin uses `role="admin"` (client `"author"`) in
`packages/backend/src/weave_backend/db/seed_demo.py`. **These are permanent
legacy sentinels, NOT bugs — do not "canonicalize" them to `workspace_admin`/
`brand_content_owner`.**

`"admin"` is the platform super-admin string that operator/provisioning
surfaces gate on **literally**:

- frontend `app/settings/workspaces/page.tsx`: `if (role !== "admin")` blocks
  the whole provisioning panel.
- backend `require_tenant_admin` on `GET /tenants/{id}/workspaces`.

Renaming it to a canonical in-tenant slug locks the demo admin out of that
surface and breaks `workspaces-provisioning.spec.ts` (e2e-behavioural, a
required CI check). Also breaks `test_seed_demo.py`'s membership assertion.
Cost two CI cycles on PR #184 (2026-07-19).

The "member shows as Viewer" symptom (finding SE2) was fixed at its **true
source** in #181, at the frontend label layer, not the seed:
`app/settings/members/roles.ts::roleLabel` maps legacy `admin`/`author` via
`LEGACY_ROLE_LABELS`, which "coexist permanently" with the 10 canonical slugs
(`CANONICAL_ROLES`). So SE2 needed no seed change at all.

Related: [[decision_tenancy-workspace-alignment]].
