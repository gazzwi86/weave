# Progress: BE-V1-TASK-003 — BPMO Retrieval Under 200-Node Cap + Investigator Runs (ADR-005, FR-051)

`build-engine` EPIC-011. **PARALLEL LANE** worktree `../weave-EPIC-011`, branch `feature/BE-V1-EPIC-011`
(off EPIC-002, so has TASK-001). Coordinator-authored from a clean one-pass engineer receipt.

## Outcome

Impl complete + committed. 15 unit + 1 non-docker integration green (16 run), 2 docker integration written
(unrun, coordinator-serialized). Coverage 92%, ruff/mypy/bandit clean. QA pending.

## What shipped (`packages/backend/src/weave_backend/build/`)

- `retrieval.py` (new) — deterministic seed + weighted k-hop BPMO retrieval, capped at 200 nodes; emits
  `retrieval_truncated` to the run-log when capped (AC-3). Tie-break `sorted(key=(-score, iri))` (NOT
  heapq.nlargest — can't express score-desc/IRI-asc deterministically).
- `investigator.py` (new) — read-only investigator dispatch (Sandbox in-process descriptor) + persistence
  via `dep_summaries` JSONB `content` column (no migration).
- `model_routing.py` — `ROLE_TIER["investigator"]="sonnet"`.

## Decisions (ADR-021 — 3 documented gaps)

- `predicate_class` ships structural(explicit)/annotation(fallback); "associative" weight configured but
  unrouted (no associative IRI set supplied by the brief — deliberately not hand-invented, ontology-standards).
- `dep_summaries` reused via existing JSONB `content` — no migration (0031+ block unused; no AC needs `kind`
  queryable).
- Investigator Sandbox principal = lightweight in-process descriptor, NOT real AWS STS (no agent runtime yet).

## Gates

- AC-1..7 all tested per the brief's AC-to-Test mapping. Coverage 92% (`retrieval.py` 91%, `investigator.py`
  90%, `model_routing.py` 100%; misses = asyncpg persistence covered by the 2 unrun docker tests). ruff/mypy/
  bandit clean. Complexity: bundled `dispatch_investigator` args into `InvestigatorRequest` dataclass (≤5 params).

## Commits (feature/BE-V1-EPIC-011)

- `56060c8`·`3086bf7` retrieval · `72620f2`·`8163e4b` investigator · `ab51a4b` truncation-integration ·
  `4a4a5bc` persistence-docker-test · `66b3fd0` ADR-021.

## Dependencies

- **blocked_by:** [TASK-001] (present on this off-EPIC-002 branch) · This is EPIC-011's LAST task →
  on QA PASS, EPIC-011 closes.

## QA (2026-07-10) — VERDICT: PASS
17 tests (15+2 QA edge `0682e94`: exact-cap boundary, no-persist-on-failure), 91% cov, ruff/mypy/bandit
clean. 200-node cap structurally guaranteed (seeds carry inf-score, raise-loud on seed-overflow). Tie-break
deterministic `(-score, iri)`. Investigator genuinely read-only (tool-allowlist enforced). ADR-021's 3 gaps
all legit (none dodge an AC). Pre-existing stale `ROLE_TIER["plan"]="fable"` (fable retired on main) — branch
staleness, resolves at rebase. Docker AC-6/AC-7 (tenant isolation) reviewed+collect-only; run in CI at merge.
