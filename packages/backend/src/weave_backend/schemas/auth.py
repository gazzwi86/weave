from pydantic import BaseModel, Field


class RefreshRequest(BaseModel):
    """Request body for ``POST /api/auth/refresh`` (Law 13: validated, no cast)."""

    refresh_token: str = Field(min_length=1)


class RefreshResponse(BaseModel):
    access_token: str
    expires_in: int
