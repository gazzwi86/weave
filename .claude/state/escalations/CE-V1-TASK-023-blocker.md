# CE-V1-TASK-023 — escalation note (STOP condition hit — scope larger than briefed)

## Gap 0 — launch premise wrong: AC-3/AC-6/AC-7 are not actually live (found during investigation, blocks "just build AC-9+E2E")

The launch brief said AC-1..AC-8 were "solidly built (174 passing tests)" and only AC-9 (inspector)
+ E2E were missing. Investigation shows this is false:

- `useQuickAdd` (AC-3) + its `QuickAddOverlay` component are fully coded and unit-tested in
  isolation, but `QuickAddOverlay` is never imported anywhere — not in `explorer-interactions.tsx`,
  `explorer-canvas.tsx`, or `app/explorer/page.tsx`. Double-click-to-add-node does not work in the
  running app.
- `useDrawEdge` (AC-6) is fully coded and unit-tested in isolation, but there is **no picker UI
  component at all** (no edge-relationship-type picker exists, unlike quick-add's
  `quick-add-popover.tsx`), and the hook is never wired into the tree either. Draw-edge does not
  work in the running app.
- `canEditCanvas` (AC-7's role gate) is fully coded and unit-tested in isolation, but **no caller
  anywhere passes it a real role** — `app/explorer/page.tsx` is not `async`, never calls `auth()` /
  `getSessionClaims()`, and no `role`/`canEdit` prop exists on `ExplorerCanvasLoader` →
  `ExplorerCanvas` → `ExplorerInteractions`. The edit gate is unreachable dead code today.

So AC-3, AC-6, AC-7 each pass their own unit tests but are not integrated — the write-path features
they gate literally cannot be exercised by clicking around the real app, let alone by a Playwright
E2E test driving the real UI (this task's own Law-B requirement).

## Gap 1 — role vocabulary mismatch (blocks Gap 0's AC-7 fix, and blocks any E2E of edit permission)

`can-edit-canvas.ts`'s `EDITOR_ROLES = new Set(["BA", "ontologist"])` is the only place in the whole
repo (outside its own tests) where the strings `"BA"` or `"ontologist"` appear as *edit*-role
values:

```
packages/backend/src/weave_backend/mock_oidc/tokens.py:_claims()   — sets sub, tenant_id,
                                                                       principal_iri. NO role claim.
packages/frontend/lib/auth/session-claims.ts:getSessionClaims()    — falls back to
                                                                       sub === "admin" ? "admin" : "author"
packages/frontend/app/api/proxy/ontology/resource/[iri]/route.ts   — uses role === "ontologist" for
                                                                       a DIFFERENT purpose (raw-IRI
                                                                       reveal gate, not edit gate)
```

Confirmed via repo-wide grep (excluding tests): nothing outside `can-edit-canvas.ts` ever produces
or checks for role value `"BA"`. Mock-OIDC issues no role claim at all; the only two role strings a
logged-in session can ever carry today are `"admin"` and `"author"`. Given the current wiring,
`canEditCanvas({role: "admin"|"author", ...})` always returns `false` — **the edit surface can never
be reached via real login, in prod or in a Playwright test that logs in through the UI**, until
either (a) mock-OIDC + session-claims grow a `BA`/`ontologist` role path, or (b) `EDITOR_ROLES` is
redefined against the roles the app actually issues. Neither is specified by this task's brief.

## Gap 2 — PROV tab has no data source (originally reported)

AC-9 / D-1 require the glass inspector to show a **PROV tab** (provenance: who/when/which
activity produced or last touched this node). No PROV-O read endpoint exists anywhere in the
codebase or `docs/specs/weave/contracts.md`:

- `GET /api/proxy/ontology/resource/{iri}` (`ontology_resource_route`,
  `packages/backend/src/weave_backend/routers/ontology.py:366`) returns `triples` / `outgoing`
  / `incoming` only — no `activity_iri`, `actor`, or timestamp.
- `contracts.md` defines `CE-WRITE-1`'s response (`activity_iri` on write) but no
  per-resource PROV *read* contract. Grepped for `prov:`, `activity_iri`, `CE-READ` — nothing
  resembling "fetch the PROV history for IRI X".

Building this properly means: designing a SPARQL query over PROV-O activities scoped to a
resource, a new backend endpoint, a new response schema, and a new contract ID — none of which
is specified in this task's brief (whose own pseudocode/API-contracts section is entirely
write-proxy + Edit Controller, no PROV read). That is backend/contract-design work outside a
"server route + optimistic edit lifecycle" task (Cost Estimate: L, not XL).

## Decision taken (documented assumption, not silent)

Ship AC-9's Properties and Edges tabs fully wired (both already have live data via
`fetch-node-props`/`useNodeSpotlight`). The PROV tab renders an honest **"Provenance history
isn't available yet"** empty state instead of fabricated or stubbed data — no fake activity
list. `test_node_select_opens_glass_inspector` and `test_inspector_edit_entry_opens_edit_controller`
(this task's own AC-9 test mapping) don't require live PROV data to pass; a follow-up task
(new, not yet numbered) should add the PROV read contract + endpoint + tab data.

## Recommendation

File a new task (e.g. `CE-V1-TASK-030`+) scoped to: PROV-O SPARQL query + `CE-READ-1`-family
endpoint + contract entry + inspector PROV tab data wiring. Flagging here rather than silently
shipping a fake/empty PROV tab with no trace, and rather than blocking all of AC-9 (Properties/
Edges/Edit entry are fully buildable today) on a gap in one sub-tab.

## STOP condition (task brief step 9): scope is larger than briefed

Per this task's own instruction — "if AC-9 turns out much larger than expected (e.g. needs
cross-task components not present), STOP and report rather than half-build" — three real gaps
(Gap 0 integration, Gap 1 role vocabulary, Gap 2 PROV data) were found, not the one gap (PROV) the
launch brief anticipated. Stopping here rather than proceeding; see AskUserQuestion raised in the
same turn for the scope decision needed before any further code is written.
