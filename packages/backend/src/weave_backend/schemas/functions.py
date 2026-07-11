"""CE-FUNCTION-1 (AC-009-02/-03): `GET /api/functions` list entry +
`GET /api/functions/{iri}` detail response shapes.

No per-function semver/lineage field anywhere here -- `version_iri` **is**
the CE-VERSION-1 IRI (ADR-009 Decision 2), never a second versioning scheme.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ParamOut(BaseModel):
    #: Present for declared parameters (empty string for a synthesised
    #: return-slot entry, which has no name of its own).
    name: str = ""
    kind_iri: str
    shape_iri: str | None = None


class SignatureOut(BaseModel):
    bound_kind: str
    params: list[ParamOut]
    return_: ParamOut


class FunctionListEntry(BaseModel):
    fn_iri: str
    name: str
    bound_kind: str
    signature: SignatureOut
    #: CE-VERSION-1 version IRI this entry was resolved from -- not a
    #: per-function lineage (AC-009-02).
    version_iri: str
    status: str
    breaking: bool


class FunctionsListResponse(BaseModel):
    functions: list[FunctionListEntry]


class FunctionDetail(FunctionListEntry):
    #: Derived by CE's converter on read (cacheable by graph version) --
    #: never stored or hand-edited (AC-009-03).
    json_schema: dict[str, Any]
