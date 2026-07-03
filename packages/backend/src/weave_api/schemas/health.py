from datetime import UTC, datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Liveness payload for /health."""

    status: str = "ok"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    version: str
