"""G15/Law 13: request/response schemas for the operator-console
cross-tenant routes -- shape-validated before any handler touches the
values, matching `schemas/tenancy.py`'s conventions.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from weave_backend.schemas.tenancy import MemberResponse


class ProvisionCompanyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    industry: str = Field(min_length=1, max_length=100)
    region: str = Field(min_length=1, max_length=100)
    admin_email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CompanyResponse(BaseModel):
    tenant_id: str
    name: str
    industry: str
    region: str
    member_count: int
    entity_count: int
    model_version: str | None
    status: str
    created_at: datetime


class ProvisionCompanyResponse(BaseModel):
    company: CompanyResponse
    admin_invite: MemberResponse


class CompanyStatusResponse(BaseModel):
    tenant_id: str
    status: str
