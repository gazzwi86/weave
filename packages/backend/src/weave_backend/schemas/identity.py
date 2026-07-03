"""Law 13: request/response schemas for the identity routes, validated
before any handler touches the values.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AgentTokenRequest(BaseModel):
    sts_token: str = Field(min_length=1)
    workspace_id: str = Field(min_length=1)


class AgentTokenResponse(BaseModel):
    agent_token: str
    principal_iri: str
    expires_in: int


class WorkspaceMembershipResponse(BaseModel):
    workspace_id: str
    role: str


class PrincipalResponse(BaseModel):
    iri: str
    type: str
    display_name: str
    workspace_memberships: list[WorkspaceMembershipResponse]
    created_at: datetime


class AgentSummaryResponse(BaseModel):
    iri: str
    display_name: str
    workspace_id: str
    created_at: datetime


class AgentListResponse(BaseModel):
    agents: list[AgentSummaryResponse]
