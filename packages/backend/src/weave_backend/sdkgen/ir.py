"""BE-SDK-1 (TASK-004) intermediate representation -- ADR-006 SS2, "one IR,
three emitters". Every SHACL/JSON-Schema mapping decision lives here, in
the ``map_*`` pure functions; the Jinja2 emitters only interpolate the
resulting ``SdkModel``.

Determinism (AC-1): ``rdflib`` graph traversal (``graph.subjects``,
``graph.objects``) is *not* order-stable across runs. ``map_shapes`` sorts
node-shape IRIs, ``map_shape`` sorts a shape's properties by ``sh:path``,
and ``sh:or``/``sh:in`` are read as RDF Lists via
``rdflib.collection.Collection`` (ordered, unlike ``graph.objects``) --
without this, byte-identical golden-file output would be a coin flip.
"""

from __future__ import annotations

from pydantic import BaseModel
from rdflib import Graph
from rdflib.collection import Collection
from rdflib.namespace import RDF, SH
from rdflib.term import Node

from weave_backend.sdkgen.errors import UnmappableConstraint

#: Mapping table (task brief, IR core section) -- XSD local name -> (TS, Python).
_DATATYPE_MAP: dict[str, tuple[str, str]] = {
    "string": ("string", "str"),
    "int": ("number", "int"),
    "integer": ("number", "int"),
    "boolean": ("boolean", "bool"),
    "dateTime": ("string", "datetime"),
    "decimal": ("number", "Decimal"),
    "double": ("number", "float"),
    "date": ("string", "date"),
    "anyURI": ("string", "AnyUrl"),
}

_JSON_SCHEMA_TYPE_MAP: dict[str, tuple[str, str]] = {
    "string": ("string", "str"),
    "integer": ("number", "int"),
    "number": ("number", "float"),
    "boolean": ("boolean", "bool"),
}

_CORE_TOKEN_KEYS = ("color", "typography", "spacing", "radius")


class IRField(BaseModel):
    name: str
    path: str
    ts_type: str
    py_type: str
    optional: bool
    is_list: bool
    min_length: int | None = None
    pattern: str | None = None


class IRClass(BaseModel):
    name: str
    iri: str
    fields: list[IRField]


class IRParam(BaseModel):
    name: str
    ts_type: str
    py_type: str
    required: bool


class IRFunction(BaseModel):
    name: str
    fn_iri: str
    params: list[IRParam]
    return_ts: str
    return_py: str


class IRQuery(BaseModel):
    name: str
    sparql: str
    bindings: list[str]


class IRTheme(BaseModel):
    color: dict[str, object]
    typography: dict[str, object]
    spacing: dict[str, object]
    radius: dict[str, object]
    #: AC-5: everything outside the closed core, passed through untyped.
    extensions: dict[str, object]


class CeVersionPin(BaseModel):
    version_iri: str


class SdkModel(BaseModel):
    classes: list[IRClass]
    functions: list[IRFunction]
    queries: list[IRQuery]
    theme: IRTheme
    pin: CeVersionPin


def _local_name(iri: str) -> str:
    if "#" in iri:
        return iri.rsplit("#", 1)[-1]
    return iri.rstrip("/").rsplit("/", 1)[-1]


def _resolve_ref_type(node: Node) -> str:
    """``sh:class`` points at the RDFS/OWL class directly; ``sh:node``
    points at a ``NodeShape`` (conventionally named ``<Class>Shape``).
    Both resolve to the same generated class name.
    """
    name = _local_name(str(node))
    return name[:-5] if name.endswith("Shape") else name


def _constraint_base_type(graph: Graph, shape_name: str, node: Node) -> tuple[str, str]:
    """Resolves the bare (cardinality-unwrapped) TS/Python type for a
    property shape or an ``sh:or`` member -- the "anything else raises"
    branch is AC-3's whole contract, so this stays a flat if/elif chain
    with one named exception at the end, not a silent fallback.
    """
    datatype = graph.value(node, SH.datatype)
    if datatype is not None:
        local = _local_name(str(datatype))
        if local not in _DATATYPE_MAP:
            raise UnmappableConstraint(shape_name, f"sh:datatype {datatype}")
        return _DATATYPE_MAP[local]
    sh_class = graph.value(node, SH["class"])
    if sh_class is not None:
        ref = _resolve_ref_type(sh_class)
        return ref, ref
    sh_node = graph.value(node, SH.node)
    if sh_node is not None:
        ref = _resolve_ref_type(sh_node)
        return ref, ref
    sh_or = graph.value(node, SH["or"])
    if sh_or is not None:
        members = list(Collection(graph, sh_or))
        parts = [_constraint_base_type(graph, shape_name, m) for m in members]
        return " | ".join(p[0] for p in parts), " | ".join(p[1] for p in parts)
    sh_in = graph.value(node, SH["in"])
    if sh_in is not None:
        values = [str(v) for v in Collection(graph, sh_in)]
        return (
            " | ".join(f"'{v}'" for v in values),
            "Literal[{}]".format(", ".join(f"'{v}'" for v in values)),
        )
    if graph.value(node, SH.pattern) is not None:
        return "string", "str"
    raise UnmappableConstraint(
        shape_name, "no sh:datatype/sh:class/sh:node/sh:or/sh:in/sh:pattern"
    )


def _map_property(graph: Graph, shape_name: str, prop_node: Node) -> IRField:
    path = graph.value(prop_node, SH.path)
    if path is None:
        raise UnmappableConstraint(shape_name, "sh:property with no sh:path")
    path_str = str(path)
    min_count = graph.value(prop_node, SH.minCount)
    max_count = graph.value(prop_node, SH.maxCount)
    min_count_i = int(str(min_count)) if min_count is not None else None
    max_count_i = int(str(max_count)) if max_count is not None else None
    ts_type, py_type = _constraint_base_type(graph, shape_name, prop_node)
    pattern = graph.value(prop_node, SH.pattern)

    if max_count_i == 1:
        is_list = False
        optional = min_count_i is None or min_count_i == 0
        min_length = None
    else:
        is_list = True
        optional = False
        min_length = 1 if (min_count_i is not None and min_count_i >= 1) else None

    return IRField(
        name=_local_name(path_str),
        path=path_str,
        ts_type=ts_type,
        py_type=py_type,
        optional=optional,
        is_list=is_list,
        min_length=min_length,
        pattern=str(pattern) if pattern is not None else None,
    )


def map_shape(graph: Graph, shape_iri: Node) -> IRClass:
    """AC-2: one ``sh:NodeShape`` -> one typed IR class, named for its
    ``sh:targetClass`` (not the shape node itself).
    """
    shape_name = _local_name(str(shape_iri))
    target_class = graph.value(shape_iri, SH.targetClass)
    if target_class is None:
        raise UnmappableConstraint(shape_name, "sh:NodeShape with no sh:targetClass")
    prop_nodes = sorted(
        graph.objects(shape_iri, SH.property),
        key=lambda n: str(graph.value(n, SH.path) or ""),
    )
    fields = [_map_property(graph, shape_name, p) for p in prop_nodes]
    return IRClass(name=_local_name(str(target_class)), iri=str(target_class), fields=fields)


def map_shapes(turtle_text: str) -> list[IRClass]:
    """Parses a pinned SHACL shapes document and maps every ``sh:NodeShape``
    to an :class:`IRClass`, in stable IRI-sorted order (AC-1).
    """
    graph = Graph()
    graph.parse(data=turtle_text, format="turtle")
    shape_iris = sorted(set(graph.subjects(RDF.type, SH.NodeShape)), key=str)
    return [map_shape(graph, s) for s in shape_iris]


def _json_schema_type(schema: dict[str, object]) -> tuple[str, str]:
    kind = schema.get("type")
    if isinstance(kind, str) and kind in _JSON_SCHEMA_TYPE_MAP:
        return _JSON_SCHEMA_TYPE_MAP[kind]
    if kind == "array":
        items = schema.get("items")
        if isinstance(items, dict):
            item_ts, item_py = _json_schema_type(items)
        else:
            item_ts, item_py = "unknown", "object"
        return f"{item_ts}[]", f"list[{item_py}]"
    # ponytail: function bodies raise NotExecutableUntilPostV1 (CE ADR-009,
    # execution is post-v1) -- an untyped object/unknown fallback here is
    # honest (no unmappable-constraint error needed) because nothing ever
    # runs against this type; upgrade to full JSON-Schema object mapping
    # when function *execution* lands post-v1.
    return "unknown", "object"


def map_fn(fn_schema: dict[str, object]) -> IRFunction:
    """AC-4: one typed method per ``CE-FUNCTION-1`` function, from its
    derived JSON-Schema parameter/return projection.
    """
    parameters = fn_schema.get("parameters")
    properties = parameters.get("properties", {}) if isinstance(parameters, dict) else {}
    required = set(parameters.get("required", [])) if isinstance(parameters, dict) else set()
    # Required params sorted before optional ones: both TS and Python
    # function signatures reject an optional/default parameter before a
    # required one, so this ordering is a syntax requirement, not a style
    # choice -- alphabetical within each group keeps it deterministic (AC-1).
    ordered_names = sorted(properties, key=lambda p: (p not in required, p))
    params = [
        IRParam(
            name=pname,
            ts_type=(t := _json_schema_type(properties[pname]))[0],
            py_type=t[1],
            required=pname in required,
        )
        for pname in ordered_names
    ]
    returns = fn_schema.get("returns")
    return_ts, return_py = _json_schema_type(returns) if isinstance(returns, dict) else (
        "unknown",
        "object",
    )
    return IRFunction(
        name=str(fn_schema["name"]),
        fn_iri=str(fn_schema["fn_iri"]),
        params=params,
        return_ts=return_ts,
        return_py=return_py,
    )


def map_select(select: dict[str, object]) -> IRQuery:
    """AC-8: one typed query method per pinned named SPARQL SELECT."""
    bindings_raw = select.get("bindings", [])
    bindings = [str(b) for b in bindings_raw] if isinstance(bindings_raw, list) else []
    return IRQuery(name=str(select["name"]), sparql=str(select["sparql"]), bindings=bindings)


def map_core_tokens(tokens: dict[str, object]) -> IRTheme:
    """AC-5: type the CE-BRAND-1 closed core (``color``/``typography``/
    ``spacing``/``radius``) only; everything else passes through
    ``extensions`` untyped.
    """
    core: dict[str, dict[str, object]] = {}
    for key in _CORE_TOKEN_KEYS:
        value = tokens.get(key, {})
        core[key] = value if isinstance(value, dict) else {}
    extensions = {k: v for k, v in tokens.items() if k not in _CORE_TOKEN_KEYS}
    return IRTheme(
        color=core["color"],
        typography=core["typography"],
        spacing=core["spacing"],
        radius=core["radius"],
        extensions=extensions,
    )
