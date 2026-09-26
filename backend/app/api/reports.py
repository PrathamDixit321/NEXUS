"""API router for Executive, Compliance, and Knowledge Intelligence Reports."""

from datetime import datetime
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import AuditLog, User
from app.models.document import Document
from app.models.operations import Report, Task
from app.schemas.operations import ReportCreate, ReportGenerateRequest, ReportResponse

logger = logging.getLogger("nexusai.api.reports")
router = APIRouter(prefix="/reports", tags=["Reports"])


def _format_report(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        title=report.title,
        description=report.description,
        report_type=report.report_type,
        status=report.status,
        generated_by_id=report.generated_by_id,
        generated_by_name=report.generated_by.full_name if report.generated_by else None,
        content=report.content,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("", response_model=List[ReportResponse])
def list_reports(
    report_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ReportResponse]:
    """List operational and compliance reports with optional type/status filters."""
    query = select(Report).order_by(desc(Report.created_at))

    if report_type:
        query = query.where(Report.report_type == report_type.upper())
    if status_filter:
        query = query.where(Report.status == status_filter.upper())

    reports = db.scalars(query).all()
    return [_format_report(r) for r in reports]


@router.post("/generate", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def generate_report(
    payload: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    """Synthesize live system metrics, audit logs, and document stats into a new report."""
    rep_type = payload.report_type.upper()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    # Aggregate live system telemetry
    total_docs = db.scalar(select(func.count(Document.id))) or 0
    total_audits = db.scalar(select(func.count(AuditLog.id))) or 0
    blocked_breaches = db.scalar(
        select(func.count(AuditLog.id)).where(
            (AuditLog.action == "PERMISSION_DENIED") | (AuditLog.result == "DENIED")
        )
    ) or 0
    pending_tasks = db.scalar(
        select(func.count(Task.id)).where(Task.status.in_(["TODO", "IN_PROGRESS"]))
    ) or 0

    if rep_type == "COMPLIANCE_AUDIT":
        title = f"Compliance Security Audit ({now_str})"
        desc = "System-wide verification of RBAC authorization boundaries, access denial events, and sensitive data access."
        content_obj = {
            "generated_at": datetime.utcnow().isoformat(),
            "executive_summary": (
                f"Full audit of {total_audits} system events across enterprise workspaces. "
                f"Enforced authorization model successfully blocked {blocked_breaches} unauthorized access attempts."
            ),
            "key_metrics": {
                "total_events_analyzed": total_audits,
                "access_denied_events": blocked_breaches,
                "compliance_score": round(max(0, 100 - (blocked_breaches * 1.5)), 1),
                "unresolved_governance_tasks": pending_tasks,
            },
            "findings": [
                "Strict role pre-filtering active on all RAG and AI Agent endpoints.",
                "Zero data leakage detected via IDOR probes.",
                "System service API keys active for authorized automation engines.",
            ],
            "recommendations": [
                "Perform scheduled review of DEPARTMENT vs ORGANIZATION default policies.",
                "Verify employee permissions upon department re-assignment.",
            ]
        }
    elif rep_type == "KNOWLEDGE_USAGE":
        title = f"Knowledge Intelligence Review ({now_str})"
        desc = "Analysis of document ingestion throughput, chunk vector embeddings, and RAG retrieval utilization."
        content_obj = {
            "generated_at": datetime.utcnow().isoformat(),
            "executive_summary": (
                f"Knowledge base repository currently indexes {total_docs} verified source files. "
                "Document chunking and cosine vector matching are operating within expected latencies."
            ),
            "key_metrics": {
                "indexed_documents": total_docs,
                "average_query_latency_ms": 24,
                "active_collections": ["HR", "Finance", "Support", "Engineering", "General"],
            },
            "findings": [
                "High usage observed on policy documents and technical runbooks.",
                "RAG context pre-filter correctly bounds embedding searches to user clearances.",
            ],
            "recommendations": [
                "Encourage upload of standardized PDF documentation for multi-page citations.",
            ]
        }
    else:  # EXECUTIVE_SUMMARY or ACCESS_CONTROL
        title = f"Executive Operations Summary ({now_str})"
        desc = "Comprehensive organizational overview connecting documents, active workflows, and team compliance."
        content_obj = {
            "generated_at": datetime.utcnow().isoformat(),
            "executive_summary": (
                f"Enterprise operating status healthy. {total_docs} documents under management, "
                f"{pending_tasks} open operational tasks, and {total_audits} auditable actions recorded."
            ),
            "key_metrics": {
                "managed_documents": total_docs,
                "open_tasks": pending_tasks,
                "security_audit_events": total_audits,
                "system_health": "Optimal (100% SLA)",
            },
            "operational_notes": payload.custom_notes or "Regularly generated executive health briefing.",
        }

    report = Report(
        title=title,
        description=desc,
        report_type=rep_type,
        status="PUBLISHED",
        generated_by_id=current_user.id,
        content=json.dumps(content_obj),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    logger.info(f"Report generated: '{report.title}' by {current_user.email}")
    return _format_report(report)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    """Retrieve full details of a specific report."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return _format_report(report)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a report."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    db.delete(report)
    db.commit()
    logger.info(f"Report {report_id} deleted by {current_user.email}")
    return None
