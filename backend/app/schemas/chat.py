"""API contracts and schemas for chat operations."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Schema representing chat assistant query request."""
    message: str = Field(..., description="The query message text to ask the RAG system")
    collection: str | None = Field(None, description="Optional collection name to restrict search space")


class CitationSource(BaseModel):
    """Schema representing a citation source document context block."""
    document_name: str
    page_number: int | None
    similarity: float


class ChatResponse(BaseModel):
    """Schema representing generated RAG chat response with source citations."""
    response: str
    citations: list[CitationSource]
