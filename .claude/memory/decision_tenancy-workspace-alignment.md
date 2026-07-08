---
name: decision_tenancy-workspace-alignment
description: Workspace ≡ company/tenant (spec wins over implementation's intra-tenant sub-workspaces); operator-console provisioning; spec roles + project grants; publish notifications
metadata:
  type: decision
---

# Tenancy realignment (2026-07-08, user-confirmed via MCQ)

**Context:** The platform spec (weave-platform.md §Access model, FR-020/FR-045/FR-047) defines
**workspace ≡ the company/tenant** — one live graph per company, hard isolation, the header
switcher moves between companies (super-admin) — while the implementation built *multiple
sub-workspaces inside one tenant* (`urn:weave:tenant:{tid}:ws:{wid}`). User confirmed the spec
wins.

**Decisions (all user-selected):**
1. **Workspace = company.** "bunnings" is a separate *tenant*, not a workspace inside acme-corp.
   Intra-tenant multi-workspace is a divergence to migrate away from: fold existing sub-workspaces
   into the company graph. Switcher lists companies; regular users see only their own.
2. **Provisioning moves to a platform-operator console** (FR-045): separate Weave-operator
   identity outside tenant RBAC (dedicated Cognito group) creates companies + first admin.
   Settings→Workspaces for tenant admins becomes members-&-roles only. (Current tenant-admin
   create form is an interim dev convenience.)
3. **RBAC: spec's 10-role matrix + project-scoped grants.** Non-senior users work through
   project-level grants (read the relevant ontology slice, author project-level BPMO); company/
   domain ontology editing stays with admin/architect-tier roles.
4. **Version publish notifies all active workspace members** except the publisher
   (event_type `ontology.version.published`, in-app bell; email/SES later). Implemented
   2026-07-08 in `routers/ontology.py::_notify_members_of_publish`.

**Why:** spec-first harness; the user's mental model matched the spec, and the sub-workspace
implementation confused the switcher, audit scoping, and provisioning stories.

**How to apply:** treat workspace-vs-tenant refactor as a milestone-level remediation (needs
task briefs: data migration, IRI scheme, switcher rework, operator console). Do not build new
features on the intra-tenant multi-workspace model. Related: [[decision_ontology-bpmo]].
