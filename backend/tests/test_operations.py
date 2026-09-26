"""Unit and integration test suite for Operations Suite (Tasks, Reports, Analytics) and Vector Store."""

from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.seed import seed_roles_and_permissions
from app.models.auth import User, Role, Department, Team, UserSession, AuditLog
from app.models.document import Document, DocumentChunk, DocumentPermission
from app.models.operations import Task, Report
from app.services.vector_store import SQLiteVectorStore, VectorChunk


def setup_test_db() -> None:
    """Resets test database state and seeds standard hierarchy, tasks, and reports."""
    db = SessionLocal()
    try:
        db.query(Task).delete()
        db.query(Report).delete()
        db.query(DocumentPermission).delete()
        db.query(DocumentChunk).delete()
        db.query(Document).delete()
        db.query(UserSession).delete()
        db.query(AuditLog).delete()
        db.query(User).delete()
        db.query(Team).delete()
        db.query(Department).delete()
        db.query(Role).delete()
        db.commit()

        seed_roles_and_permissions(db)
    finally:
        db.close()


def get_auth_headers(client: TestClient, email: str) -> dict:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "securepassword123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_analytics_overview() -> None:
    setup_test_db()
    with TestClient(app) as client:
        headers = get_auth_headers(client, "ceo@nexus.ai")
        res = client.get("/api/v1/analytics/overview", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_documents" in data
        assert "total_tasks" in data
        assert data["total_tasks"] >= 4
        assert "total_reports" in data
        assert data["total_reports"] >= 3
        assert "classification_counts" in data
        assert "collection_counts" in data
        assert "recent_activity" in data


def test_tasks_crud_lifecycle() -> None:
    setup_test_db()
    with TestClient(app) as client:
        headers = get_auth_headers(client, "ceo@nexus.ai")

        # 1. List tasks
        res = client.get("/api/v1/tasks", headers=headers)
        assert res.status_code == 200
        tasks = res.json()
        assert len(tasks) >= 4

        # 2. Create task
        create_payload = {
            "title": "Automate Vector Reindexing",
            "description": "Run periodic Qdrant synchronization pipeline.",
            "priority": "HIGH",
            "status": "TODO",
        }
        res_create = client.post("/api/v1/tasks", json=create_payload, headers=headers)
        assert res_create.status_code == 201
        created_task = res_create.json()
        task_id = created_task["id"]
        assert created_task["title"] == "Automate Vector Reindexing"
        assert created_task["priority"] == "HIGH"

        # 3. Update task status
        res_patch = client.patch(
            f"/api/v1/tasks/{task_id}",
            json={"status": "DONE"},
            headers=headers,
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["status"] == "DONE"

        # 4. Filter tasks by status
        res_filter = client.get("/api/v1/tasks?status=DONE", headers=headers)
        assert res_filter.status_code == 200
        done_tasks = res_filter.json()
        assert any(t["id"] == task_id for t in done_tasks)

        # 5. Delete task
        res_del = client.delete(f"/api/v1/tasks/{task_id}", headers=headers)
        assert res_del.status_code == 204

        # 6. Verify deleted
        res_get = client.get(f"/api/v1/tasks/{task_id}", headers=headers)
        assert res_get.status_code == 404


def test_reports_lifecycle_and_generation() -> None:
    setup_test_db()
    with TestClient(app) as client:
        headers = get_auth_headers(client, "ceo@nexus.ai")

        # 1. List reports
        res = client.get("/api/v1/reports", headers=headers)
        assert res.status_code == 200
        reports = res.json()
        assert len(reports) >= 3

        # 2. Generate Compliance Audit Report
        gen_payload = {
            "report_type": "COMPLIANCE_AUDIT",
            "custom_notes": "Live quarterly system compliance inspection.",
        }
        res_gen = client.post("/api/v1/reports/generate", json=gen_payload, headers=headers)
        assert res_gen.status_code == 201
        gen_report = res_gen.json()
        assert "Compliance Security Audit" in gen_report["title"]
        assert gen_report["status"] == "PUBLISHED"
        assert gen_report["content"] is not None

        # 3. View report details
        rep_id = gen_report["id"]
        res_view = client.get(f"/api/v1/reports/{rep_id}", headers=headers)
        assert res_view.status_code == 200
        assert res_view.json()["id"] == rep_id

        # 4. Delete report
        res_del = client.delete(f"/api/v1/reports/{rep_id}", headers=headers)
        assert res_del.status_code == 204


def test_vector_store_rbac_prefiltering() -> None:
    """Verify that vector store searches strictly adhere to authorized_doc_ids bounds."""
    store = SQLiteVectorStore()
    dummy_query = [0.1] * 768

    # When authorized_doc_ids is empty list, search must immediately return empty
    results_empty = store.search(
        query_vector=dummy_query,
        authorized_doc_ids=[],
        limit=5,
    )
    assert results_empty == []
