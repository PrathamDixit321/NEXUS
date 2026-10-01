"""Database seeding logic for setting up initial roles, permissions, departments, teams, and user hierarchy."""

import json
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.auth import Role, Permission, Department, Team, User
from app.models.operations import Task, Report
from app.models.automation import Workflow, WorkflowRun, ApiKey
from app.services.automation_service import hash_api_key
from app.core.security import get_password_hash

logger = logging.getLogger("nexusai")

# Define default permissions
DEFAULT_PERMISSIONS = {
    "users:manage": "Allows full user management, editing profiles and modifying system roles.",
    "documents:read": "Allows reading organization documents.",
    "documents:create": "Allows uploading and creating new documents.",
    "documents:delete": "Allows deleting existing organization documents.",
    "chat:read": "Allows using the enterprise AI chat workspace.",
    "reports:read": "Allows reading business intelligence reports and analytics.",
    "automation:run": "Allows executing custom AI agent and n8n automations."
}

# Define default roles mapping to the company hierarchy and domain partitions
DEFAULT_ROLES = {
    "Admin": {
        "description": "System Administrator with full system-wide permissions.",
        "permissions": list(DEFAULT_PERMISSIONS.keys())
    },
    "CEO": {
        "description": "Chief Executive Officer with complete organizational authority.",
        "permissions": list(DEFAULT_PERMISSIONS.keys())
    },
    "Manager": {
        "description": "Department/General Manager with administrative and analytics permissions.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read",
            "reports:read",
            "automation:run"
        ]
    },
    "Team Lead": {
        "description": "Team leader guiding core task-execution processes.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read"
        ]
    },
    "Employee": {
        "description": "Standard employee authorized to query chat and read standard documents.",
        "permissions": [
            "documents:read",
            "chat:read"
        ]
    },
    "HR Manager": {
        "description": "HR Administrator with management permissions restricted to HR scopes.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read",
            "reports:read",
            "automation:run"
        ]
    },
    "HR Staff": {
        "description": "HR Staff helper executing standard HR procedures.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read"
        ]
    },
    "Finance Manager": {
        "description": "Finance Administrator governing organizational financial planning.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read",
            "reports:read",
            "automation:run"
        ]
    },
    "Finance Staff": {
        "description": "Finance Specialist managing accounting audits.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read"
        ]
    }
}


def seed_roles_and_permissions(db: Session) -> None:
    """Populates the database with initial permissions, roles, departments, teams, and hierarchical users."""
    try:
        # 1. Seed Permissions
        permission_objects = {}
        for perm_name, desc in DEFAULT_PERMISSIONS.items():
            perm = db.query(Permission).filter(Permission.name == perm_name).first()
            if not perm:
                logger.info(f"Seeding permission: {perm_name}")
                perm = Permission(name=perm_name, description=desc)
                db.add(perm)
                db.flush()
            permission_objects[perm_name] = perm

        # 2. Seed Roles and map Permissions
        for role_name, config in DEFAULT_ROLES.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                logger.info(f"Seeding role: {role_name}")
                role = Role(name=role_name, description=config["description"])
                db.add(role)
                db.flush()

            # Update permissions
            role_perms = []
            for perm_name in config["permissions"]:
                role_perms.append(permission_objects[perm_name])
            role.permissions = role_perms
            db.add(role)
        db.flush()

        # 3. Seed Departments
        departments_data = [
            {"name": "Executive", "code": "EXE"},
            {"name": "Engineering", "code": "ENG"},
            {"name": "Human Resources", "code": "HR"},
            {"name": "Finance", "code": "FIN"}
        ]
        dept_objects = {}
        for d in departments_data:
            dept = db.query(Department).filter(Department.code == d["code"]).first()
            if not dept:
                logger.info(f"Seeding department: {d['name']} ({d['code']})")
                dept = Department(name=d["name"], code=d["code"])
                db.add(dept)
                db.flush()
            dept_objects[d["code"]] = dept

        # 4. Seed Teams
        teams_data = [
            {"dept_code": "ENG", "name": "Core RAG Team"},
            {"dept_code": "ENG", "name": "Frontend UI Team"},
            {"dept_code": "HR", "name": "HR Operations"},
            {"dept_code": "HR", "name": "Recruiting"},
            {"dept_code": "FIN", "name": "Treasury"},
            {"dept_code": "FIN", "name": "Accounting"}
        ]
        team_objects = {}
        for t in teams_data:
            dept = dept_objects[t["dept_code"]]
            team = db.query(Team).filter(Team.name == t["name"], Team.department_id == dept.id).first()
            if not team:
                logger.info(f"Seeding team: {t['name']}")
                team = Team(name=t["name"], department_id=dept.id)
                db.add(team)
                db.flush()
            team_objects[t["name"]] = team

        # 5. Seed Hierarchical Users
        users_data = [
            {
                "email": "ceo@nexus.ai",
                "full_name": "Alice CEO",
                "role_name": "CEO",
                "dept_code": "EXE",
                "team_name": None,
                "manager_email": None
            },
            {
                "email": "hr.manager@nexus.ai",
                "full_name": "Bob HR Manager",
                "role_name": "HR Manager",
                "dept_code": "HR",
                "team_name": "HR Operations",
                "manager_email": "ceo@nexus.ai"
            },
            {
                "email": "hr.staff@nexus.ai",
                "full_name": "Charlie HR Staff",
                "role_name": "HR Staff",
                "dept_code": "HR",
                "team_name": "HR Operations",
                "manager_email": "hr.manager@nexus.ai"
            },
            {
                "email": "finance.manager@nexus.ai",
                "full_name": "David Finance Manager",
                "role_name": "Finance Manager",
                "dept_code": "FIN",
                "team_name": "Treasury",
                "manager_email": "ceo@nexus.ai"
            },
            {
                "email": "finance.staff@nexus.ai",
                "full_name": "Eve Finance Staff",
                "role_name": "Finance Staff",
                "dept_code": "FIN",
                "team_name": "Treasury",
                "manager_email": "finance.manager@nexus.ai"
            },
            {
                "email": "eng.manager@nexus.ai",
                "full_name": "Frank Engineering Manager",
                "role_name": "Manager",
                "dept_code": "ENG",
                "team_name": "Core RAG Team",
                "manager_email": "ceo@nexus.ai"
            },
            {
                "email": "eng.lead@nexus.ai",
                "full_name": "Grace Engineering Lead",
                "role_name": "Team Lead",
                "dept_code": "ENG",
                "team_name": "Core RAG Team",
                "manager_email": "eng.manager@nexus.ai"
            },
            {
                "email": "eng.employee@nexus.ai",
                "full_name": "Henry Engineering Employee",
                "role_name": "Employee",
                "dept_code": "ENG",
                "team_name": "Core RAG Team",
                "manager_email": "eng.lead@nexus.ai"
            }
        ]

        # First pass: Create users without manager_id to avoid circular foreign key mapping issues
        user_objects = {}
        hashed_password = get_password_hash("securepassword123")
        for u in users_data:
            user = db.query(User).filter(User.email == u["email"]).first()
            role = db.query(Role).filter(Role.name == u["role_name"]).first()
            dept = dept_objects[u["dept_code"]] if u["dept_code"] else None
            team = team_objects[u["team_name"]] if u["team_name"] else None
            
            if not user:
                logger.info(f"Seeding user: {u['full_name']} ({u['email']})")
                user = User(
                    email=u["email"],
                    hashed_password=hashed_password,
                    full_name=u["full_name"],
                    role_id=role.id,
                    department_id=dept.id if dept else None,
                    team_id=team.id if team else None,
                    company_name="NexusAI Inc.",
                    is_active=True
                )
                db.add(user)
                db.flush()
            user_objects[u["email"]] = user

        # Second pass: Associate managers
        for u in users_data:
            if u["manager_email"]:
                user = user_objects[u["email"]]
                manager = user_objects.get(u["manager_email"])
                if manager and user.manager_id != manager.id:
                    logger.info(f"Mapping manager for {user.full_name} -> {manager.full_name}")
                    user.manager_id = manager.id
                    db.add(user)

        # Seed Operational Tasks
        admin_user = user_objects.get("ceo@nexus.ai")
        tasks_data = [
            {
                "title": "Review Executive Q3 Access Audit",
                "description": "Review quarterly document access patterns, blocked privilege escalations, and audit trace logs.",
                "status": "IN_PROGRESS",
                "priority": "HIGH",
                "assigned_email": "eng.manager@nexus.ai",
                "days_due": 1,
                "resource_type": "AUDIT",
            },
            {
                "title": "Approve HR Leave Workflow Schema",
                "description": "Validate n8n integration parameters for automated leave balance synchronization.",
                "status": "TODO",
                "priority": "MEDIUM",
                "assigned_email": "hr.manager@nexus.ai",
                "days_due": 2,
                "resource_type": "WORKFLOW",
            },
            {
                "title": "Audit Restricted Financial Ledger Access",
                "description": "Verify employee clearances on confidential Q3 finance budget spreadsheets.",
                "status": "TODO",
                "priority": "URGENT",
                "assigned_email": "finance.manager@nexus.ai",
                "days_due": 0,
                "resource_type": "DOCUMENT",
            },
            {
                "title": "Update Department Knowledge Base",
                "description": "Re-index engineering architecture guides and system blueprint documents.",
                "status": "DONE",
                "priority": "LOW",
                "assigned_email": "eng.lead@nexus.ai",
                "days_due": -2,
                "resource_type": "DOCUMENT",
            },
        ]

        for t in tasks_data:
            existing_task = db.query(Task).filter(Task.title == t["title"]).first()
            if not existing_task:
                assigned_user = user_objects.get(t["assigned_email"])
                due = datetime.utcnow() + timedelta(days=t["days_due"])
                task = Task(
                    title=t["title"],
                    description=t["description"],
                    status=t["status"],
                    priority=t["priority"],
                    assigned_to_id=assigned_user.id if assigned_user else None,
                    created_by_id=admin_user.id if admin_user else None,
                    due_date=due,
                    related_resource_type=t["resource_type"],
                )
                db.add(task)

        # Seed Operational Reports
        reports_data = [
            {
                "title": "Q3 Workspace Compliance & Security Audit",
                "description": "Full organizational audit of document permissions, unauthorized access blocks, and role changes.",
                "report_type": "COMPLIANCE_AUDIT",
                "status": "PUBLISHED",
                "content": json.dumps({
                    "summary": "Audited 1,450 operations across 6 departments. Zero unauthorized privilege escalations detected.",
                    "access_governance_score": 98.4,
                    "blocked_attempts_count": 14,
                    "top_accessed_collections": ["Engineering", "Product", "People & policies"],
                    "recommendation": "Rotate n8n service API keys every 90 days and verify employee-to-manager inheritance."
                }),
            },
            {
                "title": "Executive Document Intelligence Summary",
                "description": "Consolidated overview of knowledge base growth, ingestion throughput, and RAG query response health.",
                "report_type": "EXECUTIVE_SUMMARY",
                "status": "PUBLISHED",
                "content": json.dumps({
                    "summary": "Knowledge base ingestion grew by 24% month-over-month. Average vector retrieval latency is 18ms.",
                    "total_documents_ingested": 18,
                    "avg_rag_relevance_score": 0.89,
                    "recommendation": "Expand automated OCR ingestion to support multi-page scanned financial statements."
                }),
            },
            {
                "title": "Access Control Matrix Review",
                "description": "Periodic evaluation of department-scoped permissions and private sharing grants.",
                "report_type": "ACCESS_CONTROL",
                "status": "DRAFT",
                "content": json.dumps({
                    "summary": "Draft review identifying 3 documents with legacy organization-wide sharing.",
                    "flagged_documents_count": 3,
                    "recommendation": "Restrict legacy HR salary documents from ORGANIZATION to DEPARTMENT visibility."
                }),
            },
        ]

        for r in reports_data:
            existing_rep = db.query(Report).filter(Report.title == r["title"]).first()
            if not existing_rep:
                report = Report(
                    title=r["title"],
                    description=r["description"],
                    report_type=r["report_type"],
                    status=r["status"],
                    generated_by_id=admin_user.id if admin_user else None,
                    content=r["content"],
                )
                db.add(report)

        # Seed Automation Workflows
        workflows_data = [
            {
                "title": "Email → Support Triage Ticket",
                "description": "Ingest customer support inquiry emails, classify urgency with AI, and route tickets.",
                "trigger_type": "WEBHOOK",
                "webhook_slug": "whk_support_email_triage",
                "status": "ACTIVE",
                "action_type": "EXECUTE_AGENT_TASK",
                "action_target": "support-triage",
                "total_runs": 312,
            },
            {
                "title": "Weekly Executive Brief Synthesizer",
                "description": "Compile departmental analytics, document ingestion metrics, and compliance logs into an executive brief.",
                "trigger_type": "SCHEDULE",
                "webhook_slug": "whk_exec_brief_synth",
                "status": "ACTIVE",
                "action_type": "GENERATE_REPORT",
                "action_target": "executive-ops",
                "total_runs": 48,
            },
            {
                "title": "Automated PII Redaction & Document Classifier",
                "description": "Triggered upon new document uploads to scan for sensitive PII and auto-assign security clearance.",
                "trigger_type": "DOCUMENT_UPLOAD",
                "webhook_slug": "whk_pii_redaction_guard",
                "status": "ACTIVE",
                "action_type": "EXECUTE_AGENT_TASK",
                "action_target": "document-classifier",
                "total_runs": 124,
            },
            {
                "title": "n8n Customer Onboarding Sync",
                "description": "Synchronize employee workspace credentials and provision department access bundles via n8n.",
                "trigger_type": "TRIGGER_N8N",
                "webhook_slug": "whk_n8n_customer_sync",
                "status": "ACTIVE",
                "action_type": "TRIGGER_N8N",
                "action_target": "https://n8n.internal.nexus/webhook/onboarding",
                "total_runs": 96,
            },
            {
                "title": "Security Access Violation Alert",
                "description": "Notify security officer and create high-priority operational tasks when access is denied 3+ times.",
                "trigger_type": "AGENT_ACTION",
                "webhook_slug": "whk_sec_alert_manager",
                "status": "ACTIVE",
                "action_type": "NOTIFY_MANAGER",
                "action_target": "compliance-officer",
                "total_runs": 15,
            },
            {
                "title": "Legacy Data Warehouse Ingestion",
                "description": "Nightly batch synchronization with legacy PostgreSQL analytical tables.",
                "trigger_type": "SCHEDULE",
                "webhook_slug": "whk_legacy_warehouse_sync",
                "status": "PAUSED",
                "action_type": "SYNC_EXTERNAL_CRM",
                "action_target": "PostgreSQL-DWH",
                "total_runs": 22,
            },
        ]

        seeded_workflows = []
        for wf_data in workflows_data:
            existing_wf = db.query(Workflow).filter(Workflow.title == wf_data["title"]).first()
            if not existing_wf:
                wf = Workflow(
                    title=wf_data["title"],
                    description=wf_data["description"],
                    trigger_type=wf_data["trigger_type"],
                    webhook_slug=wf_data["webhook_slug"],
                    status=wf_data["status"],
                    action_type=wf_data["action_type"],
                    action_target=wf_data["action_target"],
                    total_runs=wf_data["total_runs"],
                    created_by_id=admin_user.id if admin_user else None,
                )
                db.add(wf)
                db.flush()
                seeded_workflows.append(wf)
            else:
                seeded_workflows.append(existing_wf)

        # Seed initial execution runs
        if seeded_workflows:
            first_wf = seeded_workflows[0]
            existing_run = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == first_wf.id).first()
            if not existing_run:
                run1 = WorkflowRun(
                    workflow_id=first_wf.id,
                    status="SUCCESS",
                    triggered_by="Webhook (n8n Engine)",
                    trigger_source="WEBHOOK",
                    execution_duration_ms=48,
                    payload_summary=json.dumps({"ticket_id": "TICK-4921", "customer": "Acme Corp", "priority": "P1"}),
                    logs=f"Pipeline '{first_wf.title}' dispatched to support-triage.\nAgent classified urgency as P1.\nRouting ticket to tier-2 on-call engineer.\nOutcome: Success.",
                )
                run2 = WorkflowRun(
                    workflow_id=first_wf.id,
                    status="SUCCESS",
                    triggered_by="admin@nexus.ai",
                    trigger_source="MANUAL",
                    execution_duration_ms=62,
                    payload_summary=json.dumps({"test_run": True, "initiated_by": "Administrator"}),
                    logs="Manual test execution triggered via Workspace UI.\nAll validation checks passed.",
                )
                db.add_all([run1, run2])

        # Seed S2S API Key for n8n
        existing_key = db.query(ApiKey).filter(ApiKey.name == "n8n Production Integration").first()
        if not existing_key:
            demo_raw_key = "nx_live_n8n_prod_secret_integration_token_99x"
            demo_hashed = hash_api_key(demo_raw_key)
            api_key = ApiKey(
                name="n8n Production Integration",
                key_prefix="nx_live_n8n_...",
                hashed_key=demo_hashed,
                role="Admin",
                is_active=True,
                created_by_id=admin_user.id if admin_user else None,
            )
            db.add(api_key)

        db.commit()
        logger.info("Database seeding of roles, departments, teams, users, tasks, reports, and workflows completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding default database entities: {str(e)}")
        raise e
