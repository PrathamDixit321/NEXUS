"""Document metadata and content chunks persistence models."""

from datetime import UTC, datetime
from uuid import uuid4
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    collection: Mapped[str] = mapped_column(String(100), nullable=False, default="General", index=True)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    owner_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    team_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    classification: Mapped[str] = mapped_column(String(32), nullable=False, default="INTERNAL")  # PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
    default_access: Mapped[str] = mapped_column(String(32), nullable=False, default="ORGANIZATION")  # ORGANIZATION, DEPARTMENT, TEAM, PRIVATE
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="processing")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    permissions: Mapped[List["DocumentPermission"]] = relationship(
        "DocumentPermission",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    owner_rel: Mapped[Optional["User"]] = relationship("User")

    @property
    def owner(self) -> str:
        """Expose owner full name or fallback default string for backward compatibility."""
        return self.owner_rel.full_name if self.owner_rel else "Demo workspace"


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    document: Mapped[Document] = relationship("Document", back_populates="chunks")


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_type: Mapped[str] = mapped_column(String(32), nullable=False)  # USER, ROLE, DEPARTMENT, TEAM, ORGANIZATION
    subject_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    permission_type: Mapped[str] = mapped_column(String(32), nullable=False)  # VIEW, DOWNLOAD, EDIT, SHARE, DELETE
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    document: Mapped[Document] = relationship("Document", back_populates="permissions")
