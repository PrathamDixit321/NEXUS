"""API endpoints for interactive RAG assistant chat operations with strict access control filtering and auditing."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.document import Document, DocumentChunk, DocumentPermission
from app.schemas.chat import ChatRequest, ChatResponse, CitationSource
from app.services.ai_service import cosine_similarity, generate_completion, get_embedding
from app.services.auth_service import log_auth_event

logger = logging.getLogger("nexusai.api.chat")
router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
def query_assistant(
    payload: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Query assistant, fetching only authorized document context chunks to prevent metadata and prompt leaks."""
    try:
        # 1. Get embedding vector for query
        query_vector = get_embedding(payload.message)
        ip_addr = request.client.host if request.client else None
        user_agt = request.headers.get("user-agent")
        
        # 2. Query only authorized document IDs
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

        if payload.collection:
            doc_stmt = doc_stmt.where(Document.collection == payload.collection.strip())

        authorized_doc_ids = db.scalars(doc_stmt).all()

        # If no authorized documents exist, return gracefully without querying vector similarity or leaking info
        if not authorized_doc_ids:
            log_auth_event(
                db=db,
                action="RAG_ACCESS_DENIED",
                user_id=current_user.id,
                resource_type="RAG",
                result="DENIED",
                details=f"Query: '{payload.message[:80]}...' - access denied: no authorized document contexts exist in database matching scope.",
                ip_address=ip_addr,
                user_agent=user_agt
            )
            return ChatResponse(
                response="I don't have access to information that can answer this question.",
                citations=[]
            )

        # 3. Retrieve chunks using production vector store with strict RBAC pre-filtering
        from app.services.vector_store import get_vector_store
        vector_hits = get_vector_store().search(
            query_vector=query_vector,
            authorized_doc_ids=authorized_doc_ids,
            limit=4,
            db=db,
        )

        # 4. Build context prompt blocks & citations
        context_blocks = []
        citations = []

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

        context_string = "\n\n---\n\n".join(context_blocks)

        # Log audit log compliance trace for RAG retrieval
        log_auth_event(
            db=db,
            action="RAG_ACCESS_GRANTED",
            user_id=current_user.id,
            resource_type="RAG",
            result="SUCCESS",
            details=f"Query: '{payload.message[:80]}...' - access granted: matches {len(citations)} citations from {len(authorized_doc_ids)} authorized files.",
            ip_address=ip_addr,
            user_agent=user_agt
        )
        
        # 7. Generate grounded response from LLM service
        system_prompt = (
            "You are Nexus, an enterprise assistant for the workspace. "
            "You answer questions grounded in the provided context documents.\n"
            "If the context is empty or does not contain enough information, state that clearly.\n"
            "Keep answers concise, objective, and reference the source names (e.g. handbook.pdf) where relevant.\n\n"
            f"Context information:\n{context_string}"
        )
        
        response_text = generate_completion(system_prompt, payload.message)
        
        return ChatResponse(
            response=response_text,
            citations=citations
        )
    except Exception as e:
        logger.exception(f"Error executing RAG query: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while answering your query: {e}"
        )
