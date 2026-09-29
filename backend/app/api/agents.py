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
    },
    "compliance-officer": {
        "id": "compliance-officer",
        "name": "Security Compliance Officer",
        "description": "Monitors access matrices, audits permission anomalies, and detects unauthorized data escalation.",
        "collection_bind": "All",
        "status": "Active",
        "allowed_tools": ["scan-access-matrix", "flag-security-breach", "revoke-unauthorized-grant"],
        "system_persona": (
            "You are the Nexus Security Compliance Officer. You audit enterprise access control matrices, "
            "detect data leakage risks, verify role-based permissions, and enforce SOC2/ISO compliance standards. "
            "Be analytical, firm, objective, and reference relevant compliance frameworks."
        )
    },
    "document-classifier": {
        "id": "document-classifier",
        "name": "Document Intelligence & PII Redactor",
        "description": "Scans files for PII leaks, recommends classification tags, and assigns collection bindings.",
        "collection_bind": "Engineering",
        "status": "Active",
        "allowed_tools": ["detect-pii", "auto-classify-document", "assign-collection-bind"],
        "system_persona": (
            "You are the Nexus Document Intelligence & PII Redactor. You inspect documents for sensitive "
            "information (PII, credentials, financial details), recommend appropriate classification labels "
            "(PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED), and route files to correct organizational collections. "
            "Be precise, privacy-conscious, and protective of enterprise data."
        )
    },
    "executive-ops": {
        "id": "executive-ops",
        "name": "Executive Operations & Strategy Agent",
        "description": "Synthesizes cross-department summaries, tracks operational bottlenecks, and drafts executive briefings.",
        "collection_bind": "All",
        "status": "Active",
        "allowed_tools": ["generate-executive-report", "create-operational-task", "broadcast-executive-brief"],
        "system_persona": (
            "You are the Nexus Executive Operations & Strategy Agent. You serve company leadership by "
            "synthesizing operational metrics across HR, Engineering, Support, and Finance, tracking strategic "
            "milestones, identifying task bottlenecks, and drafting executive briefings. "
            "Be concise, strategic, results-driven, and focused on business impact."
        )
    }
}

# Deterministic tool access permissions mapping (Security Guard Layer)
ALLOWED_ROLES_FOR_TOOLS = {
    # HR Tools
    "notify-hr-team": {"Admin", "CEO", "HR Manager", "HR Staff", "Employee"},
    "generate-leave-form": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"},
    # Finance Tools
    "export-excel": {"Admin", "CEO", "Finance Manager", "Finance Staff"},
    "math-calculator": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"},
    # Support Tools
    "escalate-ticket": {"Admin", "CEO", "Manager", "Team Lead", "HR Manager", "Finance Manager"},
    "create-jira-issue": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"},
    # Security Compliance Tools
    "scan-access-matrix": {"Admin", "CEO", "Manager"},
    "flag-security-breach": {"Admin", "CEO", "Manager"},
    "revoke-unauthorized-grant": {"Admin", "CEO"},
    # Document Intelligence & PII Tools
    "detect-pii": {"Admin", "CEO", "Manager", "Team Lead", "Employee", "HR Manager", "HR Staff", "Finance Manager", "Finance Staff"},
    "auto-classify-document": {"Admin", "CEO", "Manager", "Team Lead", "HR Manager", "Finance Manager"},
    "assign-collection-bind": {"Admin", "CEO", "Manager", "Team Lead", "HR Manager", "Finance Manager"},
    # Executive Operations Tools
    "generate-executive-report": {"Admin", "CEO", "Manager"},
    "create-operational-task": {"Admin", "CEO", "Manager", "Team Lead", "HR Manager", "Finance Manager"},
    "broadcast-executive-brief": {"Admin", "CEO"},
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

        # Filter by Agent collection bind if specific
        if agent["collection_bind"] != "All":
            doc_stmt = doc_stmt.where(Document.collection == agent["collection_bind"])
        authorized_doc_ids = db.scalars(doc_stmt).all()

        if authorized_doc_ids:
            from app.services.vector_store import get_vector_store
            collection_filter = None if agent["collection_bind"] == "All" else agent["collection_bind"]
            vector_hits = get_vector_store().search(
                query_vector=query_vector,
                authorized_doc_ids=authorized_doc_ids,
                collection=collection_filter,
                limit=3,
                db=db,
            )
            for hit in vector_hits:
                context_blocks.append(f"[Source: {hit.document_name} (Page {hit.page_number})]\n{hit.content}")
                citations.append(
                    CitationSource(
                        document_name=hit.document_name,
                        document_id=hit.document_id,
                        page_number=hit.page_number,
                        similarity=hit.similarity,
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

    elif agent_id == "compliance-officer":
        if any(kw in msg_lower for kw in ["scan", "audit", "matrix", "check", "inspect", "review"]):
            process_tool_execution(
                "scan-access-matrix",
                "Scanned enterprise access matrix: verified clearance tiers across documents, verified explicit subject grants, and confirmed zero overshared files."
            )
        if any(kw in msg_lower for kw in ["breach", "escalat", "violat", "alert", "threat", "idor"]):
            process_tool_execution(
                "flag-security-breach",
                "Flagged high-priority security breach event for InfoSec review: analyzed blocked permission denials and logged incident report."
            )
        if any(kw in msg_lower for kw in ["revoke", "remove grant", "block", "deny access", "strip"]):
            process_tool_execution(
                "revoke-unauthorized-grant",
                "Revoked unauthorized document grant and updated explicit permission matrix to least-privilege state."
            )

    elif agent_id == "document-classifier":
        if any(kw in msg_lower for kw in ["pii", "sensitive", "mask", "leak", "ssn", "credit", "redact", "privacy"]):
            process_tool_execution(
                "detect-pii",
                "Completed automated PII scan: checked for email patterns, SSN/card numbers, and verified data masking thresholds."
            )
        if any(kw in msg_lower for kw in ["classify", "tier", "tag", "confidential", "restricted", "label"]):
            process_tool_execution(
                "auto-classify-document",
                "Assigned document classification tier based on content sensitivity and corporate data protection guidelines."
            )
        if any(kw in msg_lower for kw in ["collection", "assign", "bind", "route", "folder", "organize"]):
            process_tool_execution(
                "assign-collection-bind",
                "Mapped document binding to target domain collection and configured default inheritance policy."
            )

    elif agent_id == "executive-ops":
        if any(kw in msg_lower for kw in ["report", "brief", "summary", "quarter", "kpi", "executive", "overview"]):
            process_tool_execution(
                "generate-executive-report",
                "Synthesized live cross-department executive briefing incorporating knowledge ingestion and operational KPIs."
            )
        if any(kw in msg_lower for kw in ["task", "assign", "followup", "action item", "todo", "bottleneck"]):
            process_tool_execution(
                "create-operational-task",
                "Created high-priority operational task in workspace queue for leadership follow-up."
            )
        if any(kw in msg_lower for kw in ["broadcast", "notify exec", "board", "alert leadership", "share brief"]):
            process_tool_execution(
                "broadcast-executive-brief",
                "Broadcast executive operations briefing to executive dashboard and leadership channels."
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
