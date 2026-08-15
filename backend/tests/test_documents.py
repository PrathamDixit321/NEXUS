from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app


def test_upload_and_list_document() -> None:
    with TestClient(app) as client:
        # Mock extract_text to return dummy pages instead of trying to parse invalid binary PDF
        with patch("app.services.document_service.extract_text", return_value=[(1, "demo document page 1 text content\n\nwith some more text here for chunking.")]) as mock_extract:
            # 1. Post document (initial status should be "processing")
            upload = client.post(
                "/api/v1/documents",
                data={"collection": "Product"},
                files={"file": ("roadmap.pdf", b"demo document", "application/pdf")},
            )

            assert upload.status_code == 201
            created = upload.json()
            assert created["name"] == "roadmap.pdf"
            assert created["collection"] == "Product"
            assert created["status"] == "processing"

            # 2. Get document by ID (FastAPI test client executes background tasks before returning)
            get_doc = client.get(f"/api/v1/documents/{created['id']}")
            assert get_doc.status_code == 200
            assert get_doc.json()["status"] == "ready"

            # 3. List documents and check if it is included
            listed = client.get("/api/v1/documents", params={"query": "roadmap"})
            assert listed.status_code == 200
            assert any(document["id"] == created["id"] for document in listed.json())

            # 4. Get chunks of the document
            chunks_res = client.get(f"/api/v1/documents/{created['id']}/chunks")
            assert chunks_res.status_code == 200
            chunks = chunks_res.json()
            assert len(chunks) > 0
            assert chunks[0]["document_id"] == created["id"]
            # Since pypdf parses the dummy bytes, let's verify chunk index starts at 0
            assert chunks[0]["chunk_index"] == 0
            
            mock_extract.assert_called_once()


def test_rejects_unsupported_document_type() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/documents",
            files={"file": ("notes.txt", b"not supported", "text/plain")},
        )

    assert response.status_code == 415

