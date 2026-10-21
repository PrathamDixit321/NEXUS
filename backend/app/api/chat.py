"""API endpoints for interactive RAG assistant chat operations with strict access control filtering, session history, and auditing."""

from datetime import UTC, datetime
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.chat import ChatSession, ChatMessage
from app.models.document import Document, DocumentChunk, DocumentPermission
from app.schemas.chat import (
    ChatMessageRead,
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionSummary,
    ChatSessionUpdate,
    CitationSource,
)
from app.services.ai_service import cosine_similarity, generate_completion, get_embedding
from app.services.auth_service import log_auth_event

logger = logging.getLogger("nexusai.api.chat")
router = APIRouter(prefix="/chat", tags=["Chat"])


def _format_message(msg: ChatMessage) -> ChatMessageRead:
    """Helper to convert ChatMessage model to ChatMessageRead schema with parsed citations."""
    citations_list: List[CitationSource] = []
    if msg.citations_json:
        try:
            raw_citations = json.loads(msg.citations_json)
            if isinstance(raw_citations, list):
                citations_list = [CitationSource(**c) for c in raw_citations]
        except Exception:
            citations_list = []

    return ChatMessageRead(
        id=msg.id,
        role=msg.role,
        content=msg.content,
        citations=citations_list,
        created_at=msg.created_at.isoformat() if msg.created_at else "",
    )


def _format_session_detail(session: ChatSession) -> ChatSessionDetail:
    """Helper to format full ChatSessionDetail with ordered messages."""
    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        collection=session.collection,
        created_at=session.created_at.isoformat() if session.created_at else "",
        updated_at=session.updated_at.isoformat() if session.updated_at else "",
        messages=[_format_message(m) for m in session.messages],
    )


@router.get("/sessions", response_model=List[ChatSessionSummary])
def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatSessionSummary]:
    """List all persistent chat conversations belonging to the current user."""
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = db.scalars(stmt).all()
    return [
        ChatSessionSummary(
            id=s.id,
            title=s.title,
            collection=s.collection,
            created_at=s.created_at.isoformat() if s.created_at else "",
            updated_at=s.updated_at.isoformat() if s.updated_at else "",
            message_count=len(s.messages),
        )
        for s in sessions
    ]


@router.post("/sessions", response_model=ChatSessionDetail, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSessionDetail:
    """Initialize a new persistent conversation thread."""
    session = ChatSession(
        user_id=current_user.id,
        title=payload.title.strip() if payload.title else "New Conversation",
        collection=payload.collection.strip() if payload.collection else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _format_session_detail(session)


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSessionDetail:
    """Fetch complete conversation history for a given session."""
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )
    return _format_session_detail(session)


@router.patch("/sessions/{session_id}", response_model=ChatSessionDetail)
def update_chat_session(
    session_id: str,
    payload: ChatSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSessionDetail:
    """Rename conversation title or change target domain collection scope."""
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )

    if payload.title is not None:
        session.title = payload.title.strip() or "Untitled Conversation"
    if payload.collection is not None:
        session.collection = payload.collection.strip() or None

    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return _format_session_detail(session)


@router.delete("/sessions/{session_id}")
def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a chat session and all attached messages."""
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )

    db.delete(session)
    db.commit()
    return {"status": "deleted", "id": session_id}


@router.post("", response_model=ChatResponse)
def query_assistant(
    payload: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Query assistant, fetching only authorized document context chunks and persisting in session if requested."""
    try:
        session: Optional[ChatSession] = None
        if payload.session_id:
            session = db.get(ChatSession, payload.session_id)
            if not session or session.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified chat session not found",
                )

        # 1. Determine collection filter (payload overrides session default)
        effective_collection = payload.collection
        if not effective_collection and session and session.collection:
            effective_collection = session.collection

        # 2. Persist user message if session is active
        if session:
            user_msg = ChatMessage(
                session_id=session.id,
                role="user",
                content=payload.message,
            )
            db.add(user_msg)
            # Auto-title session if it's currently default
            if session.title in ("New Conversation", "Untitled Conversation"):
                cleaned_title = payload.message.strip()
                if len(cleaned_title) > 42:
                    cleaned_title = cleaned_title[:40] + "..."
                session.title = cleaned_title
            session.updated_at = datetime.now(UTC)
            db.commit()

        # 3. Get embedding vector for query
        query_vector = get_embedding(payload.message)
        ip_addr = request.client.host if request.client else None
        user_agt = request.headers.get("user-agent")

        # 4. Query only authorized document IDs
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

        if effective_collection:
            doc_stmt = doc_stmt.where(Document.collection == effective_collection.strip())

        authorized_doc_ids = db.scalars(doc_stmt).all()

        # If no authorized documents exist, return gracefully without leaking info
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
            fallback_text = "I don't have access to information that can answer this question in your authorized documents."
            asst_msg_id = None
            if session:
                asst_msg = ChatMessage(
                    session_id=session.id,
                    role="assistant",
                    content=fallback_text,
                    citations_json=None,
                )
                db.add(asst_msg)
                session.updated_at = datetime.now(UTC)
                db.commit()
                db.refresh(asst_msg)
                asst_msg_id = asst_msg.id

            return ChatResponse(
                response=fallback_text,
                citations=[],
                session_id=session.id if session else None,
                message_id=asst_msg_id,
            )

        # 5. Retrieve chunks using vector store with strict RBAC pre-filtering
        from app.services.vector_store import get_vector_store
        vector_hits = get_vector_store().search(
            query_vector=query_vector,
            authorized_doc_ids=authorized_doc_ids,
            limit=4,
            db=db,
        )

        # 6. Build context prompt blocks & citations
        context_blocks = []
        citations: List[CitationSource] = []

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

        # 8. Save assistant response to session if active
        asst_msg_id = None
        if session:
            serialized_citations = json.dumps([c.model_dump() for c in citations])
            asst_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=response_text,
                citations_json=serialized_citations,
            )
            db.add(asst_msg)
            session.updated_at = datetime.now(UTC)
            db.commit()
            db.refresh(asst_msg)
            asst_msg_id = asst_msg.id

        return ChatResponse(
            response=response_text,
            citations=citations,
            session_id=session.id if session else None,
            message_id=asst_msg_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error executing RAG query: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while answering your query: {e}"
        )
