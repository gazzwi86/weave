"""Pydantic request/response models for the API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class NodeIn(BaseModel):
    """Payload to create or update a node."""

    label: str = Field(..., min_length=1, description="Human-readable name.")
    # Optional so a PATCH can omit it (partial update) without resetting the
    # kind; on create the store defaults it to the standard kind.
    kind: str | None = Field(None, description="One of the registered node kinds.")
    comment: str | None = Field(None, description="Description / definition.")
    note: str | None = Field(None, description="Free-form note.")
    color: str | None = Field(None, description="Optional hex colour override.")
    domain: str | None = Field(None, description="Business domain node id.")
    capability: str | None = Field(None, description="Business capability node id.")
    # Capability maturity / EA properties
    maturity: str | None = Field(None, description="Maturity level (1–5).")
    target_maturity: str | None = Field(None, description="Target maturity level (1–5).")
    strategic_importance: str | None = Field(
        None, description="Commodity | Differentiation | Innovation"
    )
    investment_level: str | None = Field(None, description="High | Medium | Low | None")
    lifecycle_status: str | None = Field(
        None, description="Plan | Phase In | Active | Phase Out | End of Life"
    )
    capability_owner: str | None = Field(None, description="Owner name or team.")
    x: float | None = None
    y: float | None = None


class NodeOut(BaseModel):
    id: str
    label: str
    kind: str
    color: str
    comment: str | None = None
    note: str | None = None
    domain: str | None = None
    capability: str | None = None
    maturity: str | None = None
    target_maturity: str | None = None
    strategic_importance: str | None = None
    investment_level: str | None = None
    lifecycle_status: str | None = None
    capability_owner: str | None = None
    x: float | None = None
    y: float | None = None


class EdgeIn(BaseModel):
    """Payload to create a labelled relationship."""

    source: str = Field(..., description="Source node id.")
    target: str = Field(..., description="Target node id.")
    type: str = Field(..., description="Relationship type key, e.g. 'dependsOn'.")
    comment: str | None = None
    note: str | None = None


class EdgeRef(BaseModel):
    """Identifies an edge for deletion."""

    source: str
    target: str
    type: str


class EdgeOut(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str
    comment: str | None = None
    note: str | None = None


class GraphOut(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]


class RelationshipType(BaseModel):
    key: str
    iri: str
    label: str


class NodeKind(BaseModel):
    key: str
    iri: str
    color: str


class Rule(BaseModel):
    """A human-readable if/then rule derived from the SHACL shapes."""

    id: str
    category: str
    relationship: str
    object_kind: str
    object_kind_curie: str
    severity: str
    message: str | None = None
    is_custom: bool = False


class RuleIn(BaseModel):
    """Payload to create a new custom rule."""

    relationship: str = Field(..., description="Relationship type key, e.g. 'dependsOn'.")
    object_kind: str = Field(..., description="Target node kind key, e.g. 'Concept'.")
    severity: str = Field("Violation", description="sh:Violation | sh:Warning | sh:Info")
    message: str | None = Field(None, description="Human-readable rule message.")


class TurtleIn(BaseModel):
    turtle: str


class LLMMutateIn(BaseModel):
    prompt: str = Field(..., min_length=1)
    apply: bool = Field(True, description="Apply changes, or just preview them.")


class MutationOp(BaseModel):
    """A single graph change proposed by the LLM (or applied)."""

    op: str  # add_node | update_node | add_edge | delete_node | delete_edge
    summary: str
    detail: dict = Field(default_factory=dict)


class LLMMutateOut(BaseModel):
    message: str
    applied: bool
    operations: list[MutationOp]
    graph: GraphOut | None = None


class LLMProposeIn(BaseModel):
    prompt: str = Field(..., min_length=1)


class LLMProposeOut(BaseModel):
    """A reviewable proposal of changes the LLM would make (nothing applied)."""

    message: str
    operations: list[dict[str, Any]] = Field(default_factory=list)


class OperationsApplyIn(BaseModel):
    """A human-approved batch of operations to apply to the graph."""

    operations: list[dict[str, Any]] = Field(default_factory=list)


class OperationsApplyOut(BaseModel):
    applied: bool
    operations: list[MutationOp]
    graph: GraphOut | None = None


class ProjectIn(BaseModel):
    """Payload to create a project (saved ontology)."""

    name: str = Field(..., min_length=1)
    description: str = ""
    seed: str = Field("empty", description="empty | demo | turtle")
    turtle: str | None = Field(None, description="Initial Turtle when seed='turtle'.")


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str = ""
    created: str
    is_demo: bool = False
    node_count: int = 0
    edge_count: int = 0


class SchemaImportIn(BaseModel):
    """Payload to import a data schema as DataAsset/Field nodes."""

    name: str = Field(..., min_length=1, description="Name for the data asset.")
    format: str = Field("csv", description="csv | json_schema")
    content: str = Field(..., min_length=1, description="Raw schema text.")
    concept: str | None = Field(None, description="Optional concept node id to link.")


class GlossaryTerm(BaseModel):
    id: str
    label: str
    definition: str | None = None
    related: list[str] = Field(default_factory=list)


class SparqlIn(BaseModel):
    """A read-only SPARQL SELECT query."""

    query: str = Field(..., min_length=1, description="SPARQL SELECT query string.")


class SparqlOut(BaseModel):
    """Tabular results from a SPARQL SELECT query."""

    columns: list[str]
    rows: list[dict]
    generated_sparql: str | None = None


class SparqlNlIn(BaseModel):
    """Natural language question to translate to SPARQL and execute."""

    question: str = Field(..., min_length=1, description="Natural-language question.")


class InventoryItem(BaseModel):
    id: str
    label: str
    kind: str
    comment: str | None = None
    domain: str | None = None
    capability: str | None = None
    depends_on: list[str] = Field(default_factory=list)


class HistoryEvent(BaseModel):
    id: str
    timestamp: str
    agent: str
    summary: str
    operations: list[dict] = Field(default_factory=list)


class LLMSettingsOut(BaseModel):
    provider: str  # "anthropic" | "ollama"
    model: str  # current effective model
    ollama_url: str  # current ollama URL (may be "")
    anthropic_configured: bool  # True if ANTHROPIC_API_KEY is set


class LLMSettingsIn(BaseModel):
    provider: str | None = None
    model: str | None = None
    ollama_url: str | None = None


class OllamaModel(BaseModel):
    name: str
    size: int | None = None
    modified_at: str | None = None


class SnapshotIn(BaseModel):
    label: str = Field(
        ..., min_length=1, description="Short version label, e.g. 'v1.0 — Initial taxonomy'."
    )
    description: str = ""


class SnapshotOut(BaseModel):
    id: str
    label: str
    description: str = ""
    created: str
    node_count: int = 0
    edge_count: int = 0
    status: str = "draft"  # draft | released | deprecated
