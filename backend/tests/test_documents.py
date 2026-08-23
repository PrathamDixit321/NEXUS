from unittest.mock import patch
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.auth import User, UserSession, AuditLog
from app.models.document import Document, DocumentChunk, DocumentPermission


def clear_db() -> None:
    """Helper to clear test tables ensuring database isolation."""
    db = SessionLocal()
    try:
        db.query(DocumentPermission).delete()
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


def test_upload_and_list_document() -> None:
    clear_db()
    with TestClient(app) as client:
        # Register user to get token
        reg_payload = {
            "email": "uploader@nexus.ai",
            "password": "securepassword123",
            "full_name": "Test Uploader",
            "department": "Engineering"
        }
        reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_resp.status_code == 201
        token = reg_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Mock extract_text to return dummy pages instead of trying to parse invalid binary PDF
        with patch("app.services.document_service.extract_text", return_value=[(1, "demo document page 1 text content\n\nwith some more text here for chunking.")]) as mock_extract:
            # 1. Post document (initial status should be "processing")
            upload = client.post(
                "/api/v1/documents",
                data={"collection": "Product", "default_access": "ORGANIZATION", "classification": "INTERNAL"},
                files={"file": ("roadmap.pdf", b"demo document", "application/pdf")},
                headers=headers
            )

            assert upload.status_code == 201
            created = upload.json()
            assert created["name"] == "roadmap.pdf"
            assert created["collection"] == "Product"
            assert created["status"] == "processing"

            # 2. Get document by ID (FastAPI test client executes background tasks before returning)
            get_doc = client.get(f"/api/v1/documents/{created['id']}", headers=headers)
            assert get_doc.status_code == 200
            assert get_doc.json()["status"] == "ready"

            # 3. List documents and check if it is included
            listed = client.get("/api/v1/documents", params={"query": "roadmap"}, headers=headers)
            assert listed.status_code == 200
            assert any(document["id"] == created["id"] for document in listed.json())

            # 4. Get chunks of the document
            chunks_res = client.get(f"/api/v1/documents/{created['id']}/chunks", headers=headers)
            assert chunks_res.status_code == 200
            chunks = chunks_res.json()
            assert len(chunks) > 0
            assert chunks[0]["document_id"] == created["id"]
            # Verify chunk index starts at 0
            assert chunks[0]["chunk_index"] == 0
            
            mock_extract.assert_called_once()


def test_rejects_unsupported_document_type() -> None:
    clear_db()
    with TestClient(app) as client:
        # Register user to get token
        reg_payload = {
            "email": "reject.tester@nexus.ai",
            "password": "securepassword123",
            "full_name": "Reject Tester"
        }
        reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_resp.status_code == 201
        token = reg_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/api/v1/documents",
            files={"file": ("notes.txt", b"not supported", "text/plain")},
            headers=headers
        )

    assert response.status_code == 415
