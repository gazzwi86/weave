# TASK-031 — Instance browser v2 (CE-V1-EPIC-023)

Branch: `feature/CE-V1-EPIC-023` (worktree `/Users/gareth/Sites/weave-CE-V1-EPIC-023`), base `main`.

## Delivered

New route `/ce/instances`: browse/search/filter table (AC-1/AC-2), click-through
inspector panel with Properties/Edges/History (AC-3), "View on canvas" deep link
to `/explorer?focus=<iri>` (AC-4), Edit action opening the existing authoring
drawer with kind persisted (AC-5), create/edit form with structural on-blur
checks + 422→field-message mapping (AC-6), friendly label + mono short-id
confirmation, never a raw IRI (AC-7), glass chat aside with quick-start chips
and clear-history, can't-parse replies never repeat verbatim in one session
(AC-8, fixes F-D12), provider-unavailable (502) chat failures never disable
the browse table or authoring form (AC-9), DataTable render budget test at
500 rows < 500ms client-side (AC-10).

Nav item "Instances / Data" repointed from `/ce` to `/ce/instances` (old `/ce`
route and its Playwright suites untouched — they don't reference the nav item).

## Key decisions

- **PROV-O history is unreachable via CE-READ-1** (separate named graph
  `{iri}:prov`, `/api/sparql` can't cross it). Descoped per
  `.claude/state/escalations/TASK-031-blocker.md`: inspector always renders an
  honest "History unavailable — not exposed by the current read path" message
  instead of silently omitting the section.
- **Ref-mutation-from-outside-hook pattern**: `react-hooks/immutability` blocks
  mutating a ref returned by a custom hook from outside that hook. Fixed by
  giving `useChatRefs()` its own setter functions (`resetCantParseReply`,
  `setLastApplied`) that own all mutation internally — reusable pattern for
  future ref-bundling hooks.
- **`shortId()` fallback for `urn:`-style IRIs**: `iri.split("/").pop()` alone
  doesn't shorten `urn:activity:abc` (no `/`). Added `.split(":").pop()`
  fallback so AC-7 ("never a raw IRI") holds for both IRI forms.

## Bug found + fixed via E2E (not caught by unit tests)

`components/organisms/InspectorPanel.tsx`'s `InspectorPanelBody` early-returned
"No properties." and skipped Edges + History entirely whenever an entity had
zero properties AND zero edges — hiding the "History unavailable" state AC-3
requires. All existing unit-test mocks happened to include >=1 property,
masking this; the new E2E spec's realistic empty-triples mock resource (a
"brand new" entity) exposed it. Fix: gate only the "No properties." message on
`fields.length === 0`; Edges and History sections always render.

## Gates run (this session), all green

- Backend poison-endpoint pytest (`-m "not docker and not e2e"`): all pass.
- `uv run ruff check .` / `uv run mypy src/ tests/`: clean (via pre-commit hook).
- Frontend: `npx vitest run` 1264 passed; `npx eslint .` 0 errors (302
  pre-existing warnings, none new); `npx tsc --noEmit -p .` clean.
- New Playwright E2E `tests/e2e/ce-instance-browser.spec.ts`
  (`test_analyst_browses_filters_inspects_and_edits_an_instance`): passes.
- `ui_verify.sh --full --target http://localhost:3000/ce/instances`: see run
  output at commit time (structural+a11y, Playwright click-through, visual
  diff, Lighthouse).
- OKF conformance (pre-push hook): conformant, 171 pre-existing tolerated
  warnings, none new. Semgrep: pass.

## Commits (this session)

- `fix: always render InspectorPanel Edges/History sections (AC-3)` — bundles
  the `InspectorPanelBody` fix + the new E2E spec that caught it.
- (earlier-session commits for AC-1 through AC-10 scaffolding/features already
  on the branch before this session started — see `git log
  feature/CE-V1-EPIC-023`.)

## Not done / out of scope

- Explorer's `/explorer` route consuming the `?focus=` query param — cross-
  engine, out of this task's scope (AC-4 only requires the link to exist and
  carry the right IRI).
- PROV-O history data — architecturally blocked, see escalation file.
