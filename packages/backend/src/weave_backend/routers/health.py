import asyncio

from fastapi import APIRouter

from weave_backend.health_checks import check_oxigraph, check_postgres, check_redis
from weave_backend.schemas.health import HealthResponse, ServiceStatuses

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    postgres, redis, oxigraph = await asyncio.gather(
        check_postgres(), check_redis(), check_oxigraph()
    )
    services = ServiceStatuses(postgres=postgres, redis=redis, oxigraph=oxigraph)
    status = "ok" if all(v == "ok" for v in (postgres, redis, oxigraph)) else "degraded"
    return HealthResponse(status=status, services=services)
