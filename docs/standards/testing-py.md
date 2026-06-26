# Testing Standards — Python

> TypeScript testing standards: see [`testing-ts.md`](testing-ts.md).

## Test-Driven Development (TDD)

Same cycle as TypeScript: RED → GREEN → REFACTOR. Write the failing test before
writing the implementation. FastAPI endpoints get at least one integration test
before the route handler is written.

## Frameworks

| Type | Tool | When to Use |
|------|------|-------------|
| Unit | pytest | Pure functions, service methods, utilities |
| Integration | pytest + `httpx.AsyncClient` | FastAPI routes, SPARQL query behaviour, Pydantic validation |
| E2E | Playwright (via `testing-ts.md`) | Full browser flows |
| Mutation | mutmut | Test quality gate (≥ 70% mutation score) |

## Project setup

```bash
uv add --dev pytest pytest-cov pytest-asyncio httpx mutmut
```

**`pyproject.toml`:**

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=app --cov-report=term-missing --cov-fail-under=80"
```

## Structure

```
tests/
├── conftest.py          # shared fixtures (app client, test graph, etc.)
├── unit/
│   ├── test_ontology_store.py
│   └── test_shacl_validator.py
└── integration/
    ├── test_entities_api.py
    └── test_graph_query.py
```

Tests mirror the `app/` module structure. Test files are named `test_<module>.py`.

## Naming convention

```python
class TestOntologyStore:
    def test_add_triple_persists_in_default_graph(self) -> None:
        ...

    def test_add_triple_raises_when_subject_is_blank_node(self) -> None:
        ...
```

Name format: `test_<what>_<condition>`. The name should read like a sentence
describing the expected behaviour without looking at the body.

## Fixtures (conftest.py)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.ontology.store import OntologyStore


@pytest.fixture
def graph() -> OntologyStore:
    """In-memory Oxigraph store, reset per test."""
    return OntologyStore()


@pytest.fixture
async def client() -> AsyncClient:
    """Async HTTP client wired to the FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

Fixtures scope: `function` (default) unless shared expensive setup warrants `session`.
Never use `session`-scoped fixtures that mutate shared state.

## FastAPI integration tests

```python
async def test_create_entity_returns_201(client: AsyncClient) -> None:
    payload = {"label": "Customer", "type": "weave:BusinessActor"}
    response = await client.post("/api/v1/entities", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["label"] == "Customer"
    assert "id" in data
```

**Principle:** Integration tests call the full FastAPI stack (routing, middleware,
Pydantic validation, service layer). They do not mock the ontology store — they use
an in-memory Oxigraph instance. Only external I/O (Claude API, webhook calls, AWS
services) is mocked.

## Mocking strategy

```python
from unittest.mock import AsyncMock, patch

async def test_llm_entity_creation_calls_claude(client: AsyncClient) -> None:
    with patch("app.services.llm.anthropic_client.messages") as mock_msgs:
        mock_msgs.create = AsyncMock(return_value=FakeAnthropicResponse(...))
        response = await client.post("/api/v1/entities/from-nl", json={"text": "Add a Customer"})

    assert response.status_code == 201
    mock_msgs.create.assert_called_once()
```

**Always mock:** External HTTP (Claude/Anthropic API, webhooks), AWS SDK calls, time
(`freezegun`), random seeds.

**Never mock:** OntologyStore, Pydantic models, FastAPI routing internals,
SHACL validator (use a real test graph with known shapes).

## Coverage thresholds

| Metric | Minimum | Enforcement |
|--------|---------|-------------|
| Line | 80% | `--cov-fail-under=80` in pytest config; CI blocks merge |
| Branch | 75% | `--cov-branch` flag; CI warns |
| Mutation | 70% | mutmut run; CI blocks merge if below |

## Mutation testing

**Tool:** [mutmut](https://github.com/boxed/mutmut)

```bash
uv run mutmut run
uv run mutmut results   # show surviving mutants
```

**`pyproject.toml`:**

```toml
[tool.mutmut]
paths_to_mutate = "app/"
tests_dir = "tests/"
```

**Principle:** A surviving mutant means a test gap. Add a test that kills it — do not
raise the threshold to paper over it. Focus mutation runs on business-critical modules
(SHACL validation, SPARQL query builder, entity service) first.

## SPARQL / RDF test patterns

Test the SPARQL query layer against a real in-memory store with known fixture triples.
Do not mock triple-store responses — the query syntax itself must be validated.

```python
def test_find_entities_by_type_returns_matching_subjects(graph: OntologyStore) -> None:
    # Arrange — seed the store with fixture triples
    graph.add((EX.Customer, RDF.type, WEAVE.BusinessActor))
    graph.add((EX.Supplier, RDF.type, WEAVE.BusinessActor))
    graph.add((EX.Invoice, RDF.type, WEAVE.BusinessObject))

    # Act
    results = graph.find_by_type(WEAVE.BusinessActor)

    # Assert
    assert set(results) == {EX.Customer, EX.Supplier}
```
