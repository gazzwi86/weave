"""Shared test fixtures."""

from __future__ import annotations

import os

# In-memory everything: an empty data dir makes both the OntologyStore and the
# ProjectManager skip disk (and the RocksDB single-writer lock). The demo is
# still seeded in memory so the client fixture has content to act on.
os.environ["WEAVE_DATA_DIR"] = ""
os.environ["WEAVE_SEED_DEMO"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.ontology import OntologyStore  # noqa: E402


@pytest.fixture
def store() -> OntologyStore:
    """A fresh, in-memory, demo-seeded store per test (for store-level tests)."""
    return OntologyStore(data_dir=None, seed=True)


@pytest.fixture
def client() -> TestClient:
    """A TestClient backed by an in-memory ProjectManager with the demo seeded."""
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
