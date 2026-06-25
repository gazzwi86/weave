"""REST routes. Thin controllers over OntologyStore and LLMService."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .. import namespaces as ns
from ..config import Settings, get_settings
from ..ingest import import_schema
from ..llm import LLMService, apply_operations
from ..llm.ollama import OllamaService
from ..models import (
    EdgeIn,
    EdgeRef,
    GlossaryTerm,
    GraphOut,
    HistoryEvent,
    InventoryItem,
    LLMMutateIn,
    LLMMutateOut,
    LLMProposeIn,
    LLMProposeOut,
    LLMSettingsIn,
    LLMSettingsOut,
    NodeIn,
    NodeKind,
    OllamaModel,
    OperationsApplyIn,
    OperationsApplyOut,
    ProjectIn,
    ProjectOut,
    ProjectUpdate,
    RelationshipType,
    Rule,
    RuleIn,
    SchemaImportIn,
    SnapshotIn,
    SnapshotOut,
    SparqlIn,
    SparqlNlIn,
    SparqlOut,
    TurtleIn,
)
from ..ontology import OntologyStore
from ..projects import ProjectManager
from ..validation import add_rule, list_rules, remove_rule, schema_rules, validate_turtle
from .settings_store import get_runtime, update_runtime

router = APIRouter(prefix="/api")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# --- LLM settings ------------------------------------------------------------


@router.get("/settings/llm", response_model=LLMSettingsOut)
def get_llm_settings(settings: Settings = Depends(get_settings)) -> LLMSettingsOut:
    """Return the current effective LLM provider and model."""
    rt = get_runtime()
    using_ollama = bool(rt.ollama_url or settings.ollama_url)
    provider = rt.provider or ("ollama" if using_ollama else "anthropic")
    model = rt.model or (settings.ollama_model if using_ollama else settings.llm_model)
    return LLMSettingsOut(
        provider=provider,
        model=model,
        ollama_url=rt.ollama_url or settings.ollama_url,
        anthropic_configured=bool(settings.anthropic_api_key),
    )


@router.patch("/settings/llm", response_model=LLMSettingsOut)
def update_llm_settings(
    body: LLMSettingsIn,
    settings: Settings = Depends(get_settings),
) -> LLMSettingsOut:
    """Update runtime LLM provider / model without restarting the server."""
    rt = update_runtime(body.provider, body.model, body.ollama_url)
    using_ollama = rt.provider == "ollama" or bool(rt.ollama_url or settings.ollama_url)
    model = rt.model or (settings.ollama_model if using_ollama else settings.llm_model)
    return LLMSettingsOut(
        provider=rt.provider,
        model=model,
        ollama_url=rt.ollama_url or settings.ollama_url,
        anthropic_configured=bool(settings.anthropic_api_key),
    )


@router.get("/settings/llm/models", response_model=list[OllamaModel])
def list_ollama_models(settings: Settings = Depends(get_settings)) -> list[OllamaModel]:
    """Fetch the list of locally installed Ollama models (empty when Ollama is not running)."""
    import urllib.request

    rt = get_runtime()
    url = rt.ollama_url or settings.ollama_url or "http://localhost:11434"
    try:
        req = urllib.request.Request(f"{url}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:  # noqa: S310
            data = json.loads(resp.read())
        return [
            OllamaModel(name=m["name"], size=m.get("size"), modified_at=m.get("modified_at"))
            for m in data.get("models", [])
        ]
    except Exception:  # noqa: BLE001
        return []


def _get_llm_service(settings: Settings) -> LLMService | OllamaService:
    """Return an Ollama or Anthropic LLM service based on config + runtime overrides."""
    rt = get_runtime()
    ollama_url = rt.ollama_url or settings.ollama_url
    if rt.provider == "ollama" or ollama_url:
        url = ollama_url or "http://localhost:11434"
        model = rt.model or settings.ollama_model
        return OllamaService(url, model, settings.ollama_context_window)
    model = rt.model or settings.llm_model
    return LLMService(settings.anthropic_api_key, model)


def get_manager(request: Request) -> ProjectManager:
    return request.app.state.manager


def get_store(request: Request, project_id: str = "demo") -> OntologyStore:
    """Resolve the store for the selected project (defaults to the demo).

    Because this is a dependency, every data route transparently gains a
    `?project_id=` query parameter for selecting which saved ontology to act on.
    """
    try:
        return request.app.state.manager.get_store(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}") from exc


# --- Projects ----------------------------------------------------------------


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(manager: ProjectManager = Depends(get_manager)) -> list[ProjectOut]:
    return [ProjectOut(**p) for p in manager.list()]


@router.post("/projects", status_code=201, response_model=ProjectOut)
def create_project(body: ProjectIn, manager: ProjectManager = Depends(get_manager)) -> ProjectOut:
    return ProjectOut(**manager.create(body.name, body.description, body.seed, body.turtle))


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str, body: ProjectUpdate, manager: ProjectManager = Depends(get_manager)
) -> ProjectOut:
    try:
        return ProjectOut(**manager.update(project_id, body.name, body.description))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, manager: ProjectManager = Depends(get_manager)) -> Response:
    try:
        manager.delete(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(status_code=204)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/graph", response_model=GraphOut)
def get_graph(store: OntologyStore = Depends(get_store)) -> GraphOut:
    return GraphOut(**store.graph())


@router.get("/relationship-types", response_model=list[RelationshipType])
def relationship_types() -> list[RelationshipType]:
    return [RelationshipType(**r) for r in ns.RELATIONSHIP_TYPES]


@router.get("/node-kinds", response_model=list[NodeKind])
def node_kinds() -> list[NodeKind]:
    return [NodeKind(**k) for k in ns.NODE_KINDS]


@router.get("/rules", response_model=list[Rule])
def rules() -> list[Rule]:
    """The if/then constraint rules that govern the graph (SHACL shapes + custom rules)."""
    all_rules = list(schema_rules()) + list_rules()
    return [Rule(**r) for r in all_rules]


@router.post("/rules", status_code=201, response_model=Rule)
def create_rule(body: RuleIn) -> Rule:
    """Add a custom constraint rule."""
    try:
        record = add_rule(body.relationship, body.object_kind, body.severity, body.message)
        return Rule(**record)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str) -> Response:
    """Remove a custom rule. Static SHACL rules cannot be deleted."""
    if not remove_rule(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found or is a static shape rule.")
    return Response(status_code=204)


@router.get("/ontology/ttl")
def export_ttl(store: OntologyStore = Depends(get_store)) -> Response:
    return Response(content=store.export_turtle(), media_type="text/turtle")


@router.post("/ontology/ttl", response_model=GraphOut)
def import_ttl(body: TurtleIn, store: OntologyStore = Depends(get_store)) -> GraphOut:
    try:
        store.import_turtle(body.turtle)
    except Exception as exc:  # noqa: BLE001 - surface parse errors to the client
        raise HTTPException(status_code=400, detail=f"Invalid Turtle: {exc}") from exc
    return GraphOut(**store.graph())


@router.post("/schema/import", response_model=GraphOut)
def import_schema_route(
    body: SchemaImportIn, store: OntologyStore = Depends(get_store)
) -> GraphOut:
    try:
        import_schema(store, body.name, body.format, body.content, body.concept)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not import schema: {exc}") from exc
    return GraphOut(**store.graph())


@router.post("/nodes", status_code=201)
def create_node(body: NodeIn, store: OntologyStore = Depends(get_store)) -> dict[str, str]:
    node_id = store.add_node(body.model_dump())
    store.record_history_event(
        "user",
        [{"op": "add_node", "summary": f"Added node '{body.label}'", "detail": {"id": node_id}}],
        _now_iso(),
    )
    return {"id": node_id}


@router.patch("/nodes")
def update_node(
    node_id: str, body: NodeIn, store: OntologyStore = Depends(get_store)
) -> dict[str, str]:
    store.update_node(node_id, body.model_dump(exclude_unset=True))
    store.record_history_event(
        "user",
        [{"op": "update_node", "summary": f"Updated '{body.label or node_id}'",
          "detail": {"id": node_id}}],
        _now_iso(),
    )
    return {"id": node_id}


@router.delete("/nodes", status_code=204)
def delete_node(node_id: str, store: OntologyStore = Depends(get_store)) -> Response:
    store.delete_node(node_id)
    store.record_history_event(
        "user",
        [{"op": "delete_node", "summary": f"Deleted {ns.local_name(node_id)}",
          "detail": {"id": node_id}}],
        _now_iso(),
    )
    return Response(status_code=204)


@router.post("/edges", status_code=201)
def create_edge(body: EdgeIn, store: OntologyStore = Depends(get_store)) -> dict[str, str]:
    try:
        edge_id = store.add_edge(body.model_dump())
        store.record_history_event(
            "user",
            [{"op": "add_edge", "summary": f"Added {body.type} edge",
              "detail": {"source": body.source, "target": body.target}}],
            _now_iso(),
        )
        return {"id": edge_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.api_route("/edges", methods=["DELETE"], status_code=204)
@router.post("/edges/delete", status_code=204)
def delete_edge(body: EdgeRef, store: OntologyStore = Depends(get_store)) -> Response:
    try:
        store.delete_edge(body.source, body.target, body.type)
        store.record_history_event(
            "user",
            [{"op": "delete_edge", "summary": f"Removed {body.type} edge",
              "detail": {"source": body.source, "target": body.target}}],
            _now_iso(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(status_code=204)


@router.get("/glossary", response_model=list[GlossaryTerm])
def glossary(store: OntologyStore = Depends(get_store)) -> list[GlossaryTerm]:
    return [GlossaryTerm(**t) for t in store.glossary()]


@router.get("/inventory", response_model=list[InventoryItem])
def inventory(store: OntologyStore = Depends(get_store)) -> list[InventoryItem]:
    return [InventoryItem(**i) for i in store.inventory()]


@router.post("/llm/mutate", response_model=LLMMutateOut)
def llm_mutate(
    body: LLMMutateIn,
    store: OntologyStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> LLMMutateOut:
    try:
        service = _get_llm_service(settings)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    message, operations = service.propose(body.prompt, store.graph())
    if body.apply:
        applied = apply_operations(store, operations)
        if applied:
            store.record_history_event("llm", applied, datetime.now(UTC).isoformat())
        return LLMMutateOut(
            message=message,
            applied=bool(applied),
            operations=applied,
            graph=GraphOut(**store.graph()),
        )
    preview = [{"op": o.get("op", "?"), "summary": "(preview)", "detail": o} for o in operations]
    return LLMMutateOut(message=message, applied=False, operations=preview, graph=None)


@router.post("/llm/propose", response_model=LLMProposeOut)
def llm_propose(
    body: LLMProposeIn,
    store: OntologyStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> LLMProposeOut:
    """Ask the LLM for changes WITHOUT applying them — the staged review step."""
    try:
        service = _get_llm_service(settings)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    message, operations = service.propose(body.prompt, store.graph())
    return LLMProposeOut(message=message, operations=operations)


def _validate_prospective(store: OntologyStore, operations: list[dict]) -> list[dict]:
    """Apply the batch to a throwaway copy and SHACL-validate the result, so a
    failing batch never touches the real graph."""
    scratch = OntologyStore(seed=False)
    scratch.import_turtle(store.export_turtle())
    apply_operations(scratch, operations)
    return validate_turtle(scratch.export_turtle())


@router.get("/validate")
def validate_project(store: OntologyStore = Depends(get_store)) -> dict:
    return {"violations": validate_turtle(store.export_turtle())}


@router.post("/sparql", response_model=SparqlOut)
def sparql_query(body: SparqlIn, store: OntologyStore = Depends(get_store)) -> SparqlOut:
    """Run a read-only SPARQL SELECT query against the project graph."""
    try:
        result = store.sparql_select(ns.SPARQL_PREFIXES + "\n" + body.query)
        return SparqlOut(**result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Query error: {exc}") from exc


def _build_nl_sparql_system() -> str:
    """Build the NL→SPARQL system prompt from the live namespaces registry."""
    kinds = ", ".join(f"weave:{k['key']}" for k in ns.NODE_KINDS)
    rels = "\n".join(
        f"  weave:{r['key']} (rdfs:label: \"{r['label']}\")" for r in ns.RELATIONSHIP_TYPES
    )
    return f"""You are an expert SPARQL query generator for a Weave knowledge graph ontology.

PREFIXES (always include relevant ones in your output):
{ns.SPARQL_PREFIXES}

NODE KINDS (values for rdf:type):
{kinds}

RELATIONSHIP PREDICATES (for edges between nodes):
{rels}

KEY ANNOTATION PREDICATES:
  rdfs:label   — human-readable node name
  rdfs:comment — description or definition
  weave:inDomain       — node's business domain (→ weave:BusinessDomain)
  weave:hasCapability  — node's capability (→ weave:BusinessCapability)
  weave:maturity       — capability maturity level (1–5)
  weave:strategicImportance — Commodity | Differentiation | Innovation
  weave:investmentLevel     — High | Medium | Low | None
  weave:lifecycleStatus     — Plan | Phase In | Active | Phase Out | End of Life

RULES:
- Output a SPARQL SELECT query ONLY. No explanation, no markdown code fences.
- Always include PREFIX declarations for namespaces you use.
- Use OPTIONAL for properties that may be absent.
- Include a LIMIT clause (max 200) unless the user asks for all results.
- For counting use SELECT (COUNT(?x) AS ?count).

EXAMPLES:
Q: Which systems depend on the Billing service?
A: SELECT ?sys ?label WHERE {{
  ?sys a weave:System ; rdfs:label ?label .
  ?billing rdfs:label "Billing" .
  ?sys weave:dependsOn ?billing .
}} LIMIT 50

Q: List all concepts with their definitions
A: SELECT ?concept ?label ?definition WHERE {{
  ?concept a skos:Concept ; rdfs:label ?label .
  OPTIONAL {{ ?concept rdfs:comment ?definition }}
}} ORDER BY ?label LIMIT 100

Q: How many nodes of each kind are there?
A: SELECT ?kind (COUNT(?n) AS ?count) WHERE {{
  ?n rdf:type ?kind .
  FILTER(?kind != owl:Class)
}} GROUP BY ?kind ORDER BY DESC(?count)"""


@router.post("/sparql/nl", response_model=SparqlOut)
def sparql_nl(
    body: SparqlNlIn,
    store: OntologyStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> SparqlOut:
    """Translate a natural-language question to SPARQL and execute it."""
    try:
        service = _get_llm_service(settings)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    sparql = service.generate_sparql(body.question, _build_nl_sparql_system())
    try:
        result = store.sparql_select(sparql)
        return SparqlOut(columns=result["columns"], rows=result["rows"], generated_sparql=sparql)
    except Exception as exc:
        detail = f"Generated SPARQL failed: {exc}\n\nGenerated query:\n{sparql}"
        raise HTTPException(status_code=400, detail=detail) from exc


@router.post("/operations/apply", response_model=OperationsApplyOut)
def apply_ops(
    body: OperationsApplyIn, store: OntologyStore = Depends(get_store)
) -> OperationsApplyOut:
    """Apply a human-approved batch — but only if the result passes SHACL.

    Validation runs on a copy first; on a constraint violation the real graph
    is left untouched and the violations are returned (PROV-attributed to user
    on success)."""
    violations = _validate_prospective(store, body.operations)
    blocking = [v for v in violations if v["severity"].endswith("Violation")]
    if blocking:
        detail = "; ".join(v["message"] or "constraint violation" for v in blocking)
        raise HTTPException(status_code=422, detail=f"Validation failed: {detail}")
    applied = apply_operations(store, body.operations, agent="user")
    if applied:
        store.record_history_event("user", applied, datetime.now(UTC).isoformat())
    return OperationsApplyOut(
        applied=bool(applied), operations=applied, graph=GraphOut(**store.graph())
    )


@router.get("/history", response_model=list[HistoryEvent])
def get_history(
    limit: int = 100, store: OntologyStore = Depends(get_store)
) -> list[HistoryEvent]:
    """Return the last ``limit`` mutation events for this project, newest first."""
    return [HistoryEvent(**e) for e in store.get_history(limit)]


# --- Snapshots ---------------------------------------------------------------


@router.get("/snapshots", response_model=list[SnapshotOut])
def list_snapshots(store: OntologyStore = Depends(get_store)) -> list[SnapshotOut]:
    return [SnapshotOut(**s) for s in store.list_snapshots()]


@router.post("/snapshots", status_code=201, response_model=SnapshotOut)
def create_snapshot(body: SnapshotIn, store: OntologyStore = Depends(get_store)) -> SnapshotOut:
    try:
        record = store.create_snapshot(body.label, body.description)
        return SnapshotOut(**record)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/snapshots/{snapshot_id}/ttl")
def get_snapshot_ttl(snapshot_id: str, store: OntologyStore = Depends(get_store)) -> Response:
    try:
        ttl = store.get_snapshot_ttl(snapshot_id)
        return Response(content=ttl, media_type="text/turtle")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/snapshots/{snapshot_id}/restore", response_model=GraphOut)
def restore_snapshot(snapshot_id: str, store: OntologyStore = Depends(get_store)) -> GraphOut:
    try:
        store.restore_snapshot(snapshot_id)
        return GraphOut(**store.graph())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/snapshots/{snapshot_id}/ship", response_model=SnapshotOut)
def ship_snapshot(snapshot_id: str, store: OntologyStore = Depends(get_store)) -> SnapshotOut:
    """Mark a snapshot as released; any previous released snapshot becomes deprecated."""
    try:
        record = store.ship_snapshot(snapshot_id)
        return SnapshotOut(**record)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/snapshots/{snapshot_id}/graph", response_model=GraphOut)
def get_snapshot_graph(snapshot_id: str, store: OntologyStore = Depends(get_store)) -> GraphOut:
    """Return the graph projection for a named snapshot (for diffing against live)."""
    try:
        ttl = store.get_snapshot_ttl(snapshot_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    scratch = OntologyStore(seed=False)
    scratch.import_turtle(ttl)
    return GraphOut(**scratch.graph())
