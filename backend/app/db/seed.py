"""Database seeding logic for setting up initial roles and permissions."""

import logging
from sqlalchemy.orm import Session
from app.models.auth import Role, Permission

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

# Define default roles and their associated permissions
DEFAULT_ROLES = {
    "Admin": {
        "description": "Full administrator with system-wide management and settings privileges.",
        "permissions": list(DEFAULT_PERMISSIONS.keys())
    },
    "Manager": {
        "description": "Organizational manager who can organize knowledge, upload documents, run analytics, and execute automation.",
        "permissions": [
            "documents:read",
            "documents:create",
            "chat:read",
            "reports:read",
            "automation:run"
        ]
    },
    "Employee": {
        "description": "Standard organizational employee who can query knowledge and read documents.",
        "permissions": [
            "documents:read",
            "chat:read"
        ]
    }
}


def seed_roles_and_permissions(db: Session) -> None:
    """Populates the database with initial permissions and roles if they do not exist."""
    try:
        # 1. Seed Permissions
        permission_objects = {}
        for perm_name, desc in DEFAULT_PERMISSIONS.items():
            perm = db.query(Permission).filter(Permission.name == perm_name).first()
            if not perm:
                logger.info(f"Seeding permission: {perm_name}")
                perm = Permission(name=perm_name, description=desc)
                db.add(perm)
                db.flush()  # Flushes changes to generate IDs immediately
            permission_objects[perm_name] = perm

        # 2. Seed Roles and map Permissions
        for role_name, config in DEFAULT_ROLES.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                logger.info(f"Seeding role: {role_name}")
                role = Role(name=role_name, description=config["description"])
                db.add(role)
                db.flush()

            # Update role permissions to ensure alignment
            role_perms = []
            for perm_name in config["permissions"]:
                role_perms.append(permission_objects[perm_name])
            role.permissions = role_perms
            db.add(role)

        db.commit()
        logger.info("Database seeding of roles and permissions completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding default database entities: {str(e)}")
        raise e
