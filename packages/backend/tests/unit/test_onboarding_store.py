"""ONB-TASK-001: upsert semantics per state kind, against a stub asyncpg
connection (no real Postgres -- mirrors test_notifications_store.py's
`_FakeConnection` pattern). Covers AC-001-05.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.onboarding import store

_TENANT = "acme-corp"
_USER = "urn:weave:principal:user:u-1"


class _FakeConnection:
    """In-memory stand-in keyed by (tenant_id, user_id[, sub-key]) for the
    spine row, one tour_progress row, and one dismissal row.
    """

    def __init__(self) -> None:
        self.spine: dict[str, Any] | None = None
        self.tours: dict[str, dict[str, Any]] = {}
        self.dismissals: dict[tuple[str, str], dict[str, Any]] = {}

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "FROM onboarding_state" in query:
            return self.spine
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        if "FROM tour_progress" in query:
            return list(self.tours.values())
        if "FROM dismissal" in query:
            return list(self.dismissals.values())
        if "FROM exercise_completion" in query or "FROM activation" in query:
            return []
        raise AssertionError(f"unexpected fetch: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        if "INSERT INTO onboarding_state" in query:
            (
                _tenant_id,
                _user_id,
                role_path,
                path_variant,
                path_chosen_manually,
                checklist_dismissed_at,
                whats_new_seen_at,
            ) = args
            existing = self.spine or {
                "role_path": "business",
                "path_variant": "default",
                "path_chosen_manually": False,
                "checklist_dismissed_at": None,
                "checklist_completed_at": None,
                "whats_new_seen_at": None,
            }
            self.spine = {
                "role_path": role_path if role_path is not None else existing["role_path"],
                "path_variant": (
                    path_variant if path_variant is not None else existing["path_variant"]
                ),
                "path_chosen_manually": (
                    path_chosen_manually
                    if path_chosen_manually is not None
                    else existing["path_chosen_manually"]
                ),
                "checklist_dismissed_at": (
                    checklist_dismissed_at
                    if checklist_dismissed_at is not None
                    else existing["checklist_dismissed_at"]
                ),
                "checklist_completed_at": existing["checklist_completed_at"],
                "whats_new_seen_at": (
                    whats_new_seen_at
                    if whats_new_seen_at is not None
                    else existing["whats_new_seen_at"]
                ),
            }
            return "INSERT 0 1"
        if "INSERT INTO tour_progress" in query:
            _tenant_id, _user_id, tour_id, last_completed_step, completed, skipped = args
            existing_tour = self.tours.get(tour_id) or {}
            now = datetime.now(UTC)
            self.tours[tour_id] = {
                "tour_id": tour_id,
                "last_completed_step": last_completed_step,
                "completed_at": now if completed else existing_tour.get("completed_at"),
                "skipped_at": now if skipped else existing_tour.get("skipped_at"),
            }
            return "INSERT 0 1"
        if "INSERT INTO dismissal" in query:
            _tenant_id, _user_id, kind, ref_id = args
            self.dismissals[(kind, ref_id)] = {
                "kind": kind,
                "ref_id": ref_id,
                "dismissed_at": datetime.now(UTC),
            }
            return "INSERT 0 1"
        if query.startswith("DELETE FROM dismissal") and "kind = 'beacon'" not in query:
            _tenant_id, _user_id, kind, ref_id = args
            existed = (kind, ref_id) in self.dismissals
            self.dismissals.pop((kind, ref_id), None)
            return "DELETE 1" if existed else "DELETE 0"
        if "kind = 'beacon'" in query:
            beacon_keys = [key for key in self.dismissals if key[0] == "beacon"]
            for key in beacon_keys:
                del self.dismissals[key]
            return f"DELETE {len(beacon_keys)}"
        raise AssertionError(f"unexpected execute: {query}")


async def test_get_state_returns_defaults_for_new_user() -> None:
    """AC-001-04: a brand-new user (no spine row yet) gets a well-formed
    default response, not an error -- the SPA's every-screen bootstrap call
    must never 404.
    """
    conn = _FakeConnection()

    record = await store.get_state(conn, tenant_id=_TENANT, user_id=_USER)

    assert record.role_path == "business"
    assert record.path_variant == "default"
    assert record.path_chosen_manually is False
    assert record.checklist_dismissed_at is None
    assert record.tours == []
    assert record.dismissals == []
    assert record.exercise_completions == []
    assert record.activations == []


async def test_patch_state_creates_row_on_first_patch() -> None:
    conn = _FakeConnection()

    await store.patch_state(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        patch=store.StatePatch(role_path="technical", path_chosen_manually=True),
    )

    assert conn.spine is not None
    assert conn.spine["role_path"] == "technical"
    assert conn.spine["path_chosen_manually"] is True
    assert conn.spine["path_variant"] == "default"


async def test_patch_state_only_changes_provided_fields() -> None:
    conn = _FakeConnection()
    await store.patch_state(
        conn, tenant_id=_TENANT, user_id=_USER, patch=store.StatePatch(role_path="compliance")
    )

    await store.patch_state(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        patch=store.StatePatch(path_chosen_manually=True),
    )

    assert conn.spine is not None
    assert conn.spine["role_path"] == "compliance"
    assert conn.spine["path_chosen_manually"] is True


async def test_upsert_tour_progress_creates_row() -> None:
    conn = _FakeConnection()

    await store.upsert_tour_progress(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        tour_id="ce-onboarding",
        patch=store.TourProgressPatch(last_completed_step=2),
    )

    assert conn.tours["ce-onboarding"]["last_completed_step"] == 2
    assert conn.tours["ce-onboarding"]["completed_at"] is None
    assert conn.tours["ce-onboarding"]["skipped_at"] is None


async def test_upsert_tour_progress_skip_preserves_last_completed_step() -> None:
    """Table note (data-model.md): skipping a tour keeps `last_completed_step`
    so a future "Resume tour" still lands on the right step -- skip does not
    reset progress.
    """
    conn = _FakeConnection()
    await store.upsert_tour_progress(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        tour_id="ce-onboarding",
        patch=store.TourProgressPatch(last_completed_step=3),
    )

    await store.upsert_tour_progress(
        conn,
        tenant_id=_TENANT,
        user_id=_USER,
        tour_id="ce-onboarding",
        patch=store.TourProgressPatch(last_completed_step=3, skipped=True),
    )

    assert conn.tours["ce-onboarding"]["last_completed_step"] == 3
    assert conn.tours["ce-onboarding"]["skipped_at"] is not None


async def test_upsert_dismissal_is_idempotent() -> None:
    conn = _FakeConnection()

    await store.upsert_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="b-1"
    )
    await store.upsert_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="b-1"
    )

    assert len(conn.dismissals) == 1
    assert conn.dismissals[("beacon", "b-1")]["ref_id"] == "b-1"


async def test_delete_dismissal_returns_false_when_missing() -> None:
    conn = _FakeConnection()

    found = await store.delete_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="does-not-exist"
    )

    assert found is False


async def test_delete_dismissal_removes_row() -> None:
    conn = _FakeConnection()
    await store.upsert_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="b-1"
    )

    found = await store.delete_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="b-1"
    )

    assert found is True
    assert ("beacon", "b-1") not in conn.dismissals


async def test_delete_beacon_dismissals_bulk_deletes_only_beacon_kind() -> None:
    """ "Show all hints" (DELETE /dismissals/beacon): clears every `beacon`
    dismissal but must never touch a `welcome_modal` row.
    """
    conn = _FakeConnection()
    await store.upsert_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="b-1"
    )
    await store.upsert_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="beacon", ref_id="b-2"
    )
    await store.upsert_dismissal(
        conn, tenant_id=_TENANT, user_id=_USER, kind="welcome_modal", ref_id="w-1"
    )

    deleted_count = await store.delete_beacon_dismissals(conn, tenant_id=_TENANT, user_id=_USER)

    assert deleted_count == 2
    assert list(conn.dismissals.keys()) == [("welcome_modal", "w-1")]
