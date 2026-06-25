"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import get_settings
from .projects import ProjectManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.manager = ProjectManager(data_dir=settings.data_dir, seed_demo=settings.seed_demo)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Weave API",
        version="0.1.0",
        description="Ontology store, graph projection, and LLM-driven RDF mutation.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()
