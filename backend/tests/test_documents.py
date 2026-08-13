from fastapi.testclient import TestClient

from app.main import app


def test_upload_and_list_document() -> None:
    with TestClient(app) as client:
        upload = client.post(
            "/api/v1/documents",
            data={"collection": "Product"},
            files={"file": ("roadmap.pdf", b"demo document", "application/pdf")},
        )

        assert upload.status_code == 201
        created = upload.json()
        assert created["name"] == "roadmap.pdf"
        assert created["collection"] == "Product"
        assert created["status"] == "ready"

        listed = client.get("/api/v1/documents", params={"query": "roadmap"})
        assert listed.status_code == 200
        assert any(document["id"] == created["id"] for document in listed.json())


def test_rejects_unsupported_document_type() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/documents",
            files={"file": ("notes.txt", b"not supported", "text/plain")},
        )

    assert response.status_code == 415
