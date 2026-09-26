"""SQLAlchemy models for Operations Suite: Tasks and Executive/Audit Reports."""

from datetime import datetime
import uuid
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Task(Base):
    """Operational task tracked within the Nexus workspace."""

    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="TODO", nullable=False
    )  # TODO, IN_PROGRESS, DONE, BLOCKED
    priority: Mapped[str] = mapped_column(
        String(50), default="MEDIUM", nullable=False
    )  # LOW, MEDIUM, HIGH, URGENT

    assigned_to_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    related_resource_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # DOCUMENT, AUDIT, WORKFLOW
    related_resource_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
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

    assigned_to = relationship("User", foreign_keys=[assigned_to_id], backref="assigned_tasks")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_tasks")


class Report(Base):
    """Executive summary, compliance audit, and knowledge intelligence report."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_type: Mapped[str] = mapped_column(
        String(50), default="EXECUTIVE_SUMMARY", nullable=False
    )  # EXECUTIVE_SUMMARY, COMPLIANCE_AUDIT, ACCESS_CONTROL, KNOWLEDGE_USAGE
    status: Mapped[str] = mapped_column(
        String(50), default="PUBLISHED", nullable=False
    )  # DRAFT, PUBLISHED, SCHEDULED

    generated_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    generated_by = relationship("User", foreign_keys=[generated_by_id], backref="generated_reports")
