"""Smoke tests for the Weave MCP server handlers.

These tests mock WeaveClient and call the server handler functions directly —
no network calls to a real backend, no running MCP transport.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_client(**overrides):
    """Return a MagicMock WeaveClient with sensible defaults for every method."""
    mock = MagicMock()
    mock.list_projects.return_value = [{"id": "demo", "name": "Demo"}]
    mock.get_graph.return_value = {"nodes": [], "edges": []}
    mock.get_latest_ttl.return_value = "@prefix weave: <http://example.com/> ."
    mock.get_live_ttl.return_value = "@prefix weave: <http://example.com/> . # live"
    mock.get_history.return_value = []
    mock.list_snapshots.return_value = [{"id": "snap-1", "label": "v1"}]
    mock.get_node_kinds.return_value = [{"key": "Concept", "label": "Concept"}]
    mock.get_relationship_types.return_value = [{"key": "related_to", "label": "Related To"}]
    mock.llm_propose.return_value = {"message": "ok", "operations": []}
    mock.apply_operations.return_value = {"applied": True, "operations": []}
    mock.create_snapshot.return_value = {"id": "snap-2", "label": "v2"}
    for attr, value in overrides.items():
        setattr(mock, attr, value)
    return mock


# ---------------------------------------------------------------------------
# list_resources
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_resources_returns_at_least_five():
    """list_resources should expose at least 5 distinct resources."""
    # Import here so the module-level _client mock patch takes effect cleanly
    with patch("weave_mcp.server._client", _make_mock_client()):
        from weave_mcp.server import list_resources
        resources = await list_resources()

    assert len(resources) >= 5
    uris = [str(r.uri) for r in resources]
    assert "weave://projects" in uris
    assert "weave://vocabulary" in uris


# ---------------------------------------------------------------------------
# list_tools
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_tools_returns_four_tools():
    """list_tools must return exactly the four documented tool names."""
    with patch("weave_mcp.server._client", _make_mock_client()):
        from weave_mcp.server import list_tools
        tools = await list_tools()

    assert len(tools) == 4
    names = {t.name for t in tools}
    assert names == {"weave_propose", "weave_apply", "weave_commit", "weave_sparql"}


# ---------------------------------------------------------------------------
# read_resource — vocabulary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_read_resource_vocabulary_calls_right_endpoints():
    """read_resource('weave://vocabulary') must call get_node_kinds and get_relationship_types."""
    mock_client = _make_mock_client()

    with patch("weave_mcp.server._client", mock_client):
        from pydantic import AnyUrl
        from weave_mcp.server import read_resource

        contents = await read_resource(AnyUrl("weave://vocabulary"))

    mock_client.get_node_kinds.assert_called_once()
    mock_client.get_relationship_types.assert_called_once()

    assert len(contents) == 1
    import json
    payload = json.loads(contents[0].content)
    assert "node_kinds" in payload
    assert "relationship_types" in payload


# ---------------------------------------------------------------------------
# read_resource — unknown URI raises
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_read_resource_unknown_uri_raises():
    """read_resource with an unrecognised URI must raise ValueError."""
    with patch("weave_mcp.server._client", _make_mock_client()):
        from pydantic import AnyUrl
        from weave_mcp.server import read_resource

        with pytest.raises(ValueError, match="Unknown resource URI"):
            await read_resource(AnyUrl("weave://does-not-exist"))


# ---------------------------------------------------------------------------
# call_tool — weave_propose
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_tool_propose_delegates_to_client():
    """weave_propose tool should call llm_propose and return JSON text."""
    mock_client = _make_mock_client()

    with patch("weave_mcp.server._client", mock_client):
        from weave_mcp.server import call_tool

        result = await call_tool("weave_propose", {"prompt": "Add a Dog concept"})

    mock_client.llm_propose.assert_called_once_with("Add a Dog concept")
    assert len(result) == 1
    assert result[0].type == "text"
    import json
    data = json.loads(result[0].text)
    assert "operations" in data


# ---------------------------------------------------------------------------
# call_tool — weave_apply
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_tool_apply_delegates_to_client():
    """weave_apply tool should call apply_operations and return JSON text."""
    mock_client = _make_mock_client()
    ops = [{"op": "add_node", "summary": "Add Dog", "detail": {}}]

    with patch("weave_mcp.server._client", mock_client):
        from weave_mcp.server import call_tool

        result = await call_tool("weave_apply", {"operations": ops})

    mock_client.apply_operations.assert_called_once_with(ops)
    assert len(result) == 1
    import json
    data = json.loads(result[0].text)
    assert data["applied"] is True


# ---------------------------------------------------------------------------
# call_tool — weave_commit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_tool_commit_passes_label_and_description():
    """weave_commit should forward label and optional description to create_snapshot."""
    mock_client = _make_mock_client()

    with patch("weave_mcp.server._client", mock_client):
        from weave_mcp.server import call_tool

        result = await call_tool(
            "weave_commit",
            {"label": "v2 — taxonomy", "description": "Second cut"},
        )

    mock_client.create_snapshot.assert_called_once_with("v2 — taxonomy", "Second cut")
    assert len(result) == 1


@pytest.mark.asyncio
async def test_call_tool_commit_description_defaults_to_empty():
    """weave_commit should default description to empty string when omitted."""
    mock_client = _make_mock_client()

    with patch("weave_mcp.server._client", mock_client):
        from weave_mcp.server import call_tool

        await call_tool("weave_commit", {"label": "v3"})

    mock_client.create_snapshot.assert_called_once_with("v3", "")


# ---------------------------------------------------------------------------
# call_tool — unknown tool raises
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_tool_unknown_raises():
    """call_tool with an unrecognised name must raise ValueError."""
    with patch("weave_mcp.server._client", _make_mock_client()):
        from weave_mcp.server import call_tool

        with pytest.raises(ValueError, match="Unknown tool"):
            await call_tool("no_such_tool", {})
