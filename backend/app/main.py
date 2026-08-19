import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.documents import router as documents_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.agents import router as agents_router
from app.db.database import Base, engine, SessionLocal
from app.models.document import Document  # noqa: F401 - registers the table with SQLAlchemy
from app.models.auth import User, Role, Permission, UserSession, AuditLog  # noqa: F401 - registers auth tables
from app.db.seed import seed_roles_and_permissions


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexusai")
settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create local persistence tables and seed data during startup."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_roles_and_permissions(db)
    yield


app = FastAPI(
    title=settings.app_name,
    description="Enterprise AI Operating System Core API Engine",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(documents_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Return the service status for local checks and future deployment probes."""
    logger.info("Health check endpoint hit")
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }
