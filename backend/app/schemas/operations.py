"""Pydantic API schemas for Operations Suite: Tasks, Reports, and Analytics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


# Task Schemas
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    status: str = "TODO"  # TODO, IN_PROGRESS, DONE, BLOCKED
    assigned_to_id: Optional[str] = None
    due_date: Optional[datetime] = None
    related_resource_type: Optional[str] = None
    related_resource_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_to_email: Optional[str] = None
    created_by_id: Optional[str] = None
    due_date: Optional[datetime] = None
    related_resource_type: Optional[str] = None
    related_resource_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Report Schemas
class ReportCreate(BaseModel):
    title: str
    description: Optional[str] = None
    report_type: str = "EXECUTIVE_SUMMARY"
    status: str = "PUBLISHED"
    content: Optional[str] = None


class ReportGenerateRequest(BaseModel):
    report_type: str = "EXECUTIVE_SUMMARY"  # EXECUTIVE_SUMMARY, COMPLIANCE_AUDIT, ACCESS_CONTROL, KNOWLEDGE_USAGE
    custom_notes: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    report_type: str
    status: str
    generated_by_id: Optional[str] = None
    generated_by_name: Optional[str] = None
    content: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Analytics Schemas
class AnalyticsOverviewResponse(BaseModel):
    total_documents: int
    total_storage_bytes: int
    total_chunks: int
    total_audit_events: int
    total_security_breaches: int
    total_rag_queries: int
    total_agent_tool_runs: int
    total_tasks: int
    pending_tasks: int
    completed_tasks: int
    total_reports: int
    published_reports: int
    classification_counts: Dict[str, int]
    collection_counts: Dict[str, int]
    recent_activity: List[Dict[str, Any]]
