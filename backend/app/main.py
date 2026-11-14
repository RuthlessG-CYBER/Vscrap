import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import DOWNLOAD_ROOT, allowed_origins
from app.services.download_jobs import download_jobs


@asynccontextmanager
async def lifespan(_: FastAPI):
    DOWNLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    cleanup_task = asyncio.create_task(download_jobs.cleanup_loop())
    try:
        yield
    finally:
        download_jobs.shutdown()
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


def create_app() -> FastAPI:
    application = FastAPI(title="VScrap Media Downloader API", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
    )
    application.include_router(router)
    return application


app = create_app()
