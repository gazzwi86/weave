# Python — testing overlay

## Framework

**pytest** with these extensions:

- `pytest-cov` — coverage
- `pytest-asyncio` — async tests
- `pytest-xdist` — parallel execution
- `hypothesis` — property-based testing (optional but encouraged)
- `schemathesis` — OpenAPI contract tests
- `moto` — AWS service mocks
- `testcontainers` — real DB integration tests

## Test layout

```
tests/
  conftest.py          # fixtures shared across the suite
  unit/
    test_<module>.py
  integration/
    test_<feature>.py  # Testcontainers / moto / Cosmos-emulator
  e2e/
    test_<flow>.py     # playwright-python
```

## Naming convention

```python
class TestCalculateScore:
    def test_returns_zero_for_empty_numbers(self): ...
    def test_applies_bonus_multiplier(self): ...
    def test_rejects_negative_bonus(self): ...
```

Tests named `test_<does_X>_when_<condition>`. AAA layout inside.

## Coverage config

```toml
[tool.coverage.run]
branch = true
source = ["src"]

[tool.coverage.report]
fail_under = 80              # Plugin Law — block merge below 80%
show_missing = true
skip_covered = false
```

## Async tests

```python
import pytest

@pytest.mark.asyncio
async def test_fetch_user_returns_profile(user_repo):
    user = await user_repo.get(id="abc")
    assert user.email == "ada@example.com"
```

## Browser automation (Plugin Law B)

```python
# tests/e2e/test_signup_flow.py
from playwright.sync_api import Page, expect

def test_signup_flow(page: Page, db):
    page.goto("/signup")
    page.fill("[data-testid=email]", "ada@example.com")
    page.fill("[data-testid=password]", "Secret123!")
    page.click("[data-testid=submit]")
    expect(page).to_have_url("/dashboard")

    # Law 16: assert backend state, not just UI.
    user = db.execute("SELECT * FROM users WHERE email=%s", ["ada@example.com"]).fetchone()
    assert user is not None
```
