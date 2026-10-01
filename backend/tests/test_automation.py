"""Unit and integration test suite for Workflow Automation, Execution Runs, Webhooks, and S2S API Keys."""

from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Base, SessionLocal, engine
from app.db.seed import seed_roles_and_permissions
from app.models.auth import User, Role, Department, Team, UserSession, AuditLog
from app.models.automation import Workflow, WorkflowRun, ApiKey


def setup_test_db() -> None:
    """Resets test database state and seeds standard hierarchy and automation workflows."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(WorkflowRun).delete()
        db.query(Workflow).delete()
        db.query(ApiKey).delete()
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


def test_automation_stats_and_workflows_listing() -> None:
    setup_test_db()
    with TestClient(app) as client:
        headers = get_auth_headers(client, "ceo@nexus.ai")

        # Test stats
        res = client.get("/api/v1/automation/stats", headers=headers)
        assert res.status_code == 200
        stats = res.json()
        assert stats["active_workflows"] >= 5
        assert "success_rate_percent" in stats
        assert "total_runs_today" in stats

        # Test workflow listing
        res = client.get("/api/v1/automation/workflows", headers=headers)
        assert res.status_code == 200
        workflows = res.json()
        assert len(workflows) >= 6
        titles = [w["title"] for w in workflows]
        assert "Email → Support Triage Ticket" in titles
        assert "Weekly Executive Brief Synthesizer" in titles


def test_workflow_lifecycle_and_manual_run() -> None:
    setup_test_db()
    with TestClient(app) as client:
        headers = get_auth_headers(client, "ceo@nexus.ai")

        # 1. Create a custom workflow
        create_res = client.post(
            "/api/v1/automation/workflows",
            headers=headers,
            json={
                "title": "Incident Escalation Pager",
                "description": "Trigger PagerDuty alert and assign urgent operational task to engineering lead.",
                "trigger_type": "WEBHOOK",
                "status": "ACTIVE",
                "action_type": "NOTIFY_MANAGER",
                "action_target": "compliance-officer",
            }
        )
        assert create_res.status_code == 201
        wf = create_res.json()
        wf_id = wf["id"]
        slug = wf["webhook_slug"]
        assert slug.startswith("whk_")

        # 2. Toggle status to PAUSED
        patch_res = client.patch(
            f"/api/v1/automation/workflows/{wf_id}/status",
            headers=headers,
            json={"status": "PAUSED"}
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == "PAUSED"

        # 3. Toggle back to ACTIVE
        patch_res2 = client.patch(
            f"/api/v1/automation/workflows/{wf_id}/status",
            headers=headers,
            json={"status": "ACTIVE"}
        )
        assert patch_res2.status_code == 200
        assert patch_res2.json()["status"] == "ACTIVE"

        # 4. Trigger manual test run
        run_res = client.post(
            f"/api/v1/automation/workflows/{wf_id}/run",
            headers=headers,
            json={"payload": {"service": "Auth-Gateway", "severity": "CRITICAL"}}
        )
        assert run_res.status_code == 200
        run_data = run_res.json()
        assert run_data["status"] == "SUCCESS"
        assert run_data["trigger_source"] == "MANUAL"
        assert run_data["workflow_id"] == wf_id
        assert run_data["execution_duration_ms"] > 0

        # 5. List runs and verify entry
        runs_res = client.get("/api/v1/automation/runs", headers=headers)
        assert runs_res.status_code == 200
        runs = runs_res.json()
        assert any(r["id"] == run_data["id"] for r in runs)


def test_webhook_ingestion_and_api_key_security() -> None:
    setup_test_db()
    with TestClient(app) as client:
        admin_headers = get_auth_headers(client, "ceo@nexus.ai")

        # 1. Fetch existing workflow slug
        wf_res = client.get("/api/v1/automation/workflows", headers=admin_headers)
        active_wf = next(w for w in wf_res.json() if w["status"] == "ACTIVE")
        slug = active_wf["webhook_slug"]

        # 2. Public / open webhook call without API key
        wh_res = client.post(
            f"/api/v1/automation/webhooks/{slug}",
            json={"event": "customer_support_request", "requester": "customer@client.com"}
        )
        assert wh_res.status_code == 200
        wh_data = wh_res.json()
        assert wh_data["status"] == "SUCCESS"
        assert wh_data["triggered_by"] == "External Webhook"
        assert wh_data["trigger_source"] == "WEBHOOK"

        # 3. Generate a new S2S API Key for n8n
        key_res = client.post(
            "/api/v1/automation/api-keys",
            headers=admin_headers,
            json={"name": "n8n Production Orchestrator", "role": "Admin"}
        )
        assert key_res.status_code == 201
        key_data = key_res.json()
        raw_token = key_data["token"]
        key_id = key_data["id"]
        assert raw_token.startswith("nx_live_")

        # 4. Call webhook with valid X-API-Key header
        wh_auth_res = client.post(
            f"/api/v1/automation/webhooks/{slug}",
            headers={"X-API-Key": raw_token},
            json={"n8n_flow": "deploy_success", "env": "prod"}
        )
        assert wh_auth_res.status_code == 200
        assert "n8n Production Orchestrator" in wh_auth_res.json()["triggered_by"]

        # 5. Delete / Revoke API key
        del_key_res = client.delete(f"/api/v1/automation/api-keys/{key_id}", headers=admin_headers)
        assert del_key_res.status_code == 204

        # 6. Call webhook with revoked key -> should fail with 401 Unauthorized
        wh_fail_res = client.post(
            f"/api/v1/automation/webhooks/{slug}",
            headers={"X-API-Key": raw_token},
            json={"event": "should_fail"}
        )
        assert wh_fail_res.status_code == 401
