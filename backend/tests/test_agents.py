"""Tests verifying AI Agent profile retrieval, query RAG searches, and tool execution logging."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.auth import AuditLog, User, UserSession


def clear_db() -> None:
    """Helper to clear test tables ensuring database isolation."""
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


def test_agent_profiles_and_execution_pipeline() -> None:
    """Register account, get active agent profiles, execute queries, and check tool call triggers."""
    clear_db()
    
    with TestClient(app) as client:
        # 1. Register a test user
        reg_payload = {
            "email": "agent.tester@nexus.ai",
            "password": "securepassword123",
            "full_name": "Agent Systems Engineer",
            "department": "Engineering",
            "company_name": "NexusAI Inc."
        }
        reg_res = client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get list of configured agents
        list_res = client.get("/api/v1/agents", headers=headers)
        assert list_res.status_code == 200
        agents = list_res.json()
        assert len(agents) == 3
        agent_names = [a["name"] for a in agents]
        assert "HR Policy Assistant" in agent_names
        assert "Finance Analyst" in agent_names
        
        # 3. Execute query on HR Policy Assistant triggering leave tools
        query_vector = [0.0] * 768
        mock_completion = "I have noted your vacation request."
        
        with patch("app.api.agents.get_embedding", return_value=query_vector) as mock_embed, \
             patch("app.api.agents.generate_completion", return_value=mock_completion) as mock_complete:
                 
            run_payload = {
                "message": "I want to submit a leave request for next week, notify HR."
            }
            run_res = client.post("/api/v1/agents/hr-policy/run", json=run_payload, headers=headers)
            
            assert run_res.status_code == 200
            data = run_res.json()
            assert data["response"] == mock_completion
            
            # Verify simulated tool triggers (both Slack notification and leave form)
            tools = [t["tool_name"] for t in data["tool_calls"]]
            assert "notify-hr-team" in tools
            assert "generate-leave-form" in tools
            assert data["tool_calls"][0]["status"] == "SUCCESS"
            
            mock_embed.assert_called_once()
            mock_complete.assert_called_once()
            
        # 4. Execute query on Finance Analyst triggering calculator tool
        with patch("app.api.agents.get_embedding", return_value=query_vector), \
             patch("app.api.agents.generate_completion", return_value="The calculated sum matches."):
                 
            finance_payload = {
                "message": "Please calculate the total sum of this year's budget."
            }
            finance_res = client.post("/api/v1/agents/finance-analyst/run", json=finance_payload, headers=headers)
            
            assert finance_res.status_code == 200
            f_data = finance_res.json()
            f_tools = [t["tool_name"] for t in f_data["tool_calls"]]
            assert "math-calculator" in f_tools
