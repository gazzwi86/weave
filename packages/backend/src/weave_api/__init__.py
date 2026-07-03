from fastapi import FastAPI

from weave_api.routers.health import router as health_router

app = FastAPI(title="Weave Platform API")
app.include_router(health_router)


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104 -- dev entrypoint only
