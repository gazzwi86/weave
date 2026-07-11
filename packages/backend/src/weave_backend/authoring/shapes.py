"""TASK-005 AC-005-01/-05/-07: natural-language governance rule -> candidate
SHACL shape, via `ai/providers.py`'s plain-text `complete()` (JSON+Pydantic
output, not native tool-calling) -- mirrors `authoring/nl_parser.py`. Also
the raw-SHACL editing path (AC-005-05): always available, independent of
the AI, for a rule the model can't produce or a human wants to hand-write.

Neither function here commits anything -- see `operations/governance_shapes.py`
(ADR-024) for the sole writer to the tenant shapes graph.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from rdflib import RDF, Graph, Namespace, URIRef
from rdflib import Literal as RdfLiteral
from rdflib.exceptions import ParserError
from rdflib.namespace import SH, XSD
from rdflib.term import BNode, Node

from weave_backend.ai.providers import ModelProvider
from weave_backend.ai.router import route
from weave_backend.authoring.bpmo import BPMO_KINDS, InvalidBpmoKindError, validate_kind
from weave_backend.ontology.catalogue import list_kinds

WEAVE = Namespace("https://weave.io/ontology/")
INSTANCES = Namespace("https://weave.io/instances/")

_TIER = "sonnet"

# Same failure mode nl_parser.py already handles: local/small models wrap
# JSON in markdown fences even when told not to.
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)

_DATATYPE_IRIS = {
    "string": XSD.string,
    "integer": XSD.integer,
    "boolean": XSD.boolean,
    "dateTime": XSD.dateTime,
}


class ShapeGenerationError(Exception):
    """Raised when a candidate shape -- AI-generated or raw-Turtle -- isn't
    safe to preview or commit: invalid JSON/Turtle, an unknown BPMO kind, a
    predicate outside the ontology, or a shape with no target. The caller
    must surface this to the compliance officer and must not commit
    anything (AC-005-05).
    """


class _CandidateShapeProperty(BaseModel):
    path: str = Field(min_length=1)
    min_count: int | None = Field(default=None, ge=0)
    max_count: int | None = Field(default=None, ge=0)
    datatype: Literal["string", "integer", "boolean", "dateTime"] | None = None
    severity: Literal["Violation", "Warning", "Info"] = "Violation"
    message: str = Field(min_length=1)


class _CandidateShape(BaseModel):
    target_class: str = Field(min_length=1)
    properties: list[_CandidateShapeProperty] = Field(min_length=1)


def _known_predicate_local_names() -> frozenset[str]:
    names = set()
    for kind in list_kinds():
        for prop in kind.properties:
            names.add(prop.path.rsplit("#", 1)[-1].rsplit("/", 1)[-1])
    return frozenset(names)


def _build_prompt(text: str, known_predicates: frozenset[str]) -> str:
    return json.dumps(
        {
            "instruction": (
                'Translate the compliance officer\'s rule into {"target_class": '
                '"<BPMO kind>", "properties": [...]} where each property is '
                '{"path": "<known predicate>", "min_count": <int|null>, '
                '"max_count": <int|null>, "datatype": "<string|integer|boolean|'
                'dateTime|null>", "severity": "Violation|Warning|Info", '
                '"message": "<human-readable violation message>"}. '
                "target_class must be exactly one of the listed BPMO kinds; "
                "each property path must be exactly one of the listed known "
                "predicates. Return only the JSON object, no markdown fences."
            ),
            "bpmo_kinds": sorted(BPMO_KINDS),
            "known_predicates": sorted(known_predicates),
            "rule": text,
        }
    )


def _property_node(graph: Graph, prop: _CandidateShapeProperty) -> BNode:
    node = BNode()
    graph.add((node, SH.path, WEAVE[prop.path]))
    if prop.min_count is not None:
        graph.add((node, SH.minCount, RdfLiteral(prop.min_count)))
    if prop.max_count is not None:
        graph.add((node, SH.maxCount, RdfLiteral(prop.max_count)))
    if prop.datatype is not None:
        graph.add((node, SH.datatype, _DATATYPE_IRIS[prop.datatype]))
    graph.add((node, SH.severity, SH[prop.severity]))
    graph.add((node, SH.message, RdfLiteral(prop.message)))
    return node


def _shape_graph_from_candidate(candidate: _CandidateShape) -> Graph:
    graph = Graph()
    shape_iri = INSTANCES[f"shape-{uuid.uuid4().hex}"]
    graph.add((shape_iri, RDF.type, SH.NodeShape))
    graph.add((shape_iri, SH.targetClass, WEAVE[candidate.target_class]))
    for prop in candidate.properties:
        graph.add((shape_iri, SH.property, _property_node(graph, prop)))
    return graph


def generate_candidate_shape(text: str, *, provider: ModelProvider | None = None) -> Graph:
    """Parses `text` into a candidate `sh:NodeShape` Graph, ready for human
    preview -- never committed here. Raises `ShapeGenerationError` on any
    output that isn't safe to preview/commit as-is.
    """
    known_predicates = _known_predicate_local_names()
    raw = route(_TIER, _build_prompt(text, known_predicates), provider=provider)

    try:
        payload = json.loads(_FENCE_RE.sub("", raw).strip())
    except json.JSONDecodeError as exc:
        raise ShapeGenerationError("model did not return valid JSON") from exc

    try:
        candidate = _CandidateShape.model_validate(payload)
    except ValidationError as exc:
        raise ShapeGenerationError("model output failed candidate-shape schema") from exc

    try:
        validate_kind(candidate.target_class)
    except InvalidBpmoKindError as exc:
        raise ShapeGenerationError(str(exc)) from exc

    for prop in candidate.properties:
        if prop.path not in known_predicates:
            raise ShapeGenerationError(f"unknown predicate: {prop.path!r}")

    return _shape_graph_from_candidate(candidate)


def parse_raw_shape(turtle_text: str) -> Graph:
    """AC-005-05: the raw-SHACL editing path -- always available, whether
    or not the AI produced a usable candidate. Syntax-validates (pyshacl-
    parseable Turtle), then applies the same known-kind/known-predicate
    gate `generate_candidate_shape` applies to AI output, so a hand-written
    shape can't reference a nonexistent BPMO kind or predicate either.
    """
    graph = Graph()
    try:
        graph.parse(data=turtle_text, format="turtle")
    except (ParserError, SyntaxError, ValueError) as exc:
        raise ShapeGenerationError("invalid Turtle/SHACL syntax") from exc

    known_predicates = _known_predicate_local_names()
    shape_subjects = set(graph.subjects(RDF.type, SH.NodeShape))
    if not shape_subjects:
        raise ShapeGenerationError("no sh:NodeShape found")

    for shape in shape_subjects:
        _validate_shape_target(graph, shape)

    for prop_node in graph.objects(None, SH.property):
        _validate_property_path(graph, prop_node, known_predicates)

    return graph


def _validate_shape_target(graph: Graph, shape: Node) -> None:
    has_target = (shape, SH.targetClass, None) in graph or (
        shape,
        SH.targetSubjectsOf,
        None,
    ) in graph
    if not has_target:
        raise ShapeGenerationError(f"shape {shape} has no sh:targetClass/sh:targetSubjectsOf")


def _validate_property_path(
    graph: Graph, prop_node: Node, known_predicates: frozenset[str]
) -> None:
    path = graph.value(prop_node, SH.path)
    if path is None:
        raise ShapeGenerationError("sh:property with no sh:path")
    local_name = str(path).rsplit("#", 1)[-1].rsplit("/", 1)[-1]
    if local_name not in known_predicates:
        raise ShapeGenerationError(f"unknown predicate: {local_name!r}")


def shape_subject_iri(graph: Graph) -> str:
    """The top-level `sh:NodeShape` subject's IRI -- must be a named
    resource (never a blank node), so it's referenceable in PROV-O's
    `prov:generated` (AC-005-01). Raises `ShapeGenerationError` if the
    shape has no such named subject.
    """
    for shape in graph.subjects(RDF.type, SH.NodeShape):
        if isinstance(shape, URIRef):
            return str(shape)
    raise ShapeGenerationError("shape has no named (non-blank) sh:NodeShape subject")
