"""Tests verifying RAG query embeddings match, document similarity retrieval, and chat completion API."""

import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.auth import AuditLog, User, UserSession
from app.models.chat import ChatSession, ChatMessage
from app.models.document import Document, DocumentChunk


def clear_db() -> None:
    """Helper to wipe workspace tables before RAG search pipeline verification."""
    db = SessionLocal()
    try:
        db.query(ChatMessage).delete()
        db.query(ChatSession).delete()
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
            user = db.query(User).filter(User.email == "tester@nexus.ai").first()
            doc = Document(
                name="corporate_security.pdf",
                collection="Security",
                content_type="application/pdf",
                size_bytes=1024,
                storage_key="corp_security.pdf",
                owner_id=user.id,
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


def test_chat_sessions_lifecycle() -> None:
    """Verify chat session creation, listing, messaging with persistence, update, and deletion."""
    clear_db()

    with TestClient(app) as client:
        # 1. Register test user
        reg_payload = {
            "email": "chatuser@nexus.ai",
            "password": "securepassword123",
            "full_name": "Chat Specialist",
            "department": "Engineering",
            "company_name": "NexusAI Inc."
        }
        reg_res = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Initially sessions list is empty
        list_res = client.get("/api/v1/chat/sessions", headers=headers)
        assert list_res.status_code == 200
        assert len(list_res.json()) == 0

        # 3. Create a new session
        create_payload = {
            "title": "New Conversation",
            "collection": "HR"
        }
        create_res = client.post("/api/v1/chat/sessions", json=create_payload, headers=headers)
        assert create_res.status_code == 201
        session_data = create_res.json()
        session_id = session_data["id"]
        assert session_data["title"] == "New Conversation"
        assert session_data["collection"] == "HR"
        assert len(session_data["messages"]) == 0

        # 4. Post message into session
        with patch("app.api.chat.get_embedding", return_value=[0.0] * 768), \
             patch("app.api.chat.generate_completion", return_value="Here is your HR policy explanation."):

            msg_payload = {
                "message": "What is our leave policy for vacation?",
                "session_id": session_id
            }
            chat_res = client.post("/api/v1/chat", json=msg_payload, headers=headers)
            assert chat_res.status_code == 200
            chat_data = chat_res.json()
            assert chat_data["session_id"] == session_id
            assert chat_data["response"] != ""

        # 5. Fetch session details and verify auto-titling and persisted messages
        get_res = client.get(f"/api/v1/chat/sessions/{session_id}", headers=headers)
        assert get_res.status_code == 200
        detail_data = get_res.json()
        assert detail_data["id"] == session_id
        # Title auto-updated from query
        assert "leave policy" in detail_data["title"].lower()
        # Has user message and assistant message
        assert len(detail_data["messages"]) == 2
        assert detail_data["messages"][0]["role"] == "user"
        assert detail_data["messages"][0]["content"] == "What is our leave policy for vacation?"
        assert detail_data["messages"][1]["role"] == "assistant"

        # 6. Rename session
        patch_res = client.patch(
            f"/api/v1/chat/sessions/{session_id}",
            json={"title": "Custom Vacation Title", "collection": "General"},
            headers=headers
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["title"] == "Custom Vacation Title"
        assert patch_res.json()["collection"] == "General"

        # 7. Delete session
        del_res = client.delete(f"/api/v1/chat/sessions/{session_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # 8. Fetching deleted session returns 404
        nf_res = client.get(f"/api/v1/chat/sessions/{session_id}", headers=headers)
        assert nf_res.status_code == 404

