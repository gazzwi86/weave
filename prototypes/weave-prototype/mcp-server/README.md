# Weave MCP Server

Exposes a running Weave ontology backend as MCP resources and tools so Claude Code
(and any other MCP client) can read and modify the ontology without opening the browser.

## Install

```bash
cd mcp-server
pip install -e .
```

## Configure in Claude Code

Add to your `.claude/settings.json` under `mcpServers`:

```json
"mcpServers": {
  "weave": {
    "command": "weave-mcp",
    "env": {
      "WEAVE_BASE_URL": "http://localhost:8000",
      "WEAVE_PROJECT_ID": "demo"
    }
  }
}
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `WEAVE_BASE_URL` | `http://localhost:8000` | Base URL of the Weave FastAPI backend |
| `WEAVE_PROJECT_ID` | `demo` | Project to read/write by default |

## Resources exposed

| URI | Description |
|---|---|
| `weave://projects` | All saved ontology projects (JSON) |
| `weave://project/{id}/graph` | Live graph as nodes + edges (JSON) |
| `weave://project/{id}/ttl` | Latest committed snapshot as Turtle RDF |
| `weave://project/{id}/ttl/live` | Current live graph as Turtle RDF |
| `weave://project/{id}/history` | Recent mutation history (JSON) |
| `weave://project/{id}/versions` | List of named snapshots (JSON) |
| `weave://vocabulary` | Node kinds and relationship types (JSON) |

## Tools exposed

| Tool | Description |
|---|---|
| `weave_propose` | Ask the LLM to propose graph mutations from a natural-language prompt |
| `weave_apply` | Apply a reviewed list of operations (SHACL-validated before write) |
| `weave_commit` | Commit the current graph as a named version snapshot |
| `weave_sparql` | Run a read-only SPARQL SELECT query against the ontology |

## Note on end-to-end verification

Structural correctness and unit tests can be verified offline (see `tests/`).
Full end-to-end verification requires both a running Weave backend (`uvicorn app.main:app`)
and an MCP-capable client (e.g. Claude Code with the mcpServers entry above).
