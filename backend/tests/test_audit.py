from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.seed import seed_roles_and_permissions
from app.models.auth import User, Role, Department, Team, UserSession, AuditLog
from app.models.document import Document, DocumentChunk, DocumentPermission


def setup_test_db() -> None:
    """Wipes test database and seeds default role hierarchy and user directories."""
    db = SessionLocal()
    try:
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
        
        # Populate standard structure
        seed_roles_and_permissions(db)
    finally:
        db.close()


def get_auth_headers(client: TestClient, email: str) -> dict:
    """Helper to login user and return JWT bearer token header."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "securepassword123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_compliance_audit_logs_system() -> None:
    """Validates audit trail logging for document uploads, views, access breaches, and admin controls."""
    setup_test_db()

    with TestClient(app) as client:
        # Obtain auth headers
        ceo_hdrs = get_auth_headers(client, "ceo@nexus.ai")
        emp_hdrs = get_auth_headers(client, "eng.employee@nexus.ai")

        # ----------------------------------------------------
        # TEST 1: Role protection verification on GET /admin/audit-logs
        # ----------------------------------------------------
        # Standard employee should be blocked
        log_emp_res = client.get("/api/v1/admin/audit-logs", headers=emp_hdrs)
        assert log_emp_res.status_code == 403

        # CEO should be allowed
        log_ceo_res = client.get("/api/v1/admin/audit-logs", headers=ceo_hdrs)
        assert log_ceo_res.status_code == 200

        # Mock background processing to bypass file indexing
        with patch("app.services.document_service.extract_text", return_value=[(1, "demo content")]) as mock_extract:

            # ----------------------------------------------------
            # TEST 2: Upload registers DOCUMENT_UPLOADED audit log
            # ----------------------------------------------------
            up_res = client.post(
                "/api/v1/documents",
                data={"collection": "Engineering", "default_access": "ORGANIZATION", "classification": "INTERNAL"},
                files={"file": ("engineering_manual.pdf", b"manual details", "application/pdf")},
                headers=emp_hdrs
            )
            assert up_res.status_code == 201
            doc_id = up_res.json()["id"]

            # Query audit log as CEO to confirm upload was logged
            log_list_res = client.get("/api/v1/admin/audit-logs", params={"action": "DOCUMENT_UPLOADED"}, headers=ceo_hdrs)
            assert log_list_res.status_code == 200
            logs = log_list_res.json()
            assert len(logs) > 0
            
            # Verify uploader attributes
            upload_log = logs[0]
            assert upload_log["action"] == "DOCUMENT_UPLOADED"
            assert upload_log["resource_type"] == "DOCUMENT"
            assert upload_log["resource_id"] == doc_id
            assert upload_log["result"] == "SUCCESS"
            assert "engineering_manual.pdf" in upload_log["details"]
            assert upload_log["user_email"] == "eng.employee@nexus.ai"

            # ----------------------------------------------------
            # TEST 3: Access breaches register PERMISSION_DENIED audit log
            # ----------------------------------------------------
            # CEO uploads a private strategy document
            up_ceo = client.post(
                "/api/v1/documents",
                data={"collection": "Executive", "default_access": "PRIVATE", "classification": "RESTRICTED"},
                files={"file": ("ceo_confidential.pdf", b"ceo records", "application/pdf")},
                headers=ceo_hdrs
            )
            assert up_ceo.status_code == 201
            ceo_doc_id = up_ceo.json()["id"]

            # Employee attempts view on CEO strategy doc (Blocked!)
            view_err = client.get(f"/api/v1/documents/{ceo_doc_id}", headers=emp_hdrs)
            assert view_err.status_code == 404  # standard returns 404 to obscure file existence

            # Query audit log as CEO to confirm breach attempt was logged
            log_denied_res = client.get("/api/v1/admin/audit-logs", params={"action": "PERMISSION_DENIED"}, headers=ceo_hdrs)
            assert log_denied_res.status_code == 200
            denied_logs = log_denied_res.json()
            assert len(denied_logs) > 0

            denied_log = denied_logs[0]
            assert denied_log["action"] == "PERMISSION_DENIED"
            assert denied_log["resource_type"] == "DOCUMENT"
            assert denied_log["resource_id"] == ceo_doc_id
            assert denied_log["result"] == "DENIED"
            assert "Access denied" in denied_log["details"]
            assert denied_log["user_email"] == "eng.employee@nexus.ai"
