# BE-TASK-009 — Deploy + CE write-back (build-engine, EPIC-008)

**Status:** implementation complete + green; awaiting QA (ASSESS).
**Branch:** `feature/BE-EPIC-008`. **Commits:** `f68b608` (feat: impl), `0b3338b` (test: integration).
This is the LAST task of BE-EPIC-008 — epic-check flips COMPLETE on QA PASS → one epic PR off `main`.

## Scope (lean M1 — brief trimmed 2026-07-06)

Realigned DOWN to the tech-spec's M1 scope: S3 artefact bundle + CE-WRITE-1 write-back + HITL-on-422.
Dropped (deferred to M2): live Lambda/CloudFront preview, `demo_url`/expiry, feature-flag rollback.
Scope decision made by the user ("Trim brief to lean scope").

## What was built

- **Migration `0016_projects_write_back.sql`** — adds `demo_output_location_ref TEXT`,
  `write_back_complete BOOLEAN NOT NULL DEFAULT false`, `write_back_artefact_iri TEXT` to `projects`.
  No RLS change (inherits `0009` tenant policy); `projects` already GRANTs UPDATE.
- **`generation/store.py`** — new `GenerationRun` dataclass + `get_generation_run_by_commit_sha`
  (SELECT scoped by `tenant_id` + `commit_sha`, newest-first). Table already GRANTs SELECT.
- **`projects/model.py`** — `Project` extended with the 3 new fields (defaults so existing
  constructions keep working); `get_project` SELECT extended; `update_project_publish` /
  `update_project_write_back` added.
- **`deploy/artefact_publisher.py`** — wraps a single S3 put of the generated bundle via
  `storage/tenant_objects` (`s3_client`/`put_object`); returns the artefact location ref.
  Law F: mocked in unit tests, LocalStack in integration — never a real AWS account.
- **`deploy/ce_write_client.py`** — CE-WRITE-1 client (POST `/api/operations/apply`), follows the
  `projects/ce_version_client` pattern; `close_ce_write_client` wired into app shutdown.
- **`deploy/service.py`** — `publish_and_write_back` flow: validate run_mode; resolve run via
  `commit_sha`; publish → `demo_output_location_ref`; spike → skip-200; 422 →
  emit `write_back_fail_shacl` audit + return rejected (NO rollback, NO commit); ConnectionError →
  503, `write_back_complete` stays false; 201 → set `write_back_complete=True` +
  `write_back_artefact_iri` + emit PROV-O to PLAT-AUDIT-1. Actor = existing
  `BUILD_SERVICE_PRINCIPAL_IRI` constant.
- **`routers/deploy.py`** — the HTTP router; registered in `weave_backend/__init__.py`
  (import + `include_router`).

## AC → proof

| AC | Proof |
|---|---|
| AC-1 publish → output_location_ref | unit `test_deploy_service` + integration `test_publish_persists_demo_output_location_ref_to_aurora` |
| AC-2 publish_failed retains prior state | unit `test_deploy_service` (PublishError → 200 body) |
| AC-3/AC-4 422 → rejected + HITL, no commit | unit + integration `test_write_back_422_records_write_back_fail_shacl_audit_event` |
| AC-6 spike → skip | unit `test_deploy_service` |
| AC-7 201 → write_back_complete + PROV-O | integration `test_write_back_committed_sets_write_back_complete_and_emits_prov_o_activity` |
| AC-8 ConnectionError → 503 uncommitted | unit `test_ce_write_client` / `test_deploy_service` |

## Verification (coordinator-run)

- Unit: **31 passed** (`test_artefact_publisher`, `test_ce_write_client`, `test_deploy_service`,
  `test_generation_store`, `test_project_model`).
- Integration (docker lane, `-m "integration and docker"`): **3 passed** in 9.34s.
- Full fast unit suite: **green, no regression** from the new router.
- ruff: clean. mypy `src/ tests/`: clean (335 files). bandit: **0 HIGH**.

## Nuances / notes for QA

- Engineer hit the 100-tool cap twice; coordinator finished the verification tail (ran ruff/pytest/
  bandit, fixed 2 E501 in the integration test, committed it). Impl itself is the engineer's.
- **Commit hygiene deviation:** engineer folded unit tests + impl into one `feat:` commit
  (`f68b608`) rather than a separate `test:`-first commit. Functionally complete + green; flagged
  for the record, not re-litigated.
- Closes **XT-BE006-1** re-target (POST /runs happy-path was re-pointed here) — QA to confirm the
  HTTP happy path is now exercised.
- **XT-BE007-1 (TaskBrief `design_decisions` schema gap)** is still OPEN and upstream (BE-002 owns
  the schema); BE-009 wires DoR against real briefs, so QA should verify whether the DoR path is a
  silent no-op on production briefs here.
- `commit_workspace` base_tree fix (XT-BE008-2) already RESOLVED on this branch — no BE-009 action.
