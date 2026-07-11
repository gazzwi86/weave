"""TASK-010 (E7-S4, ADR-013 M2 descope): `authority(actor, action, target)`,
`escalation(process)`, generalised `coverage_gap(kind, required_links)`, and
the FR-037 framework competency-question set -- parameterised named SELECT
patterns over CE-READ-1's `GET /api/sparql?pattern=<name>` surface
(`routers/sparql.py`), same B3 sanitizer choke point as every other query on
that path (AC-010-06).

Base BPMO cannot express `Permission`/`authorityLevel`/explicit-deny in M2
(ADR-013) -- every query here answers from modelled `performedBy`/
`governedBy`/`accesses` links only, and `synthesize_decision` below can
structurally never return `"permit"`.
"""

from __future__ import annotations

import re
from typing import Any

from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import workspace_iri

#: Mirrors `operations/pipeline.py::_SAFE_IRI_RE` -- same "reject SPARQL
#: injection chars" convention, duplicated here because these values come
#: straight off the query string, not a graph lookup.
_SAFE_IRI_RE = re.compile(r'^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>"]+$')
_IDENTIFIER_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]*$")

#: The three base BPMO link predicates `authority()`/`escalation()` may
#: resolve -- mirrors `GET /api/ontology/types` (ontology-standards.md);
#: hardcoded here because ADR-013's M2 descope fixes this to exactly these
#: three (no ODRL Authority-Extension actions in M2).
BASE_LINK_ACTIONS = frozenset({"performedBy", "governedBy", "accesses"})

#: AC-010-02/-03: PLAT-SETTINGS-1 tunable for what a "no evidence" authority
#: check resolves to. `"permit"` is deliberately excluded from the allowed
#: values -- see `resolve_deny_default`.
DENY_DEFAULT_SETTING_KEY = "agent_authority.deny_default"
_ALLOWED_DENY_DEFAULTS = frozenset({"deny", "coverage-gap"})

_PREFIX = "PREFIX weave: <https://weave.io/ontology/>"


class InvalidIriError(Exception):
    """A caller-supplied actor/target/process value isn't a safe IRI."""


class InvalidActionError(Exception):
    """`action` isn't one of the three base-link predicates (`BASE_LINK_ACTIONS`)."""


class InvalidLinkNameError(Exception):
    """A `kind`/`required_links` identifier isn't a safe bare word, or
    `required_links` was empty.
    """


def _require_safe_iri(value: str) -> str:
    if not _SAFE_IRI_RE.match(value):
        raise InvalidIriError(value)
    return value


def _require_identifier(value: str) -> str:
    if not _IDENTIFIER_RE.match(value):
        raise InvalidLinkNameError(value)
    return value


def authority_query(actor_iri: str, action: str, target_iri: str) -> str:
    """AC-010-01/-03/-06: one row, always -- `?source` is `"modelled"` when
    `<target_iri> weave:<action> <actor_iri>` holds, else `"coverage_gap"`
    with `?missing_link` bound to `action`. Never two rows, never zero:
    `synthesize_decision` reads this single row, not a SPARQL row count
    (FR-036's failure mode is "empty result reads as permitted").
    """
    if action not in BASE_LINK_ACTIONS:
        raise InvalidActionError(action)
    actor = _require_safe_iri(actor_iri)
    target = _require_safe_iri(target_iri)
    return f"""{_PREFIX}
SELECT ?entity_iri ?missing_link ?source
WHERE {{
  GRAPH ?g {{
    BIND(<{target}> AS ?entity_iri)
    {{
      <{target}> weave:{action} <{actor}> .
      BIND("modelled" AS ?source)
    }}
    UNION
    {{
      FILTER NOT EXISTS {{ <{target}> weave:{action} <{actor}> }}
      BIND("{action}" AS ?missing_link)
      BIND("coverage_gap" AS ?source)
    }}
  }}
}}"""


def escalation_query(process_iri: str) -> str:
    """AC-010-05: base BPMO has no dedicated "escalate to" predicate --
    ADR-027 documents `performedBy` (`Process -> Actor`) as the M2
    escalation target: the actor(s) who perform the process are who an
    agent escalates to when it can't proceed alone. A process with no
    `performedBy` actor at all returns a coverage-gap row instead
    (`missing_link: "performedBy"`) -- never a silent empty result.
    """
    process = _require_safe_iri(process_iri)
    return f"""{_PREFIX}
SELECT ?entity_iri ?actor_iri ?missing_link ?source
WHERE {{
  GRAPH ?g {{
    BIND(<{process}> AS ?entity_iri)
    {{
      <{process}> weave:performedBy ?actor_iri .
      BIND("modelled" AS ?source)
    }}
    UNION
    {{
      FILTER NOT EXISTS {{ <{process}> weave:performedBy ?any_actor }}
      BIND("performedBy" AS ?missing_link)
      BIND("coverage_gap" AS ?source)
    }}
  }}
}}"""


def coverage_gap_query(kind: str, required_links: list[str]) -> str:
    """FR-036/AC-010-04: generalises M1's process-only `coverage_gap_process`
    (`rdf/patterns.py`) to `coverage_gap(kind, required_links)` -- one row
    per absent link, `{entity_iri, missing_link}`, default invocation
    `(Process, [performedBy, governedBy])`. A NEW pattern, not a rewrite of
    `coverage_gap_process` (Law 3): that query is step-level
    (`{process_iri, step_iri, step_label, gap_reason}`, "any of
    performedBy/supportedBy is enough"); this one is entity-level and
    flags every required link independently.
    """
    kind_name = _require_identifier(kind)
    if not required_links:
        raise InvalidLinkNameError("required_links must be non-empty")
    links = [_require_identifier(link) for link in required_links]
    branches = "\n    UNION\n    ".join(
        f'{{ FILTER NOT EXISTS {{ ?entity_iri weave:{link} ?_o_{i} }} '
        f'BIND("{link}" AS ?missing_link) }}'
        for i, link in enumerate(links)
    )
    return f"""{_PREFIX}
SELECT ?entity_iri ?missing_link
WHERE {{
  GRAPH ?g {{
    ?entity_iri a weave:{kind_name} .
    {branches}
  }}
}}"""


#: FR-037: framework competency-question set (consumes/produces/runsOn/
#: performedBy/governedBy per process) -- one UNION query, `?relation`
#: names which base predicate matched.
COMPETENCY_QUESTIONS_FRAMEWORK = f"""{_PREFIX}
SELECT ?subject_iri ?relation ?object_iri
WHERE {{
  GRAPH ?g {{
    {{ ?subject_iri weave:consumes ?object_iri . BIND("consumes" AS ?relation) }}
    UNION {{ ?subject_iri weave:produces ?object_iri . BIND("produces" AS ?relation) }}
    UNION {{ ?subject_iri weave:runsOn ?object_iri . BIND("runsOn" AS ?relation) }}
    UNION {{ ?subject_iri weave:performedBy ?object_iri . BIND("performedBy" AS ?relation) }}
    UNION {{ ?subject_iri weave:governedBy ?object_iri . BIND("governedBy" AS ?relation) }}
  }}
}}"""


def synthesize_decision(rows: list[dict[str, Any]]) -> str:
    """FR-036 security floor: decision is synthesized in Python, never read
    off a SPARQL row count. A coverage-gap row anywhere in `rows` (bound
    `missing_link`) means `"coverage-gap"`; otherwise `"deny"`.
    `"permit"` is never returned in M2 (ADR-013) -- this function's logic
    only ever produces one of two strings, so no caller can get "permit"
    out of it, by construction.
    """
    if any(row.get("missing_link") for row in rows):
        return "coverage-gap"
    return "deny"


async def resolve_deny_default(conn: Any, *, tenant_id: str, workspace_id: str) -> str:
    """AC-010-02/-03: PLAT-SETTINGS-1 tunable for the "no evidence, no gap"
    deny branch -- mirrors `ingest/confidence.py::resolve_confidence_threshold`'s
    cascade-with-fallback shape. A configured value outside
    `_ALLOWED_DENY_DEFAULTS` (in particular `"permit"`) is ignored and the
    safe `"deny"` default is used instead -- a misconfigured or malicious
    settings row can never grant `permit`.
    """
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=DENY_DEFAULT_SETTING_KEY,
            context_iri=workspace_iri(tenant_id, workspace_id),
        )
    except SettingNotFound:
        return "deny"
    return resolved.value if resolved.value in _ALLOWED_DENY_DEFAULTS else "deny"
