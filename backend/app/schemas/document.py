"""API schemas for document operations."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    collection: str
    content_type: str
    size_bytes: int
    owner: str
    owner_id: str | None = None
    classification: str = "INTERNAL"
    default_access: str = "ORGANIZATION"
    status: str
    created_at: datetime
    updated_at: datetime


class DocumentChunkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    chunk_index: int
    content: str
    page_number: int | None
    created_at: datetime


class PermissionGrant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject_type: str  # USER, ROLE, DEPARTMENT, TEAM, ORGANIZATION
    subject_id: str
    permission_type: str  # VIEW, DOWNLOAD, EDIT, SHARE, DELETE


class DocumentPermissionsRead(BaseModel):
    owner_id: str
    owner_name: str
    default_access: str
    classification: str
    allowed_options: list[dict]
    permissions: list[PermissionGrant]


class DocumentPermissionsUpdate(BaseModel):
    default_access: str
    classification: str
    permissions: list[PermissionGrant]

