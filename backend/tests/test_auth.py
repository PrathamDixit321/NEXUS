"""Integration and unit tests verifying database-backed Authentication and RBAC endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.database import SessionLocal
from app.models.auth import User, Role, UserSession, AuditLog


def clear_db() -> None:
    """Helper to clear test-related tables from the database to ensure test run isolation."""
    db = SessionLocal()
    try:
        db.query(UserSession).delete()
        db.query(AuditLog).delete()
        db.query(User).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_auth_registration_and_login_flow() -> None:
    """Verifies that registration generates accounts and tokens, duplicate registration is rejected, and login succeeds."""
    clear_db()
    with TestClient(app) as client:
        # 1. Register a new user
        reg_payload = {
            "email": "tester@nexus.ai",
            "password": "securepassword123",
            "full_name": "Test Engineer",
            "department": "QA & Testing",
            "company_name": "NexusAI Inc."
        }
        
        response = client.post("/api/v1/auth/register", json=reg_payload)
        assert response.status_code == 201
        
        reg_data = response.json()
        assert "access_token" in reg_data
        assert "refresh_token" in reg_data
        assert reg_data["user"]["email"] == "tester@nexus.ai"
        assert reg_data["user"]["role"] == "Employee"  # Default registration role
        
        # 2. Reject duplicate email registration
        dup_response = client.post("/api/v1/auth/register", json=reg_payload)
        assert dup_response.status_code == 400
        assert "already registered" in dup_response.json()["detail"].lower()

        # 3. Authenticate with correct credentials
        login_payload = {
            "email": "tester@nexus.ai",
            "password": "securepassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_payload)
        assert login_response.status_code == 200
        
        login_data = login_response.json()
        assert "access_token" in login_data
        assert "refresh_token" in login_data
        assert login_data["user"]["full_name"] == "Test Engineer"

        # 4. Reject invalid login credentials
        bad_login = {
            "email": "tester@nexus.ai",
            "password": "wrongpassword"
        }
        bad_response = client.post("/api/v1/auth/login", json=bad_login)
        assert bad_response.status_code == 401
        assert "incorrect email" in bad_response.json()["detail"].lower()


def test_profile_retrieval_and_update() -> None:
    """Verifies profile endpoint updates, retrieves profile data, and enforces JWT authorization."""
    clear_db()
    with TestClient(app) as client:
        # Register user to get token
        reg_payload = {
            "email": "profile.tester@nexus.ai",
            "password": "securepassword123",
            "full_name": "Profile Tester"
        }
        reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_resp.status_code == 201
        access_token = reg_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        # 1. Fetch Profile
        prof_resp = client.get("/api/v1/auth/profile", headers=headers)
        assert prof_resp.status_code == 200
        assert prof_resp.json()["full_name"] == "Profile Tester"

        # 2. Enforce JWT protection
        no_auth_resp = client.get("/api/v1/auth/profile")
        assert no_auth_resp.status_code == 401

        # 3. Update Profile
        update_payload = {
            "full_name": "Updated Profile Tester",
            "department": "Engineering Operations",
            "company_name": "NexusAI Enterprise"
        }
        update_resp = client.put("/api/v1/auth/profile", json=update_payload, headers=headers)
        assert update_resp.status_code == 200
        updated_data = update_resp.json()
        assert updated_data["full_name"] == "Updated Profile Tester"
        assert updated_data["department"] == "Engineering Operations"
        assert updated_data["company_name"] == "NexusAI Enterprise"


def test_session_refresh_and_logout_lifecycle() -> None:
    """Verifies refresh token rotation, token expiry/revocation, and logout execution."""
    clear_db()
    with TestClient(app) as client:
        reg_payload = {
            "email": "session.tester@nexus.ai",
            "password": "securepassword123",
            "full_name": "Session Tester"
        }
        reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_resp.status_code == 201
        
        reg_data = reg_resp.json()
        refresh_token = reg_data["refresh_token"]

        # 1. Refresh token successfully
        refresh_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert refresh_resp.status_code == 200
        new_data = refresh_resp.json()
        assert "access_token" in new_data
        assert "refresh_token" in new_data
        
        new_refresh_token = new_data["refresh_token"]
        assert new_refresh_token != refresh_token  # Verify rotation occurred

        # 2. Verify rotated token is revoked and cannot be reused
        reused_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert reused_resp.status_code == 401

        # 3. Logout successfully
        logout_resp = client.post("/api/v1/auth/logout", json={"refresh_token": new_refresh_token})
        assert logout_resp.status_code == 200
        assert logout_resp.json()["message"] == "Session logged out successfully."

        # 4. Verify logged-out refresh token is revoked
        post_logout_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh_token})
        assert post_logout_resp.status_code == 401


def test_database_rbac_association_seeding() -> None:
    """Verifies that default roles and permission relationships are seeded correctly in the database."""
    with TestClient(app):
        # Open database session to inspect seeded metadata
        db: Session = SessionLocal()
        try:
            # 1. Verify roles exist
            admin_role = db.query(Role).filter(Role.name == "Admin").first()
            manager_role = db.query(Role).filter(Role.name == "Manager").first()
            employee_role = db.query(Role).filter(Role.name == "Employee").first()
            
            assert admin_role is not None
            assert manager_role is not None
            assert employee_role is not None
            
            # 2. Verify permission scopes
            admin_perms = {p.name for p in admin_role.permissions}
            manager_perms = {p.name for p in manager_role.permissions}
            employee_perms = {p.name for p in employee_role.permissions}
            
            assert "users:manage" in admin_perms
            assert "documents:create" in admin_perms
            assert "documents:delete" in admin_perms
            
            assert "users:manage" not in manager_perms
            assert "documents:create" in manager_perms
            assert "documents:delete" not in manager_perms
            
            assert "documents:create" not in employee_perms
            assert "chat:read" in employee_perms
        finally:
            db.close()
