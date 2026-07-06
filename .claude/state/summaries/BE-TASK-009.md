# BE-TASK-009 — Deploy + CE write-back (build-engine, EPIC-008)

**Status:** DONE — QA PASS after 1 logic retry (AC-5). `retry_count: 1`.
**Branch:** `feature/BE-EPIC-008`. **Commits:** `f68b608` (feat: impl), `0b3338b` (test: integration),
`3e0f255` (QA edge tests), `3887873` (fix: AC-5 advisory audit + Law E helper extraction).
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
| AC-5 zero-violation verify + advisories audited on 201 | unit `test_write_back_records_shacl_violations_in_audit` (advisories in outcome + audit payload) + `test_write_back_clean_201_omits_advisories_key` (empty-case regression) — **added in retry 1; was the FAIL** |
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
- **XT-BE006-1 does NOT close here** (QA-confirmed — corrects my earlier claim). It concerns
  `routers/runs.py` `start_run_route` (`POST /api/projects/{iri}/runs`, BE-006's endpoint) — a
  different router BE-009 never touches. No ASGI-TestClient 202 happy-path test for `runs.py` exists
  anywhere. Second mis-target (BE-007 was the first). Re-pointed in the ledger to whichever task
  actually adds that test.
- **XT-BE007-1 is NOT BE-009's concern** (QA-confirmed — corrects my earlier claim). `design_decisions`
  is checked by `build/gates.py:run_dor_gate`, called from `routers/{runs,gates,tasks,specs}.py` —
  `deploy/service.py` never imports or calls it. There is no DoR wiring in this task; the finding
  stays upstream (BE-002 schema owner).
- `commit_workspace` base_tree fix (XT-BE008-2) — QA independently re-verified genuinely fixed
  (`test_repo_bootstrap_drivers.py` 13/13). No BE-009 action.
- **QA retry 1 (logic):** AC-5 (audit SHACL advisories on committed 201) was not implemented —
  `_write_back` never read `response.advisories`. Being fixed now; QA committed a pinning test
  (`3e0f255`). Also fixing Law E: `_write_back` was ~60 lines (>50 budget), no waiver.
