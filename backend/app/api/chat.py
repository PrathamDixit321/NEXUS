"""API endpoints for interactive RAG assistant chat operations."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.document import Document, DocumentChunk
from app.schemas.chat import ChatRequest, ChatResponse, CitationSource
from app.services.ai_service import cosine_similarity, generate_completion, get_embedding

logger = logging.getLogger("nexusai.api.chat")
router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
def query_assistant(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Query assistant, fetching vector matched context and generating response with citations."""
    try:
        # 1. Get embedding vector for query
        query_vector = get_embedding(payload.message)
        
        # 2. Fetch chunks from database
        statement = select(DocumentChunk)
        if payload.collection:
            statement = statement.join(Document).where(Document.collection == payload.collection.strip())
            
        chunks = db.scalars(statement).all()
        
        # 3. Calculate cosine similarity
        scored_chunks = []
        for chunk in chunks:
            if not chunk.embedding_json:
                continue
            try:
                chunk_vector = json.loads(chunk.embedding_json)
                sim = cosine_similarity(query_vector, chunk_vector)
                scored_chunks.append((chunk, sim))
            except Exception as e:
                logger.error(f"Error parsing embedding for chunk {chunk.id}: {e}")
                
        # 4. Sort and select top chunks (k=4)
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        top_chunks = scored_chunks[:4]
        
        # 5. Build context prompt blocks
        context_blocks = []
        citations = []
        
        for chunk, sim in top_chunks:
            # Only include chunks that have a minimal positive similarity
            if sim > 0.05:
                context_blocks.append(f"[Source: {chunk.document.name} (Page {chunk.page_number})]\n{chunk.content}")
                citations.append(
                    CitationSource(
                        document_name=chunk.document.name,
                        page_number=chunk.page_number,
                        similarity=round(sim, 3)
                    )
                )
                
        context_string = "\n\n---\n\n".join(context_blocks)
        
        # 6. Generate grounded response from LLM service
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
