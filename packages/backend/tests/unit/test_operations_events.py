"""CE-V1-TASK-008 unit tests: pure `operations/events.py` helpers -- op ->
change_type mapping, op -> entity_iri extraction, retention default/tunable,
and the 410-aged-cursor boundary. Mocked asyncpg boundary throughout; real
same-txn/RLS/append-only/pagination behaviour proven in the docker-marked
integration suite.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import events
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    DeleteEdgeOp,
    DeleteNodeOp,
    UpdateNodeOp,
)
from weave_backend.settings.resolver import ResolvedSetting, SettingNotFound


def test_op_change_type_maps_add_node_to_added() -> None:
    op = AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing")
    assert events.op_change_type(op) == "added"


def test_op_change_type_maps_update_node_to_updated() -> None:
    op = UpdateNodeOp(op="update_node", iri="urn:weave:instances:a1", properties={})
    assert events.op_change_type(op) == "updated"


def test_op_change_type_maps_delete_node_to_deleted() -> None:
    op = DeleteNodeOp(op="delete_node", iri="urn:weave:instances:a1")
    assert events.op_change_type(op) == "deleted"


def test_op_change_type_maps_add_edge_to_added() -> None:
    op = AddEdgeOp(op="add_edge", subject_ref="p1", predicate="performedBy", object_ref="a1")
    assert events.op_change_type(op) == "added"


def test_op_change_type_maps_delete_edge_to_deleted() -> None:
    op = DeleteEdgeOp(
        op="delete_edge",
        subject="urn:weave:instances:p1",
        predicate="performedBy",
        object="urn:weave:instances:a1",
    )
    assert events.op_change_type(op) == "deleted"


def test_op_entity_iri_resolves_add_node_ref_through_ref_map() -> None:
    op = AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing")
    ref_map = {"a1": "urn:weave:instances:a1-real"}
    assert events.op_entity_iri(op, ref_map) == "urn:weave:instances:a1-real"


def test_op_entity_iri_falls_back_to_raw_ref_when_unresolved() -> None:
    op = AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing")
    assert events.op_entity_iri(op, {}) == "a1"


def test_op_entity_iri_uses_iri_field_for_update_and_delete_node() -> None:
    update_op = UpdateNodeOp(op="update_node", iri="urn:weave:instances:a1", properties={})
    delete_op = DeleteNodeOp(op="delete_node", iri="urn:weave:instances:a2")
    assert events.op_entity_iri(update_op, {}) == "urn:weave:instances:a1"
    assert events.op_entity_iri(delete_op, {}) == "urn:weave:instances:a2"


def test_op_entity_iri_resolves_edge_subject_through_ref_map() -> None:
    add_edge = AddEdgeOp(op="add_edge", subject_ref="p1", predicate="performedBy", object_ref="a1")
    ref_map = {"p1": "urn:weave:instances:p1-real"}
    assert events.op_entity_iri(add_edge, ref_map) == "urn:weave:instances:p1-real"

    delete_edge = DeleteEdgeOp(
        op="delete_edge",
        subject="urn:weave:instances:p1",
        predicate="performedBy",
        object="urn:weave:instances:a1",
    )
    assert events.op_entity_iri(delete_edge, {}) == "urn:weave:instances:p1"


async def test_retention_days_defaults_to_thirty_when_nothing_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _raise_not_found(*_args: object, **_kwargs: object) -> ResolvedSetting:
        raise SettingNotFound("events.change_feed.retention_days")

    monkeypatch.setattr(events, "resolve_setting", _raise_not_found)

    assert await events.retention_days(AsyncMock(), tenant_id="t1") == 30


async def test_retention_days_honours_a_tunable_plat_settings_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _resolved(*_args: object, **_kwargs: object) -> ResolvedSetting:
        return ResolvedSetting(
            key=events.RETENTION_SETTING_KEY,
            value=7,
            resolved_at="2026-07-09T00:00:00Z",
            resolved_from_iri="urn:weave:tenant:t1:company",
        )

    monkeypatch.setattr(events, "resolve_setting", _resolved)

    assert await events.retention_days(AsyncMock(), tenant_id="t1") == 7


def test_cursor_not_aged_out_when_nothing_has_ever_expired() -> None:
    # AC-008-05 edge case: brand-new/empty tenant, or a tenant with real
    # rows but none old enough to expire -- since_seq=0 must be a normal
    # empty/short page, never a 410 (nothing was ever lost).
    assert events._is_cursor_aged_out(since_seq=0, newest_expired_seq=None) is False


def test_cursor_aged_out_when_it_points_before_an_expired_row() -> None:
    assert events._is_cursor_aged_out(since_seq=0, newest_expired_seq=300) is True


def test_cursor_not_aged_out_when_it_is_already_past_every_expired_row() -> None:
    assert events._is_cursor_aged_out(since_seq=500, newest_expired_seq=300) is False


async def test_record_commit_event_inserts_with_latest_published_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = AsyncMock()
    conn.fetchrow.return_value = {"version_iri": "urn:weave:tenant:t1:ws:w1:v0.2.0"}

    await events.record_commit_event(
        conn,
        events.CommitEvent(
            tenant_id="t1",
            workspace_id="w1",
            change_type="added",
            entity_iri="urn:weave:instances:a1",
            version_iri=None,
            actor="urn:weave:principal:user:u1",
        ),
    )

    insert_call = conn.execute.call_args
    assert "INSERT INTO graph_change_events" in insert_call.args[0]
    assert insert_call.args[1:] == (
        "t1",
        "added",
        "urn:weave:instances:a1",
        None,
        "urn:weave:tenant:t1:ws:w1:v0.2.0",
        "urn:weave:principal:user:u1",
    )


async def test_record_commit_event_last_published_version_is_null_when_never_published(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = AsyncMock()
    conn.fetchrow.return_value = None

    await events.record_commit_event(
        conn,
        events.CommitEvent(
            tenant_id="t1",
            workspace_id="w1",
            change_type="constraint-violated",
            entity_iri="urn:weave:instances:a1",
            version_iri=None,
            actor="urn:weave:principal:user:u1",
        ),
    )

    insert_call = conn.execute.call_args
    assert insert_call.args[1:] == (
        "t1",
        "constraint-violated",
        "urn:weave:instances:a1",
        None,
        None,
        "urn:weave:principal:user:u1",
    )
