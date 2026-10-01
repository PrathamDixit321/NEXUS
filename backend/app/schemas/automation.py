"""Pydantic API contracts for Workflow Automation, Execution Runs, and S2S API Keys."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# Workflow Schemas
class WorkflowBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    trigger_type: str = "WEBHOOK"  # WEBHOOK, SCHEDULE, DOCUMENT_UPLOAD, AGENT_ACTION, MANUAL
    status: str = "ACTIVE"  # ACTIVE, PAUSED, DRAFT
    action_type: str = "EXECUTE_AGENT_TASK"  # EXECUTE_AGENT_TASK, TRIGGER_N8N, NOTIFY_MANAGER, GENERATE_REPORT, SYNC_EXTERNAL_CRM
    action_target: Optional[str] = None
    action_payload: Optional[str] = None


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    status: Optional[str] = None
    action_type: Optional[str] = None
    action_target: Optional[str] = None
    action_payload: Optional[str] = None


class WorkflowResponse(WorkflowBase):
    id: str
    webhook_slug: Optional[str] = None
    total_runs: int
    last_run_at: Optional[datetime] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Workflow Execution Run Schemas
class WorkflowRunResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_title: Optional[str] = None
    status: str  # SUCCESS, FAILED, RUNNING
    triggered_by: str
    trigger_source: str
    execution_duration_ms: int
    payload_summary: Optional[str] = None
    logs: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkflowManualRunRequest(BaseModel):
    payload: Optional[Dict[str, Any]] = None


# API Key Schemas for S2S Integrations (e.g. n8n)
class ApiKeyCreate(BaseModel):
    name: str = Field(..., max_length=255)
    role: str = "Employee"  # Admin, Manager, Employee


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    role: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Returned ONLY upon initial API Key creation: contains raw plaintext token."""
    token: str


# Automation Workspace Summary Stats
class AutomationStatsResponse(BaseModel):
    active_workflows: int
    total_runs_today: int
    success_rate_percent: float
    avg_execution_ms: int
