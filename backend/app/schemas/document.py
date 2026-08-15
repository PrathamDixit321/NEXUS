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

