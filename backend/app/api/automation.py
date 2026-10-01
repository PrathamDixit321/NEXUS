"""API endpoints for Workflow Automation, Execution Traces, Webhooks, and S2S API Keys."""

from datetime import datetime, timezone
import json
import logging
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.automation import ApiKey, Workflow, WorkflowRun
from app.schemas.automation import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    AutomationStatsResponse,
    WorkflowCreate,
    WorkflowManualRunRequest,
    WorkflowResponse,
    WorkflowRunResponse,
    WorkflowUpdate,
)
from app.services.auth_service import log_auth_event
from app.services.automation_service import (
    execute_workflow,
    generate_api_key,
    get_automation_stats,
    verify_api_key,
)

logger = logging.getLogger("nexusai.api.automation")
router = APIRouter(prefix="/automation", tags=["Automation"])


@router.get("/stats", response_model=AutomationStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve high-level KPIs and performance metrics for the automation workforce."""
    return get_automation_stats(db)


@router.get("/workflows", response_model=List[WorkflowResponse])
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered automation pipelines in the workspace."""
    stmt = select(Workflow).order_by(desc(Workflow.created_at))
    workflows = db.scalars(stmt).all()

    result = []
    for wf in workflows:
        wf_dict = {
            "id": wf.id,
            "title": wf.title,
            "description": wf.description,
            "trigger_type": wf.trigger_type,
            "webhook_slug": wf.webhook_slug,
            "status": wf.status,
            "action_type": wf.action_type,
            "action_target": wf.action_target,
            "action_payload": wf.action_payload,
            "total_runs": wf.total_runs,
            "last_run_at": wf.last_run_at,
            "created_by_id": wf.created_by_id,
            "created_by_name": wf.created_by.name if wf.created_by else None,
            "created_at": wf.created_at,
            "updated_at": wf.updated_at,
        }
        result.append(WorkflowResponse(**wf_dict))
    return result


@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new automation workflow pipeline with dedicated webhook slug."""
    slug = f"whk_{secrets.token_urlsafe(16)}"

    new_wf = Workflow(
        title=payload.title,
        description=payload.description,
        trigger_type=payload.trigger_type,
        webhook_slug=slug,
        status=payload.status,
        action_type=payload.action_type,
        action_target=payload.action_target,
        action_payload=payload.action_payload,
        created_by_id=current_user.id,
    )
    db.add(new_wf)
    db.commit()
    db.refresh(new_wf)

    log_auth_event(
        db=db,
        action="WORKFLOW_CREATED",
        user_id=current_user.id,
        resource_type="WORKFLOW",
        resource_id=new_wf.id,
        result="SUCCESS",
        details=f"Created workflow '{new_wf.title}' with trigger '{new_wf.trigger_type}'",
    )

    return WorkflowResponse(
        id=new_wf.id,
        title=new_wf.title,
        description=new_wf.description,
        trigger_type=new_wf.trigger_type,
        webhook_slug=new_wf.webhook_slug,
        status=new_wf.status,
        action_type=new_wf.action_type,
        action_target=new_wf.action_target,
        action_payload=new_wf.action_payload,
        total_runs=new_wf.total_runs,
        last_run_at=new_wf.last_run_at,
        created_by_id=new_wf.created_by_id,
        created_by_name=current_user.name,
        created_at=new_wf.created_at,
        updated_at=new_wf.updated_at,
    )


@router.patch("/workflows/{workflow_id}/status", response_model=WorkflowResponse)
def toggle_workflow_status(
    workflow_id: str,
    payload: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle workflow status between ACTIVE, PAUSED, or DRAFT."""
    wf = db.scalar(select(Workflow).where(Workflow.id == workflow_id))
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    if payload.status:
        wf.status = payload.status
    if payload.title:
        wf.title = payload.title
    if payload.description is not None:
        wf.description = payload.description

    db.commit()
    db.refresh(wf)

    return WorkflowResponse(
        id=wf.id,
        title=wf.title,
        description=wf.description,
        trigger_type=wf.trigger_type,
        webhook_slug=wf.webhook_slug,
        status=wf.status,
        action_type=wf.action_type,
        action_target=wf.action_target,
        action_payload=wf.action_payload,
        total_runs=wf.total_runs,
        last_run_at=wf.last_run_at,
        created_by_id=wf.created_by_id,
        created_by_name=wf.created_by.name if wf.created_by else None,
        created_at=wf.created_at,
        updated_at=wf.updated_at,
    )


@router.post("/workflows/{workflow_id}/run", response_model=WorkflowRunResponse)
def run_workflow_manually(
    workflow_id: str,
    payload: Optional[WorkflowManualRunRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger manual test execution of a workflow pipeline."""
    wf = db.scalar(select(Workflow).where(Workflow.id == workflow_id))
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    extra_payload = payload.payload if payload else {}
    run = execute_workflow(
        db=db,
        workflow=wf,
        triggered_by=current_user.email,
        trigger_source="MANUAL",
        payload=extra_payload,
    )

    return WorkflowRunResponse(
        id=run.id,
        workflow_id=run.workflow_id,
        workflow_title=wf.title,
        status=run.status,
        triggered_by=run.triggered_by,
        trigger_source=run.trigger_source,
        execution_duration_ms=run.execution_duration_ms,
        payload_summary=run.payload_summary,
        logs=run.logs,
        created_at=run.created_at,
    )


@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a workflow and its execution traces."""
    wf = db.scalar(select(Workflow).where(Workflow.id == workflow_id))
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    db.delete(wf)
    db.commit()

    log_auth_event(
        db=db,
        action="WORKFLOW_DELETED",
        user_id=current_user.id,
        resource_type="WORKFLOW",
        resource_id=workflow_id,
        result="SUCCESS",
        details=f"Deleted workflow '{wf.title}'",
    )
    return None


@router.get("/runs", response_model=List[WorkflowRunResponse])
def list_workflow_runs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent execution runs across all workflows."""
    stmt = select(WorkflowRun).order_by(desc(WorkflowRun.created_at)).limit(limit)
    runs = db.scalars(stmt).all()

    result = []
    for r in runs:
        result.append(
            WorkflowRunResponse(
                id=r.id,
                workflow_id=r.workflow_id,
                workflow_title=r.workflow.title if r.workflow else "Deleted Pipeline",
                status=r.status,
                triggered_by=r.triggered_by,
                trigger_source=r.trigger_source,
                execution_duration_ms=r.execution_duration_ms,
                payload_summary=r.payload_summary,
                logs=r.logs,
                created_at=r.created_at,
            )
        )
    return result


@router.post("/webhooks/{webhook_slug}", response_model=WorkflowRunResponse)
async def trigger_webhook(
    webhook_slug: str,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
):
    """Inbound webhook trigger for external services (e.g. n8n, Zapier, GitHub, Slack)."""
    wf = db.scalar(select(Workflow).where(Workflow.webhook_slug == webhook_slug))
    if not wf:
        raise HTTPException(status_code=404, detail="Invalid webhook endpoint.")

    # Check S2S API key if supplied
    caller_identifier = "External Webhook"
    if x_api_key:
        key_record = verify_api_key(db, x_api_key)
        if not key_record:
            raise HTTPException(status_code=401, detail="Invalid or revoked X-API-Key header.")
        caller_identifier = f"API Key ({key_record.name})"

    # Parse inbound JSON body if present
    body_payload = {}
    try:
        raw_body = await request.body()
        if raw_body:
            body_payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        body_payload = {"raw": "Non-JSON payload received"}

    run = execute_workflow(
        db=db,
        workflow=wf,
        triggered_by=caller_identifier,
        trigger_source="WEBHOOK",
        payload=body_payload,
    )

    return WorkflowRunResponse(
        id=run.id,
        workflow_id=run.workflow_id,
        workflow_title=wf.title,
        status=run.status,
        triggered_by=run.triggered_by,
        trigger_source=run.trigger_source,
        execution_duration_ms=run.execution_duration_ms,
        payload_summary=run.payload_summary,
        logs=run.logs,
        created_at=run.created_at,
    )


# S2S API Key Management Endpoints
@router.get("/api-keys", response_model=List[ApiKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List registered Server-to-Server integration API keys (with masked tokens)."""
    stmt = select(ApiKey).order_by(desc(ApiKey.created_at))
    keys = db.scalars(stmt).all()

    result = []
    for k in keys:
        result.append(
            ApiKeyResponse(
                id=k.id,
                name=k.name,
                key_prefix=k.key_prefix,
                role=k.role,
                is_active=k.is_active,
                last_used_at=k.last_used_at,
                created_by_name=k.created_by.name if k.created_by else None,
                created_at=k.created_at,
            )
        )
    return result


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_new_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new S2S API key for n8n or external services.
    
    The plaintext token is ONLY revealed in this initial response.
    """
    api_key_obj, raw_token = generate_api_key(
        db=db,
        name=payload.name,
        role=payload.role,
        created_by_id=current_user.id,
    )

    return ApiKeyCreatedResponse(
        id=api_key_obj.id,
        name=api_key_obj.name,
        key_prefix=api_key_obj.key_prefix,
        role=api_key_obj.role,
        is_active=api_key_obj.is_active,
        last_used_at=api_key_obj.last_used_at,
        created_by_name=current_user.name,
        created_at=api_key_obj.created_at,
        token=raw_token,
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke or delete an integration API key."""
    key_record = db.scalar(select(ApiKey).where(ApiKey.id == key_id))
    if not key_record:
        raise HTTPException(status_code=404, detail="API key not found.")

    db.delete(key_record)
    db.commit()

    log_auth_event(
        db=db,
        action="API_KEY_REVOKED",
        user_id=current_user.id,
        resource_type="API_KEY",
        resource_id=key_id,
        result="SUCCESS",
        details=f"Revoked integration key '{key_record.name}'",
    )
    return None
