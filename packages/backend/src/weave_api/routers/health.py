from importlib.metadata import version

from fastapi import APIRouter

from weave_api.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    return HealthResponse(version=version("weave-api"))
