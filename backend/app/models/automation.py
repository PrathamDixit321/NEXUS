"""SQLAlchemy models for Workflow Automation Hub: Workflows, Runs, and S2S API Keys."""

from datetime import datetime
import uuid
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Workflow(Base):
    """Automated enterprise workflow connecting events, n8n, webhooks, and AI agents."""

    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[str] = mapped_column(
        String(50), default="WEBHOOK", nullable=False
    )  # WEBHOOK, SCHEDULE, DOCUMENT_UPLOAD, AGENT_ACTION, MANUAL
    webhook_slug: Mapped[Optional[str]] = mapped_column(
        String(100), unique=True, nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="ACTIVE", nullable=False
    )  # ACTIVE, PAUSED, DRAFT
    action_type: Mapped[str] = mapped_column(
        String(50), default="EXECUTE_AGENT_TASK", nullable=False
    )  # EXECUTE_AGENT_TASK, TRIGGER_N8N, NOTIFY_MANAGER, GENERATE_REPORT, SYNC_EXTERNAL_CRM
    action_target: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    action_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_runs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_workflows")
    runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan", order_by="desc(WorkflowRun.created_at)")


class WorkflowRun(Base):
    """Historical execution trace of an automation workflow."""

    __tablename__ = "workflow_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default="SUCCESS", nullable=False
    )  # SUCCESS, FAILED, RUNNING
    triggered_by: Mapped[str] = mapped_column(String(255), default="System", nullable=False)
    trigger_source: Mapped[str] = mapped_column(
        String(50), default="WEBHOOK", nullable=False
    )  # WEBHOOK, MANUAL, SCHEDULE, EVENT
    execution_duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payload_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    workflow = relationship("Workflow", back_populates="runs")


class ApiKey(Base):
    """Server-to-Server (S2S) integration API key for external webhook engines like n8n or Zapier."""

    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(24), nullable=False)
    hashed_key: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="Employee", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_api_keys")
