"""ONB-TASK-011: per-path milestone config + signal check (E5-S2, ADR-004).

**Scope decision (undocumented in the brief -- logged here, not an
escalation, per the DoR's "milestone signal definitions... reviewed" item
which has no upstream artefact to point at):** `path_resolver.py`
(ONB-TASK-006) resolves one `role_path` per user, not a milestone set, so
this module is the milestone config the brief's Scope Note implies but
doesn't itself define. One milestone per path that has a detector:

- **business** and **technical** share one signal -- "first entity
  PROV-attributed to the user's principal" -- rather than technical's
  brief-offered alternative ("a SPARQL run"), which has no audit trail to
  check against here and would double the surface for no AC this task
  names. A future task can split them without touching the recorder.
- **compliance** ("first governance/SHACL view") and **admin** (self-mark
  only, TASK-010) have no detector milestone in this slice -- the poller
  never evaluates them (AC-011-05's "locked milestone" case), matching the
  Implementation Hints' note that compliance's signal routes through a
  view-handler seam this task doesn't build.
"""

from __future__ import annotations

from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.rdf.oxigraph_client import run_query

_PROV = "http://www.w3.org/ns/prov#"

#: role_path -> the one milestone_id this poller slice detects for it.
#: `.get(role_path)` returning `None` is the AC-011-05 "locked" case.
MILESTONE_ID_BY_PATH: dict[str, str] = {
    "business": "first_committed_entity",
    "technical": "first_committed_entity",
}

#: TASK-010 AC-010-03: milestone ids the self-mark route may write --
#: OQ-08's Admin-invite item has no poller signal (PLAT-IDENTITY-1 isn't
#: contracted), so it's manual-only. An allowlist (not a free-text
#: milestone_id) so a client can't self-mark an arbitrary/poller-owned id.
#: `add_competency_questions` (ONB-V1 competency-question beacon) is likewise
#: a user-declared action with no poller detector -- without it the beacon's
#: self-mark 404s (`milestone_not_manual`).
MANUAL_ONLY_MILESTONE_IDS: frozenset[str] = frozenset(
    {"invite_admin", "add_competency_questions"}
)


async def has_committed_entity(named_graph_iri: str, principal_iri: str) -> bool:
    """AC-011-01/07: ASKs the user's own-workspace prov graph for any
    `prov:Activity` associated with `principal_iri` that generated an
    entity -- "first committed entity PROV-attributed to the user's
    principal" (E5-S2), grounded in `operations/provenance.py::write_activity`'s
    real `wasAssociatedWith`/`generated` predicates (not a placeholder --
    unlike `requests/ce_read.py`'s BPMO predicates, this shape ships today).
    """
    query = f"""
        ASK {{
          ?activity a <{_PROV}Activity> ;
            <{_PROV}wasAssociatedWith> <{principal_iri}> ;
            <{_PROV}generated> ?entity .
        }}
    """
    result = await run_query(query, prov_graph_iri(named_graph_iri))
    return bool(result.get("boolean", False))
