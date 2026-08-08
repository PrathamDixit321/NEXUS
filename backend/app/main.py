import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexusai")
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Enterprise AI Operating System Core API Engine",
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Return the service status for local checks and future deployment probes."""
    logger.info("Health check endpoint hit")
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }
