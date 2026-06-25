import httpx


class WeaveClient:
    def __init__(self, base_url: str = "http://localhost:8000", project_id: str = "demo"):
        self.base_url = base_url.rstrip("/")
        self.project_id = project_id
        self._http = httpx.Client(timeout=30.0)

    def _get(self, path: str, **kwargs):
        params = {"project_id": self.project_id, **kwargs}
        r = self._http.get(f"{self.base_url}/api{path}", params=params)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: dict, **kwargs):
        params = {"project_id": self.project_id, **kwargs}
        r = self._http.post(f"{self.base_url}/api{path}", json=body, params=params)
        r.raise_for_status()
        return r.json()

    def get_graph(self) -> dict:
        return self._get("/graph")

    def list_projects(self) -> list:
        r = self._http.get(f"{self.base_url}/api/projects")
        r.raise_for_status()
        return r.json()

    def list_snapshots(self) -> list:
        return self._get("/snapshots")

    def get_snapshot_ttl(self, snapshot_id: str) -> str:
        r = self._http.get(
            f"{self.base_url}/api/snapshots/{snapshot_id}/ttl",
            params={"project_id": self.project_id},
        )
        r.raise_for_status()
        return r.text

    def get_latest_ttl(self) -> str:
        snaps = self.list_snapshots()
        if not snaps:
            return self.get_live_ttl()
        return self.get_snapshot_ttl(snaps[0]["id"])

    def get_live_ttl(self) -> str:
        r = self._http.get(
            f"{self.base_url}/api/ontology/ttl",
            params={"project_id": self.project_id},
        )
        r.raise_for_status()
        return r.text

    def get_history(self, limit: int = 20) -> list:
        return self._get("/history", limit=limit)

    def get_node_kinds(self) -> list:
        r = self._http.get(f"{self.base_url}/api/node-kinds")
        r.raise_for_status()
        return r.json()

    def get_relationship_types(self) -> list:
        r = self._http.get(f"{self.base_url}/api/relationship-types")
        r.raise_for_status()
        return r.json()

    def llm_propose(self, prompt: str) -> dict:
        return self._post("/llm/propose", {"prompt": prompt})

    def apply_operations(self, operations: list) -> dict:
        return self._post("/operations/apply", {"operations": operations})

    def create_snapshot(self, label: str, description: str = "") -> dict:
        return self._post("/snapshots", {"label": label, "description": description})
