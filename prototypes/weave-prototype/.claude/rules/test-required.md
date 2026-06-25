# Rule: New behaviour ships with tests

**Every new feature, endpoint, store method, validation rule, and frontend helper must include tests. "Done" means tests pass.**

## Backend requirements

- New `OntologyStore` method → at least one test in `tests/test_store.py` using the `store` fixture.
- New API endpoint → at least one happy-path test and one error case in `tests/test_api.py` (or the appropriate `test_*.py`) using the `client` fixture.
- New SHACL shape or validation rule → one test where the shape passes and one where it produces the expected violation.
- New `schema_rules()` output → a test that the rule appears in the introspected list.

## Frontend requirements

- New `lib/` helper (pure function) → co-located `.test.ts` covering the core logic paths.
- New React component → co-located `.test.tsx` covering render-without-crash and key interactions.
- New view → at minimum a render test in `views/<Name>View.test.tsx`.

## Quality gate

Before committing:
1. `cd backend && .venv/bin/pytest` — all tests pass.
2. `cd frontend && npm run test` — all tests pass.
3. `cd frontend && npm run typecheck` — no type errors.

Red tests block the commit. Do not use `--ignore` or `@pytest.mark.skip` to paper over failures — fix them or explicitly track them as known issues in ROADMAP.md.

## Minimum test coverage

- Not every line needs a test, but every **new behaviour** (new code path, new constraint, new edge case you discovered) needs one.
- When a bug is fixed, add a regression test that would have caught it.
- Tests should be fast and in-memory. No real network calls, no disk I/O (the `store` and `client` fixtures are already in-memory).
