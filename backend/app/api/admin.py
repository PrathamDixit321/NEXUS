"""API endpoints for admin/compliance security logging operations."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User, AuditLog
from app.schemas.auth import AuditLogResponse

router = APIRouter(prefix="/admin/audit-logs", tags=["Admin"])


@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[dict]:
    """Retrieves system compliance audit logs (CEOs and Administrators only)."""
    # Enforce admin privilege check
    if current_user.role.name not in ("Admin", "CEO"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin or CEO privileges are required to view security compliance audits."
        )

    statement = select(AuditLog)
    if action:
        statement = statement.where(AuditLog.action == action.strip())
    if user_id:
        statement = statement.where(AuditLog.user_id == user_id.strip())

    statement = statement.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    logs = db.scalars(statement).all()

    response = []
    for log in logs:
        response.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user.email if log.user else None,
            "user_name": log.user.full_name if log.user else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "result": log.result,
            "details": log.details,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at
        })

    return response
