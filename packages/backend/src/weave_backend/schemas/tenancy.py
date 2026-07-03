"""Law 13: request-body schemas for the tenancy routes, validated before any
handler touches the values.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CreateWorkspaceRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=63, pattern=r"^[a-z0-9][a-z0-9-]*$")
    display_name: str = Field(min_length=1, max_length=200)


class WorkspaceResponse(BaseModel):
    id: str
    slug: str
    display_name: str
    named_graph_iri: str
    created_at: datetime


class InviteMemberRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: str = Field(min_length=1, max_length=50)


class MemberResponse(BaseModel):
    id: str
    workspace_id: str
    email: str
    role: str
    status: str


class SwitchWorkspaceResponse(BaseModel):
    workspace_id: str
    named_graph_iri: str
    redirect_url: str
