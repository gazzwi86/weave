"""AC-4/AC-5 scope IRI grammar and cascade ordering.

`urn:weave:tenant:{tid}:company` | `:domain:{did}` | `:ws:{wid}` |
`:ws:{wid}:project:{pid}`

See docs/specs/weave/engines/weave-platform/decisions/ADR-004.md: `domain`
is an addressable scope level (settings can be written at a domain IRI) but
is not modelled as an entity linked to workspaces anywhere in this task --
AC-1's workspace IRI (`urn:weave:tenant:{tid}:ws:{wid}`) has no domain
segment, so a workspace/project's ancestor chain skips straight to
`company`, never through `domain`.
"""

from __future__ import annotations

#: Lower rank = tighter scope. Used both for cascade ordering (tightest
#: first) and for "does a tighter override already exist" comparisons.
SCOPE_RANK: dict[str, int] = {"project": 0, "workspace": 1, "domain": 2, "company": 3}

_KIND_TOKEN_TO_SCOPE = {"project": "project", "ws": "workspace", "domain": "domain"}


class InvalidScopeIri(Exception):
    """Raised when a scope IRI doesn't match the recognised grammar."""


def scope_of(iri: str) -> str:
    parts = iri.split(":")
    if parts[-1] == "company":
        return "company"
    if len(parts) < 6 or parts[-2] not in _KIND_TOKEN_TO_SCOPE:
        raise InvalidScopeIri(iri)
    return _KIND_TOKEN_TO_SCOPE[parts[-2]]


def ancestor_chain(iri: str) -> list[str]:
    """Tightest-first chain starting at `iri` itself and ending at the
    tenant's company scope.
    """
    chain = [iri]
    current = iri
    while scope_of(current) != "company":
        parts = current.split(":")
        parent_parts = parts[:-2]
        # only "urn:weave:tenant:{tid}" left -> that's the company scope.
        current = (
            ":".join(parent_parts) + ":company"
            if len(parent_parts) <= 4
            else ":".join(parent_parts)
        )
        chain.append(current)
    return chain
