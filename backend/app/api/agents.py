"""API endpoints managing AI Agent profiles and execution workflows."""

from datetime import datetime
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.document import Document, DocumentChunk
from app.schemas.agent import AgentProfile, AgentResponse, AgentRunRequest, ToolExecution
from app.schemas.chat import CitationSource
from app.services.ai_service import cosine_similarity, generate_completion, get_embedding

logger = logging.getLogger("nexusai.api.agents")
router = APIRouter(prefix="/agents", tags=["Agents"])

# In-memory agent profiles configuration
AGENT_PROFILES: Dict[str, dict] = {
    "hr-policy": {
        "id": "hr-policy",
        "name": "HR Policy Assistant",
        "description": "Specialized assistant answering company policies, benefits, and leave requests.",
        "collection_bind": "HR",
        "status": "Active",
        "allowed_tools": ["notify-hr-team", "generate-leave-form"],
        "system_persona": (
            "You are the Nexus HR Policy Assistant. You answer human resource questions "
            "grounded in corporate policies. Be supportive, empathetic, and detail-oriented."
        )
    },
    "finance-analyst": {
        "id": "finance-analyst",
        "name": "Finance Analyst",
        "description": "Reviews financial statements, performs computations, and summaries budgets.",
        "collection_bind": "Finance",
        "status": "Active",
        "allowed_tools": ["math-calculator", "export-excel"],
        "system_persona": (
            "You are the Nexus Finance Analyst. You review budget reports, statements, and perform "
            "data analysis. Be precise, detail-oriented, and base all calculations on provided context."
        )
    },
    "support-triage": {
        "id": "support-triage",
        "name": "Support Triage Agent",
        "description": "Classifies incoming requests, creates tracking tasks, and escalates bugs.",
        "collection_bind": "Support",
        "status": "Active",
        "allowed_tools": ["escalate-ticket", "create-jira-issue"],
        "system_persona": (
            "You are the Nexus Support Triage Agent. You organize customer tickets, clarify bugs, "
            "and escalate operational issues. Be direct, task-oriented, and structure requests clearly."
        )
    }
}


@router.get("", response_model=List[AgentProfile])
def list_agents(current_user: User = Depends(get_current_user)) -> List[AgentProfile]:
    """Retrieve all configured AI Agent profiles."""
    return [
        AgentProfile(
            id=a["id"],
            name=a["name"],
            description=a["description"],
            collection_bind=a["collection_bind"],
            status=a["status"],
            allowed_tools=a["allowed_tools"]
        ) for a in AGENT_PROFILES.values()
    ]


@router.post("/{agent_id}/run", response_model=AgentResponse)
def run_agent(
    agent_id: str,
    payload: AgentRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentResponse:
    """Execute query under an Agent profile context, triggering tools and RAG search."""
    if agent_id not in AGENT_PROFILES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent profile '{agent_id}' not found"
        )
        
    agent = AGENT_PROFILES[agent_id]
    msg_lower = payload.message.lower()
    
    # 1. Perform context retrieval filtered by agent collection
    context_blocks = []
    citations = []
    
    try:
        query_vector = get_embedding(payload.message)
        statement = select(DocumentChunk).join(Document).where(Document.collection == agent["collection_bind"])
        chunks = db.scalars(statement).all()
        
        scored_chunks = []
        for chunk in chunks:
            if not chunk.embedding_json:
                continue
            try:
                chunk_vector = json.loads(chunk.embedding_json)
                sim = cosine_similarity(query_vector, chunk_vector)
                scored_chunks.append((chunk, sim))
            except Exception as e:
                logger.error(f"Error parsing chunk embedding {chunk.id}: {e}")
                
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        
        for chunk, sim in scored_chunks[:3]:
            if sim > 0.05:
                context_blocks.append(f"[Source: {chunk.document.name} (Page {chunk.page_number})]\n{chunk.content}")
                citations.append(
                    CitationSource(
                        document_name=chunk.document.name,
                        page_number=chunk.page_number,
                        similarity=round(sim, 3)
                    )
                )
    except Exception as e:
        logger.error(f"Error retrieving context for agent {agent_id}: {e}")
        
    context_string = "\n\n---\n\n".join(context_blocks)
    
    # 2. Inspect keywords and simulate tool calls
    tool_calls = []
    timestamp_str = datetime.now().isoformat()
    
    if agent_id == "hr-policy":
        if any(kw in msg_lower for kw in ["notify", "send", "submit", "contact"]):
            tool_calls.append(
                ToolExecution(
                    tool_name="notify-hr-team",
                    action_taken=f"Sent Slack message to HR channel for {current_user.full_name}",
                    status="SUCCESS",
                    timestamp=timestamp_str
                )
            )
        if any(kw in msg_lower for kw in ["leave", "vacation", "holiday", "sick"]):
            tool_calls.append(
                ToolExecution(
                    tool_name="generate-leave-form",
                    action_taken="Drafted official PDF vacation application form",
                    status="SUCCESS",
                    timestamp=timestamp_str
                )
            )
            
    elif agent_id == "finance-analyst":
        if any(kw in msg_lower for kw in ["calculate", "sum", "math", "total", "average", "compute"]):
            tool_calls.append(
                ToolExecution(
                    tool_name="math-calculator",
                    action_taken="Computed sum totals and verified balance calculations",
                    status="SUCCESS",
                    timestamp=timestamp_str
                )
            )
            
    elif agent_id == "support-triage":
        if any(kw in msg_lower for kw in ["escalate", "urgent", "critical", "alert"]):
            tool_calls.append(
                ToolExecution(
                    tool_name="escalate-ticket",
                    action_taken="Flagged status to active paging alert for engineering",
                    status="SUCCESS",
                    timestamp=timestamp_str
                )
            )
        if any(kw in msg_lower for kw in ["create", "jira", "ticket", "bug", "task"]):
            tool_calls.append(
                ToolExecution(
                    tool_name="create-jira-issue",
                    action_taken=f"Created Jira Issue (NEX-{current_user.id[:4].upper()}) with high priority",
                    status="SUCCESS",
                    timestamp=timestamp_str
                )
            )
            
    # 3. Formulate persona completion
    system_prompt = (
        f"{agent['system_persona']}\n"
        "Ground your response strictly in the document context blocks below. "
        "Explain any automated tools triggered at the end of the answer.\n\n"
        f"Context information:\n{context_string}"
    )
    
    response_text = generate_completion(system_prompt, payload.message)
    
    return AgentResponse(
        response=response_text,
        tool_calls=tool_calls,
        citations=citations
    )
