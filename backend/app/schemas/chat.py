"""API contracts and schemas for chat operations."""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CitationSource(BaseModel):
    """Schema representing a citation source document context block."""
    document_name: str
    document_id: Optional[str] = None
    page_number: Optional[int] = None
    similarity: float


class ChatRequest(BaseModel):
    """Schema representing chat assistant query request."""
    message: str = Field(..., description="The query message text to ask the RAG system")
    collection: Optional[str] = Field(None, description="Optional collection name to restrict search space")
    session_id: Optional[str] = Field(None, description="Optional chat session ID for stateful conversation tracking")


class ChatResponse(BaseModel):
    """Schema representing generated RAG chat response with source citations."""
    response: str
    citations: List[CitationSource]
    session_id: Optional[str] = None
    message_id: Optional[str] = None


class ChatMessageRead(BaseModel):
    """Schema representing a single stored chat message in a conversation."""
    id: str
    role: str
    content: str
    citations: List[CitationSource] = []
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class ChatSessionSummary(BaseModel):
    """Schema representing a summary list item for a chat session thread."""
    id: str
    title: str
    collection: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ChatSessionDetail(BaseModel):
    """Schema representing full details of a chat session including message history."""
    id: str
    title: str
    collection: Optional[str] = None
    created_at: str
    updated_at: str
    messages: List[ChatMessageRead] = []

    model_config = ConfigDict(from_attributes=True)


class ChatSessionCreate(BaseModel):
    """Payload to initialize a new persistent chat session."""
    title: Optional[str] = "New Conversation"
    collection: Optional[str] = None


class ChatSessionUpdate(BaseModel):
    """Payload to rename or update collection scope for a chat session."""
    title: Optional[str] = None
    collection: Optional[str] = None
