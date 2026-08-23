"""API endpoints managing AI Agent profiles, execution workflows, tool authorization guards, and security compliance auditing."""

from datetime import datetime
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.document import Document, DocumentChunk, DocumentPermission
from app.schemas.agent import AgentProfile, AgentResponse, AgentRunRequest, ToolExecution
from app.schemas.chat import CitationSource
from app.services.ai_service import cosine_similarity, generate_completion, get_embedding
from app.services.auth_service import log_auth_event

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

# Deterministic tool access permissions mapping (Security Guard Layer)
ALLOWED_ROLES_FOR_TOOLS = {
    "notify-hr-team": {"Admin", "CEO", "HR Manager", "HR Staff", "Employee"},
    "export-excel": {"Admin", "CEO", "Finance Manager", "Finance Staff"},
    "escalate-ticket": {"Admin", "CEO", "Manager", "Team Lead", "HR Manager", "Finance Manager"},
    "generate-leave-form": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"},
    "math-calculator": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"},
    "create-jira-issue": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"}
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
    request: Request,
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
    
    # 1. Perform context retrieval filtered by agent collection and user permissions
    context_blocks = []
    citations = []
    
    try:
        query_vector = get_embedding(payload.message)
        
        # Build secure document ID lookup query
        if current_user.role.name in ("Admin", "CEO"):
            doc_stmt = select(Document.id)
        else:
            owner_cond = (Document.owner_id == current_user.id)
            org_cond = (Document.default_access == "ORGANIZATION")
            dept_cond = (Document.default_access == "DEPARTMENT") & (Document.department_id == current_user.department_id) if current_user.department_id else False
            team_cond = (Document.default_access == "TEAM") & (Document.team_id == current_user.team_id) if current_user.team_id else False

            subjects = [("USER", current_user.id), ("ROLE", str(current_user.role_id))]
            if current_user.department_id:
                subjects.append(("DEPARTMENT", str(current_user.department_id)))
            if current_user.team_id:
                subjects.append(("TEAM", str(current_user.team_id)))

            clauses = [
                (DocumentPermission.subject_type == s_type) & (DocumentPermission.subject_id == s_id)
                for s_type, s_id in subjects
            ]

            filter_conds = [owner_cond, org_cond, dept_cond, team_cond]

            if clauses:
                explicit_ids = select(DocumentPermission.document_id).where(or_(*clauses))
                filter_conds.append(Document.id.in_(explicit_ids))

            doc_stmt = select(Document.id).where(or_(*filter_conds))

        # Filter by Agent collection bind
        doc_stmt = doc_stmt.where(Document.collection == agent["collection_bind"])
        authorized_doc_ids = db.scalars(doc_stmt).all()

        if authorized_doc_ids:
            statement = select(DocumentChunk).where(DocumentChunk.document_id.in_(authorized_doc_ids))
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
    
    # 2. Inspect keywords and simulate tool calls with security boundaries checks
    tool_calls = []
    timestamp_str = datetime.now().isoformat()
    role_name = current_user.role.name
    
    def process_tool_execution(tool_name: str, success_action: str):
        allowed_roles = ALLOWED_ROLES_FOR_TOOLS.get(tool_name, set())
        ip_addr = request.client.host if request.client else None
        user_agt = request.headers.get("user-agent")

        if role_name in allowed_roles:
            tool_calls.append(
                ToolExecution(
                    tool_name=tool_name,
                    action_taken=success_action,
                    status="SUCCESS",
                    timestamp=timestamp_str
                )
            )
            # Log audit event
            log_auth_event(
                db=db,
                action="AGENT_TOOL_ALLOWED",
                user_id=current_user.id,
                resource_type="AGENT_TOOL",
                resource_id=tool_name,
                result="SUCCESS",
                details=f"Agent '{agent_id}' executed tool '{tool_name}' successfully: '{success_action}'",
                ip_address=ip_addr,
                user_agent=user_agt
            )
        else:
            logger.warning(f"User {current_user.email} (Role: {role_name}) blocked from executing tool: {tool_name}")
            tool_calls.append(
                ToolExecution(
                    tool_name=tool_name,
                    action_taken=f"Access Denied: Role '{role_name}' lacks required capability scope.",
                    status="DENIED",
                    timestamp=timestamp_str
                )
            )
            # Log audit event
            log_auth_event(
                db=db,
                action="AGENT_TOOL_DENIED",
                user_id=current_user.id,
                resource_type="AGENT_TOOL",
                resource_id=tool_name,
                result="DENIED",
                details=f"Agent '{agent_id}' execution of tool '{tool_name}' blocked due to role '{role_name}' restrictions",
                ip_address=ip_addr,
                user_agent=user_agt
            )

    if agent_id == "hr-policy":
        if any(kw in msg_lower for kw in ["notify", "send", "submit", "contact"]):
            process_tool_execution(
                "notify-hr-team",
                f"Sent Slack message to HR channel for {current_user.full_name}"
            )
        if any(kw in msg_lower for kw in ["leave", "vacation", "holiday", "sick"]):
            process_tool_execution(
                "generate-leave-form",
                "Drafted official PDF vacation application form"
            )
            
    elif agent_id == "finance-analyst":
        if any(kw in msg_lower for kw in ["calculate", "sum", "math", "total", "average", "compute"]):
            process_tool_execution(
                "math-calculator",
                "Computed sum totals and verified balance calculations"
            )
        if any(kw in msg_lower for kw in ["export", "excel", "sheet", "csv"]):
            process_tool_execution(
                "export-excel",
                f"Exported Q3 statements database ledger to Excel sheet"
            )
            
    elif agent_id == "support-triage":
        if any(kw in msg_lower for kw in ["escalate", "urgent", "critical", "alert"]):
            process_tool_execution(
                "escalate-ticket",
                "Flagged status to active paging alert for engineering"
            )
        if any(kw in msg_lower for kw in ["create", "jira", "ticket", "bug", "task"]):
            process_tool_execution(
                "create-jira-issue",
                f"Created Jira Issue (NEX-{current_user.id[:4].upper()}) with high priority"
            )
            
    # 3. Formulate persona completion
    system_prompt = (
        f"{agent['system_persona']}\n"
        "Ground your response strictly in the document context blocks below. "
        "Explain any automated tools triggered or denied at the end of the answer.\n\n"
        f"Context information:\n{context_string}"
    )
    
    response_text = generate_completion(system_prompt, payload.message)
    
    return AgentResponse(
        response=response_text,
        tool_calls=tool_calls,
        citations=citations
    )
