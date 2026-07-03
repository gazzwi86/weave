from datetime import UTC, datetime

from pydantic import BaseModel, Field


class ServiceStatuses(BaseModel):
    postgres: str
    redis: str
    oxigraph: str


class HealthResponse(BaseModel):
    """Liveness payload for /api/health (AC-1)."""

    status: str
    services: ServiceStatuses
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
