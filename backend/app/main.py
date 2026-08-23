import logging

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.database import get_db

from app.core.config import get_settings
from app.api.documents import router as documents_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.agents import router as agents_router
from app.api.admin import router as admin_router
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
app.include_router(admin_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check(
    db: Session = Depends(get_db)
) -> dict:
    """Check database connectivity and storage directory write access for system health monitoring."""
    logger.info("Health check endpoint hit")
    
    # 1. Check database connection
    db_status = "unhealthy"
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health probe failed: {e}")
        
    # 2. Check storage path write access
    storage_status = "unhealthy"
    try:
        storage_path = settings.storage_path
        storage_path.mkdir(parents=True, exist_ok=True)
        temp_file = storage_path / ".healthcheck"
        temp_file.write_text("ok", encoding="utf-8")
        temp_file.unlink()
        storage_status = "healthy"
    except Exception as e:
        logger.error(f"Storage path health probe failed: {e}")
        
    # 3. Handle service failures
    if db_status != "healthy" or storage_status != "healthy":
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "database": db_status,
                "storage": storage_status,
                "service": settings.app_name,
                "version": settings.app_version
            }
        )
        
    return {
        "status": "healthy",
        "database": db_status,
        "storage": storage_status,
        "service": settings.app_name,
        "version": settings.app_version
    }
