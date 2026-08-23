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


def test_enterprise_access_control_system() -> None:
    """Comprehensive test validating role-based sharing bounds, listing isolation, and secure downloads."""
    setup_test_db()
    
    with TestClient(app) as client:
        # Obtain auth headers for target personas
        ceo_hdrs = get_auth_headers(client, "ceo@nexus.ai")
        hr_mgr_hdrs = get_auth_headers(client, "hr.manager@nexus.ai")
        fin_mgr_hdrs = get_auth_headers(client, "finance.manager@nexus.ai")
        emp_hdrs = get_auth_headers(client, "eng.employee@nexus.ai")

        # Extract CEO user model to assert sharing
        db = SessionLocal()
        try:
            ceo_user = db.query(User).filter(User.email == "ceo@nexus.ai").first()
            emp_user = db.query(User).filter(User.email == "eng.employee@nexus.ai").first()
            fin_staff = db.query(User).filter(User.email == "finance.staff@nexus.ai").first()
            ceo_id = ceo_user.id
            emp_id = emp_user.id
            fin_staff_id = fin_staff.id
        finally:
            db.close()

        # Mock background processing to bypass file indexing
        with patch("app.services.document_service.extract_text", return_value=[(1, "demo content")]) as mock_extract:

            # ----------------------------------------------------
            # TEST 1: CEO uploads CEO restricted private document
            # ----------------------------------------------------
            up_ceo = client.post(
                "/api/v1/documents",
                data={"collection": "Executive", "default_access": "PRIVATE", "classification": "RESTRICTED"},
                files={"file": ("ceo_strategy.pdf", b"ceo content", "application/pdf")},
                headers=ceo_hdrs
            )
            assert up_ceo.status_code == 201
            ceo_doc = up_ceo.json()

            # CEO can access it
            get_ceo = client.get(f"/api/v1/documents/{ceo_doc['id']}", headers=ceo_hdrs)
            assert get_ceo.status_code == 200

            # Employee cannot access (should return 404 to hide resource existence)
            get_ceo_emp = client.get(f"/api/v1/documents/{ceo_doc['id']}", headers=emp_hdrs)
            assert get_ceo_emp.status_code == 404

            # ----------------------------------------------------
            # TEST 2: Finance Manager uploads Finance department document
            # ----------------------------------------------------
            up_fin = client.post(
                "/api/v1/documents",
                data={"collection": "Finance", "default_access": "DEPARTMENT", "classification": "CONFIDENTIAL"},
                files={"file": ("q3_audit.pdf", b"finance audit", "application/pdf")},
                headers=fin_mgr_hdrs
            )
            assert up_fin.status_code == 201
            fin_doc = up_fin.json()

            # Finance Manager can access
            get_fin = client.get(f"/api/v1/documents/{fin_doc['id']}", headers=fin_mgr_hdrs)
            assert get_fin.status_code == 200

            # HR Manager cannot access (belongs to a different department)
            get_fin_hr = client.get(f"/api/v1/documents/{fin_doc['id']}", headers=hr_mgr_hdrs)
            assert get_fin_hr.status_code == 404

            # Employee cannot access
            get_fin_emp = client.get(f"/api/v1/documents/{fin_doc['id']}", headers=emp_hdrs)
            assert get_fin_emp.status_code == 404

            # ----------------------------------------------------
            # TEST 3: Employee uploads document with organization visibility
            # ----------------------------------------------------
            up_emp = client.post(
                "/api/v1/documents",
                data={"collection": "Engineering", "default_access": "ORGANIZATION", "classification": "INTERNAL"},
                files={"file": ("vacation_policy.pdf", b"vacation details", "application/pdf")},
                headers=emp_hdrs
            )
            assert up_emp.status_code == 201
            emp_doc = up_emp.json()

            # Employee can access
            get_emp_self = client.get(f"/api/v1/documents/{emp_doc['id']}", headers=emp_hdrs)
            assert get_emp_self.status_code == 200

            # CEO can access (due to ORGANIZATION scope)
            get_emp_ceo = client.get(f"/api/v1/documents/{emp_doc['id']}", headers=ceo_hdrs)
            assert get_emp_ceo.status_code == 200

            # ----------------------------------------------------
            # TEST 4: Employee cannot grant unauthorized access levels
            # ----------------------------------------------------
            up_invalid = client.post(
                "/api/v1/documents",
                data={"collection": "Engineering", "default_access": "ROLE_HIERARCHY", "classification": "INTERNAL"},
                files={"file": ("restricted_employee.pdf", b"content", "application/pdf")},
                headers=emp_hdrs
            )
            assert up_invalid.status_code == 403

            # ----------------------------------------------------
            # TEST 5: Manager can share within authorized scope
            # ----------------------------------------------------
            # Finance Manager uploads private document
            up_priv = client.post(
                "/api/v1/documents",
                data={"collection": "Finance", "default_access": "PRIVATE", "classification": "INTERNAL"},
                files={"file": ("q3_ledger.pdf", b"ledger logs", "application/pdf")},
                headers=fin_mgr_hdrs
            )
            assert up_priv.status_code == 201
            priv_doc = up_priv.json()

            # Share with Finance Staff (within scope)
            share_payload = {
                "default_access": "PRIVATE",
                "classification": "INTERNAL",
                "permissions": [
                    {
                        "subject_type": "USER",
                        "subject_id": fin_staff_id,
                        "permission_type": "VIEW"
                    }
                ]
            }
            share_res = client.post(
                f"/api/v1/documents/{priv_doc['id']}/permissions",
                json=share_payload,
                headers=fin_mgr_hdrs
            )
            assert share_res.status_code == 200

            # Share with Employee (outside scope for Finance department)
            share_invalid_payload = {
                "default_access": "PRIVATE",
                "classification": "INTERNAL",
                "permissions": [
                    {
                        "subject_type": "USER",
                        "subject_id": emp_id,
                        "permission_type": "VIEW"
                    }
                ]
            }
            share_invalid_res = client.post(
                f"/api/v1/documents/{priv_doc['id']}/permissions",
                json=share_invalid_payload,
                headers=fin_mgr_hdrs
            )
            assert share_invalid_res.status_code == 403

            # ----------------------------------------------------
            # TEST 6: Listings and search query filters
            # ----------------------------------------------------
            # Listing call as Employee should ONLY return vacation_policy.pdf
            list_emp = client.get("/api/v1/documents", headers=emp_hdrs)
            assert list_emp.status_code == 200
            emp_docs = [d["name"] for d in list_emp.json()]
            assert "vacation_policy.pdf" in emp_docs
            assert "ceo_strategy.pdf" not in emp_docs
            assert "q3_audit.pdf" not in emp_docs

            # Search query filters
            search_emp = client.get("/api/v1/documents", params={"query": "audit"}, headers=emp_hdrs)
            assert search_emp.status_code == 200
            assert len(search_emp.json()) == 0

            # ----------------------------------------------------
            # TEST 7: Secure download restriction
            # ----------------------------------------------------
            # Employee attempts download on ceo strategy doc
            dl_err = client.get(f"/api/v1/documents/{ceo_doc['id']}/download", headers=emp_hdrs)
            assert dl_err.status_code == 404

            # ----------------------------------------------------
            # TEST 8: n8n integration using System API Key
            # ----------------------------------------------------
            n8n_headers = {"x-api-key": "nexus_secret_service_api_key_123"}
            list_n8n = client.get("/api/v1/documents", headers=n8n_headers)
            assert list_n8n.status_code == 200
            n8n_docs = [d["name"] for d in list_n8n.json()]
            assert "vacation_policy.pdf" in n8n_docs
            assert "ceo_strategy.pdf" in n8n_docs
            assert "q3_audit.pdf" in n8n_docs

            # ----------------------------------------------------
            # TEST 9: Agent tool deterministic permission guards
            # ----------------------------------------------------
            # Run Finance Analyst Excel export tool as Employee (Blocked!)
            agent_res_emp = client.post(
                "/api/v1/agents/finance-analyst/run",
                json={"message": "Please export the statements to Excel."},
                headers=emp_hdrs
            )
            assert agent_res_emp.status_code == 200
            tools_emp = agent_res_emp.json()["tool_calls"]
            assert len(tools_emp) > 0
            assert tools_emp[0]["tool_name"] == "export-excel"
            assert tools_emp[0]["status"] == "DENIED"

            # Run Finance Analyst Excel export tool as Finance Manager (Allowed!)
            agent_res_fin = client.post(
                "/api/v1/agents/finance-analyst/run",
                json={"message": "Please export the statements to Excel."},
                headers=fin_mgr_hdrs
            )
            assert agent_res_fin.status_code == 200
            tools_fin = agent_res_fin.json()["tool_calls"]
            assert len(tools_fin) > 0
            assert tools_fin[0]["tool_name"] == "export-excel"
            assert tools_fin[0]["status"] == "SUCCESS"
