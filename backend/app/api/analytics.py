"""API router for live Workspace Analytics & Operational Intelligence."""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import AuditLog, User
from app.models.document import Document, DocumentChunk
from app.models.operations import Report, Task
from app.schemas.operations import AnalyticsOverviewResponse

logger = logging.getLogger("nexusai.api.analytics")
router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsOverviewResponse:
    """Retrieve comprehensive system operational analytics aggregated from live records."""
    # 1. Document metrics
    total_docs = db.scalar(select(func.count(Document.id))) or 0
    total_bytes = db.scalar(select(func.sum(Document.size_bytes))) or 0
    total_chunks = db.scalar(select(func.count(DocumentChunk.id))) or 0

    # 2. Audit & Security metrics
    total_audits = db.scalar(select(func.count(AuditLog.id))) or 0
    blocked_breaches = db.scalar(
        select(func.count(AuditLog.id)).where(
            (AuditLog.action == "PERMISSION_DENIED") | (AuditLog.result == "DENIED")
        )
    ) or 0
    rag_queries = db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.action.like("RAG_%"))
    ) or 0
    tool_runs = db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.action.like("AGENT_TOOL_%"))
    ) or 0

    # 3. Tasks metrics
    total_tasks = db.scalar(select(func.count(Task.id))) or 0
    pending_tasks = db.scalar(
        select(func.count(Task.id)).where(Task.status.in_(["TODO", "IN_PROGRESS"]))
    ) or 0
    completed_tasks = db.scalar(
        select(func.count(Task.id)).where(Task.status == "DONE")
    ) or 0

    # 4. Reports metrics
    total_reports = db.scalar(select(func.count(Report.id))) or 0
    published_reports = db.scalar(
        select(func.count(Report.id)).where(Report.status == "PUBLISHED")
    ) or 0

    # 5. Classifications breakdown
    classifications = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]
    classification_counts: Dict[str, int] = {}
    for c in classifications:
        cnt = db.scalar(select(func.count(Document.id)).where(Document.classification == c)) or 0
        classification_counts[c] = cnt

    # 6. Collections breakdown
    collections = ["HR", "Finance", "Support", "Engineering", "General"]
    collection_counts: Dict[str, int] = {}
    for col in collections:
        cnt = db.scalar(select(func.count(Document.id)).where(Document.collection == col)) or 0
        collection_counts[col] = cnt

    # 7. Recent activity stream
    recent_audits = db.scalars(
        select(AuditLog).order_by(desc(AuditLog.created_at)).limit(10)
    ).all()

    recent_activity: List[Dict[str, Any]] = [
        {
            "id": a.id,
            "action": a.action,
            "user_id": a.user_id,
            "result": a.result,
            "details": a.details,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent_audits
    ]

    return AnalyticsOverviewResponse(
        total_documents=total_docs,
        total_storage_bytes=total_bytes,
        total_chunks=total_chunks,
        total_audit_events=total_audits,
        total_security_breaches=blocked_breaches,
        total_rag_queries=rag_queries,
        total_agent_tool_runs=tool_runs,
        total_tasks=total_tasks,
        pending_tasks=pending_tasks,
        completed_tasks=completed_tasks,
        total_reports=total_reports,
        published_reports=published_reports,
        classification_counts=classification_counts,
        collection_counts=collection_counts,
        recent_activity=recent_activity,
    )
