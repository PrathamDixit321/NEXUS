"""Tests verifying RAG query embeddings match, document similarity retrieval, and chat completion API."""

import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.auth import AuditLog, User, UserSession
from app.models.document import Document, DocumentChunk


def clear_db() -> None:
    """Helper to wipe workspace tables before RAG search pipeline verification."""
    db = SessionLocal()
    try:
        db.query(DocumentChunk).delete()
        db.query(Document).delete()
        db.query(UserSession).delete()
        db.query(AuditLog).delete()
        db.query(User).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_chat_rag_pipeline_and_citations() -> None:
    """Register account, seed document vector chunk, query chat and check similarity threshold and citations."""
    clear_db()
    
    with TestClient(app) as client:
        # 1. Register a test user
        reg_payload = {
            "email": "tester@nexus.ai",
            "password": "securepassword123",
            "full_name": "RAG Verification Engineer",
            "department": "Security",
            "company_name": "NexusAI Inc."
        }
        reg_res = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Seed document and database chunks with unit vector embeddings
        db = SessionLocal()
        try:
            doc = Document(
                name="corporate_security.pdf",
                collection="Security",
                content_type="application/pdf",
                size_bytes=1024,
                storage_key="corp_security.pdf",
                status="ready"
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)
            
            # Unit vector with 1.0 in position 0, rest 0.0
            seeded_vector = [0.0] * 768
            seeded_vector[0] = 1.0
            
            chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=0,
                content="Corporate policy mandates using multi-factor authentication (MFA) on all admin credentials.",
                page_number=3,
                embedding_json=json.dumps(seeded_vector)
            )
            db.add(chunk)
            db.commit()
        finally:
            db.close()
            
        # 3. Query RAG Chat API mocking get_embedding to return a matching vector
        query_vector = [0.0] * 768
        query_vector[0] = 0.98  # Highly similar to our seeded chunk
        
        mock_response = "According to corporate policy, multi-factor authentication (MFA) must be used on admin credentials."
        
        with patch("app.api.chat.get_embedding", return_value=query_vector) as mock_embed, \
             patch("app.api.chat.generate_completion", return_value=mock_response) as mock_complete:
                 
            chat_payload = {
                "message": "What is the policy for admin credentials?",
                "collection": "Security"
            }
            
            response = client.post("/api/v1/chat", json=chat_payload, headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert data["response"] == mock_response
            
            # 4. Check citations
            citations = data["citations"]
            assert len(citations) > 0
            assert citations[0]["document_name"] == "corporate_security.pdf"
            assert citations[0]["page_number"] == 3
            assert citations[0]["similarity"] > 0.95  # Similarity should be ~0.98
            
            mock_embed.assert_called_once_with("What is the policy for admin credentials?")
            # Completion should have been called with system prompt containing context and user prompt
            mock_complete.assert_called_once()
