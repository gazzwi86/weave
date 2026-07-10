---
name: projects-domain-id-gap
description: build-engine projects table has no domain_id — kills every domain/project-scoped cascade (roles, budget cap, rate card); one migration closes 3 ADRs
metadata:
  type: project
---

**The `projects` table has no `domain_id`/`workspace_id` column** (`migrations/0009_projects.sql`),
and `settings/scope.py` only parses `urn:weave:tenant:{tid}:...` scope IRIs — a Build project's real
IRI is `urn:weave:project:{tid}:{slug}`, which never matches. Net effect discovered across
BE-V1-EPIC-002 (2026-07-10): **every domain/project-scoped cascade silently collapses to
company-scope only.**

Three symptoms, ONE root cause:
- **ADR-012** (TASK-011) — per-project role guard's domain-admin overlay is dormant (`domain=None`).
- **XT-BE013-1 / ADR-013** (TASK-013) — budget-cap cascade reaches company only; and TASK-012's
  `resolve_rate_card` had NO fallback so it errored on every real dispatch (fixed to company fallback).
- Anything in TASK-014+ (PM Surface API) that resolves a project/domain-scoped setting will hit the
  same wall.

**Fix (one PR closes all three):** a `projects.domain_id` migration + extend `settings/scope.py` to
parse project/domain scope IRIs + thread a grammar-conforming IRI chain into the resolvers. Above
generation-tier authority — **phase-gate ratification / architect decision**, not an inline fix.

**How to apply:** when a new task needs a project/domain-scoped setting, expect only company scope to
resolve; document the limitation (don't fake a cascade), fail-safe (under-grant, never over-grant),
and reference this gap. Fail-open on no cap (ADR-009). See [[decision_ontology-bpmo]] context only if
relevant. Related: ADR-012, ADR-013, XT-BE013-1.
