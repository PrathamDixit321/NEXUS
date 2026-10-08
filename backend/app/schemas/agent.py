"""API contracts and schemas for AI Agent profile and execution operations."""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.chat import CitationSource


class AgentProfile(BaseModel):
    """Schema representing an AI Agent profile detail package."""
    id: str
    name: str
    description: str
    collection_bind: str
    status: str
    allowed_tools: List[str]


class BoundDocumentSummary(BaseModel):
    """Schema representing a document bound to an agent's knowledge scope."""
    id: str
    name: str
    collection: str
    classification: str
    size_bytes: int
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class AgentDetailResponse(BaseModel):
    """Detailed profile schema with system persona, tool security matrix, and bound documents."""
    id: str
    name: str
    description: str
    collection_bind: str
    status: str
    allowed_tools: List[str]
    system_persona: str
    tool_security_matrix: dict[str, List[str]]
    bound_documents_count: int
    bound_documents: List[BoundDocumentSummary]

    model_config = ConfigDict(from_attributes=True)


class AgentRunRequest(BaseModel):
    """Schema representing user query payload sent to execute an Agent."""
    message: str = Field(..., description="Query message for the AI Agent")


class ToolExecution(BaseModel):
    """Schema representing a simulated tool-calling event log."""
    tool_name: str
    action_taken: str
    status: str
    timestamp: str


class AgentResponse(BaseModel):
    """Schema representing the Agent's generated answer, tool logs, and document citations."""
    response: str
    tool_calls: List[ToolExecution]
    citations: List[CitationSource]
