"""ProjectManager — owns the set of saved ontologies and their stores.

Each project is an independent ontology with its own Oxigraph store (a
subdirectory on disk, or an in-memory store in tests). A JSON manifest records
project metadata. The demo ("Monsters, Inc.") is always present and protected.
"""

from __future__ import annotations

import json
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..ontology import OntologyStore
from ..ontology.seed import DEMO_TURTLE

DEMO_ID = "demo"
DEMO_NAME = "Monsters, Inc. (demo)"
DEMO_DESCRIPTION = (
    "A comprehensive example ontology modelling the Monsters, Inc. universe as "
    "an enterprise architecture — domains, capabilities, systems, services, "
    "data assets, and a SKOS glossary."
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


class ProjectManager:
    """Registry of projects, each backed by its own OntologyStore."""

    def __init__(self, data_dir: str | None = None, seed_demo: bool = True) -> None:
        self._root = Path(data_dir) if data_dir else None
        self._projects_dir = self._root / "projects" if self._root else None
        self._manifest_path = self._root / "projects.json" if self._root else None
        self._meta: dict[str, dict[str, Any]] = {}
        self._stores: dict[str, OntologyStore] = {}
        if self._projects_dir:
            self._projects_dir.mkdir(parents=True, exist_ok=True)
            self._load_manifest()
        if seed_demo and DEMO_ID not in self._meta:
            self._create_demo()

    # --- Manifest persistence ---------------------------------------------

    def _load_manifest(self) -> None:
        if self._manifest_path and self._manifest_path.exists():
            data = json.loads(self._manifest_path.read_text())
            self._meta = {p["id"]: p for p in data.get("projects", [])}

    def _save_manifest(self) -> None:
        if self._manifest_path:
            self._manifest_path.write_text(
                json.dumps({"projects": list(self._meta.values())}, indent=2)
            )

    def _store_dir(self, project_id: str) -> str | None:
        return str(self._projects_dir / project_id) if self._projects_dir else None

    # --- Store lifecycle ---------------------------------------------------

    def _open_store(self, project_id: str, seed_turtle: str | None = None) -> OntologyStore:
        store = OntologyStore(data_dir=self._store_dir(project_id), seed=False)
        if seed_turtle:
            store.import_turtle(seed_turtle)
        self._stores[project_id] = store
        return store

    def get_store(self, project_id: str) -> OntologyStore:
        if project_id not in self._meta:
            raise KeyError(project_id)
        if project_id not in self._stores:
            self._open_store(project_id)
        return self._stores[project_id]

    # --- Project CRUD ------------------------------------------------------

    def _create_demo(self) -> None:
        self._meta[DEMO_ID] = {
            "id": DEMO_ID,
            "name": DEMO_NAME,
            "description": DEMO_DESCRIPTION,
            "created": _now(),
            "is_demo": True,
        }
        self._open_store(DEMO_ID, seed_turtle=DEMO_TURTLE)
        self._save_manifest()

    def create(
        self,
        name: str,
        description: str = "",
        seed: str = "empty",
        turtle: str | None = None,
    ) -> dict[str, Any]:
        project_id = uuid.uuid4().hex[:12]
        self._meta[project_id] = {
            "id": project_id,
            "name": name,
            "description": description,
            "created": _now(),
            "is_demo": False,
        }
        seed_ttl = DEMO_TURTLE if seed == "demo" else (turtle if seed == "turtle" else None)
        self._open_store(project_id, seed_turtle=seed_ttl)
        self._save_manifest()
        return self._with_counts(project_id)

    def update(
        self, project_id: str, name: str | None = None, description: str | None = None
    ) -> dict[str, Any]:
        meta = self._require(project_id)
        if meta.get("is_demo"):
            raise ValueError("The demo project cannot be modified.")
        if name is not None:
            meta["name"] = name
        if description is not None:
            meta["description"] = description
        self._save_manifest()
        return self._with_counts(project_id)

    def delete(self, project_id: str) -> None:
        meta = self._require(project_id)
        if meta.get("is_demo"):
            raise ValueError("The demo project cannot be deleted.")
        self._stores.pop(project_id, None)
        self._meta.pop(project_id, None)
        store_dir = self._store_dir(project_id)
        if store_dir:
            shutil.rmtree(store_dir, ignore_errors=True)
        self._save_manifest()

    # --- Reads -------------------------------------------------------------

    def list(self) -> list[dict[str, Any]]:
        projects = [self._with_counts(pid) for pid in self._meta]
        # Demo first, then newest-created first.
        return sorted(projects, key=lambda p: (not p["is_demo"], p["created"]))

    def meta(self, project_id: str) -> dict[str, Any]:
        self._require(project_id)
        return self._with_counts(project_id)

    def _require(self, project_id: str) -> dict[str, Any]:
        if project_id not in self._meta:
            raise KeyError(project_id)
        return self._meta[project_id]

    def _with_counts(self, project_id: str) -> dict[str, Any]:
        graph = self.get_store(project_id).graph()
        return {
            **self._meta[project_id],
            "node_count": len(graph["nodes"]),
            "edge_count": len(graph["edges"]),
        }
