"""Weave MCP server — exposes ontology resources and mutation tools via MCP."""

from __future__ import annotations

import asyncio
import json
import os

from pydantic import AnyUrl

from mcp.server import Server
from mcp.server.lowlevel import NotificationOptions
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Resource, TextContent, Tool

from .client import WeaveClient

BASE_URL = os.environ.get("WEAVE_BASE_URL", "http://localhost:8000")
PROJECT_ID = os.environ.get("WEAVE_PROJECT_ID", "demo")

_client = WeaveClient(BASE_URL, PROJECT_ID)
server = Server("weave")


@server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri=AnyUrl("weave://projects"),
            name="Weave projects",
            description="List of all saved ontology projects",
            mimeType="application/json",
        ),
        Resource(
            uri=AnyUrl(f"weave://project/{PROJECT_ID}/graph"),
            name=f"Graph ({PROJECT_ID})",
            description="Live ontology graph as nodes and edges",
            mimeType="application/json",
        ),
        Resource(
            uri=AnyUrl(f"weave://project/{PROJECT_ID}/ttl"),
            name=f"Ontology TTL — latest version ({PROJECT_ID})",
            description="Latest committed snapshot as Turtle RDF, or live graph if no snapshots exist",
            mimeType="text/turtle",
        ),
        Resource(
            uri=AnyUrl(f"weave://project/{PROJECT_ID}/ttl/live"),
            name=f"Ontology TTL — live ({PROJECT_ID})",
            description="Current live graph as Turtle RDF (may include uncommitted changes)",
            mimeType="text/turtle",
        ),
        Resource(
            uri=AnyUrl(f"weave://project/{PROJECT_ID}/history"),
            name=f"Mutation history ({PROJECT_ID})",
            description="Recent graph mutations (who changed what, when)",
            mimeType="application/json",
        ),
        Resource(
            uri=AnyUrl(f"weave://project/{PROJECT_ID}/versions"),
            name=f"Named versions ({PROJECT_ID})",
            description="List of committed named snapshots",
            mimeType="application/json",
        ),
        Resource(
            uri=AnyUrl("weave://vocabulary"),
            name="Weave vocabulary",
            description="Node kinds and relationship types available in Weave",
            mimeType="application/json",
        ),
    ]


@server.read_resource()
async def read_resource(uri: AnyUrl) -> list[ReadResourceContents]:
    uri_str = str(uri)

    if uri_str == "weave://projects":
        return [ReadResourceContents(
            content=json.dumps(_client.list_projects(), indent=2),
            mime_type="application/json",
        )]

    if uri_str == f"weave://project/{PROJECT_ID}/graph":
        return [ReadResourceContents(
            content=json.dumps(_client.get_graph(), indent=2),
            mime_type="application/json",
        )]

    if uri_str == f"weave://project/{PROJECT_ID}/ttl":
        return [ReadResourceContents(
            content=_client.get_latest_ttl(),
            mime_type="text/turtle",
        )]

    if uri_str == f"weave://project/{PROJECT_ID}/ttl/live":
        return [ReadResourceContents(
            content=_client.get_live_ttl(),
            mime_type="text/turtle",
        )]

    if uri_str == f"weave://project/{PROJECT_ID}/history":
        return [ReadResourceContents(
            content=json.dumps(_client.get_history(), indent=2),
            mime_type="application/json",
        )]

    if uri_str == f"weave://project/{PROJECT_ID}/versions":
        return [ReadResourceContents(
            content=json.dumps(_client.list_snapshots(), indent=2),
            mime_type="application/json",
        )]

    if uri_str == "weave://vocabulary":
        payload = json.dumps({
            "node_kinds": _client.get_node_kinds(),
            "relationship_types": _client.get_relationship_types(),
        }, indent=2)
        return [ReadResourceContents(
            content=payload,
            mime_type="application/json",
        )]

    raise ValueError(f"Unknown resource URI: {uri_str}")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="weave_propose",
            description=(
                "Ask the Weave AI to propose graph mutations from a natural-language prompt. "
                "Returns proposed operations for review. Does NOT apply changes automatically."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Natural language description of changes to make.",
                    },
                },
                "required": ["prompt"],
            },
        ),
        Tool(
            name="weave_apply",
            description=(
                "Apply a list of graph operations to Weave. Runs SHACL validation first. "
                "Use weave_propose first to get the operations list, review them, then call this."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "operations": {
                        "type": "array",
                        "description": "List of operations from weave_propose output.",
                        "items": {"type": "object"},
                    },
                },
                "required": ["operations"],
            },
        ),
        Tool(
            name="weave_commit",
            description="Commit the current graph state as a named version snapshot.",
            inputSchema={
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Short version label, e.g. 'v1.2 — added auth domain'.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional longer description.",
                    },
                },
                "required": ["label"],
            },
        ),
        Tool(
            name="weave_sparql",
            description="Run a read-only SPARQL SELECT query against the Weave ontology.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SPARQL SELECT query (SELECT only; no UPDATE/INSERT).",
                    },
                },
                "required": ["query"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "weave_propose":
        result = _client.llm_propose(arguments["prompt"])
        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    if name == "weave_apply":
        result = _client.apply_operations(arguments["operations"])
        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    if name == "weave_commit":
        result = _client.create_snapshot(
            arguments["label"],
            arguments.get("description", ""),
        )
        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    if name == "weave_sparql":
        import httpx as _httpx
        r = _httpx.post(
            f"{BASE_URL}/api/sparql",
            json={"query": arguments["query"]},
            params={"project_id": PROJECT_ID},
            timeout=30,
        )
        r.raise_for_status()
        return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

    raise ValueError(f"Unknown tool: {name}")


def main() -> None:
    async def _run() -> None:
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="weave",
                    server_version="0.1.0",
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )

    asyncio.run(_run())


if __name__ == "__main__":
    main()
