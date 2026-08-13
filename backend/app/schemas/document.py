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
