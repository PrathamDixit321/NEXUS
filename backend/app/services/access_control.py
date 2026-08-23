"""Enterprise Document Access Control services enforcing RBAC/ABAC sharing boundaries and permission checks."""

import logging
from typing import List, Optional, Set, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.auth import User, Role, Department, Team
from app.models.document import Document, DocumentPermission

logger = logging.getLogger("nexusai.access_control")

# Hierarchy mapping of permissions: higher permissions imply lower ones
PERMISSION_HIERARCHY = {
    "DELETE": {"DELETE", "EDIT", "SHARE", "DOWNLOAD", "VIEW"},
    "EDIT": {"EDIT", "DOWNLOAD", "VIEW"},
    "SHARE": {"SHARE", "VIEW"},
    "DOWNLOAD": {"DOWNLOAD", "VIEW"},
    "VIEW": {"VIEW"},
}


def get_user_effective_permissions(user: User, document: Document, db: Session) -> Set[str]:
    """Calculates all effective document permissions for a user including ownership, defaults, and overrides."""
    # 1. System administrators and CEOs override all checks
    if user.role.name in ("Admin", "CEO"):
        return {"VIEW", "DOWNLOAD", "EDIT", "SHARE", "DELETE"}

    # 2. Document owner has full rights
    if document.owner_id == user.id:
        return {"VIEW", "DOWNLOAD", "EDIT", "SHARE", "DELETE"}

    effective_perms: Set[str] = set()

    # 3. Evaluate Default Access visibility policy
    if document.default_access == "ORGANIZATION":
        effective_perms.update({"VIEW", "DOWNLOAD"})
    elif document.default_access == "DEPARTMENT" and document.department_id is not None:
        if user.department_id == document.department_id:
            effective_perms.update({"VIEW", "DOWNLOAD"})
    elif document.default_access == "TEAM" and document.team_id is not None:
        if user.team_id == document.team_id:
            effective_perms.update({"VIEW", "DOWNLOAD"})

    # 4. Query explicit overriding permissions in the document_permissions table
    subjects = [
        ("USER", user.id),
        ("ROLE", str(user.role_id)),
    ]
    if user.department_id is not None:
        subjects.append(("DEPARTMENT", str(user.department_id)))
    if user.team_id is not None:
        subjects.append(("TEAM", str(user.team_id)))

    # Construct clauses
    clauses = [
        (DocumentPermission.subject_type == s_type) & (DocumentPermission.subject_id == s_id)
        for s_type, s_id in subjects
    ]
    
    if clauses:
        explicit_grants = db.query(DocumentPermission).filter(
            DocumentPermission.document_id == document.id,
            or_(*clauses)
        ).all()

        for grant in explicit_grants:
            implied = PERMISSION_HIERARCHY.get(grant.permission_type, {grant.permission_type})
            effective_perms.update(implied)

    return effective_perms


def has_document_permission(user: User, document: Document, permission: str, db: Session) -> bool:
    """Helper asserting if the user possesses a specific document capability."""
    effective = get_user_effective_permissions(user, document, db)
    return permission in effective


# Reusable permission assertion functions
def can_view_document(user: User, document: Document, db: Session) -> bool:
    return has_document_permission(user, document, "VIEW", db)


def can_download_document(user: User, document: Document, db: Session) -> bool:
    return has_document_permission(user, document, "DOWNLOAD", db)


def can_edit_document(user: User, document: Document, db: Session) -> bool:
    return has_document_permission(user, document, "EDIT", db)


def can_share_document(user: User, document: Document, db: Session) -> bool:
    return has_document_permission(user, document, "SHARE", db)


def can_delete_document(user: User, document: Document, db: Session) -> bool:
    return has_document_permission(user, document, "DELETE", db)


def get_allowed_sharing_options(user: User) -> List[Dict[str, str]]:
    """Determines which visibility access levels a user is allowed to choose based on role authority."""
    role = user.role.name

    # CEO and Admin can share with absolutely anyone or set any visibility default
    if role in ("Admin", "CEO"):
        return [
            {"label": "Everyone in the organization", "value": "ORGANIZATION"},
            {"label": "My Department", "value": "DEPARTMENT"},
            {"label": "My Team", "value": "TEAM"},
            {"label": "Managers & Above", "value": "ROLE_HIERARCHY"},
            {"label": "Specific People", "value": "SPECIFIC_USERS"},
            {"label": "Private / Only Me", "value": "PRIVATE"},
        ]

    # Managers can share within department, team, specific users, or set private
    elif role in ("Manager", "HR Manager", "Finance Manager"):
        return [
            {"label": "Everyone in the organization", "value": "ORGANIZATION"},
            {"label": "My Department", "value": "DEPARTMENT"},
            {"label": "My Team", "value": "TEAM"},
            {"label": "Specific People", "value": "SPECIFIC_USERS"},
            {"label": "Private / Only Me", "value": "PRIVATE"},
        ]

    # Team Leads can share within team, specific users, or set private
    elif role == "Team Lead":
        return [
            {"label": "Everyone in the organization", "value": "ORGANIZATION"},
            {"label": "My Team", "value": "TEAM"},
            {"label": "Specific People", "value": "SPECIFIC_USERS"},
            {"label": "Private / Only Me", "value": "PRIVATE"},
        ]

    # Standard Employees and Staff can only choose Team visibility or keep it Private
    else:
        return [
            {"label": "Everyone in the organization", "value": "ORGANIZATION"},
            {"label": "My Team", "value": "TEAM"},
            {"label": "Private / Only Me", "value": "PRIVATE"},
        ]


def validate_sharing_authority(
    user: User,
    selected_access: str,
    target_shares: List[Dict[str, Any]],
    db: Session
) -> bool:
    """Enforces that a user never grants access exceeding their organizational authority or sharing boundaries."""
    role = user.role.name

    # Admins/CEOs have absolute sharing authority
    if role in ("Admin", "CEO"):
        return True

    # 1. Assert selected default visibility access settings
    allowed_values = {opt["value"] for opt in get_allowed_sharing_options(user)}
    if selected_access not in allowed_values:
        logger.warning(f"User {user.email} (Role: {role}) unauthorized to set document visibility to: {selected_access}")
        return False

    # 2. Assert explicit share grants (target_shares is list of dicts with subject_type, subject_id, permission_type)
    for share in target_shares:
        subject_type = share.get("subject_type")
        subject_id = share.get("subject_id")
        permission_type = share.get("permission_type")

        # A user cannot share with permissions they themselves don't possess
        # If an employee tries to grant EDIT permission, reject it (employees cannot delegate EDIT)
        if role not in ("Admin", "CEO", "Manager", "HR Manager", "Finance Manager") and permission_type in ("EDIT", "DELETE"):
            logger.warning(f"User {user.email} unauthorized to delegate elevated permission: {permission_type}")
            return False

        # Scope checking: Managers cannot share with other departments, employees cannot share outside their team
        if subject_type == "DEPARTMENT":
            # Only Managers & above can share with entire departments, and only their own department
            if role not in ("Manager", "HR Manager", "Finance Manager", "Team Lead"):
                return False
            if str(user.department_id) != str(subject_id):
                logger.warning(f"Manager {user.email} blocked from sharing with external department: {subject_id}")
                return False

        elif subject_type == "TEAM":
            # Must match user's team unless Manager
            if role not in ("Manager", "HR Manager", "Finance Manager"):
                if str(user.team_id) != str(subject_id):
                    logger.warning(f"User {user.email} blocked from sharing with external team: {subject_id}")
                    return False

        elif subject_type == "USER":
            # Find target user
            target_user = db.query(User).filter(User.id == subject_id).first()
            if not target_user:
                return False
            
            # Managers can only share with users in their department
            if role in ("Manager", "HR Manager", "Finance Manager"):
                if target_user.department_id != user.department_id:
                    logger.warning(f"Manager {user.email} blocked from sharing with external department user: {target_user.email}")
                    return False
            # Employees and Team Leads can only share with users in their team
            elif role in ("Team Lead", "Employee", "HR Staff", "Finance Staff"):
                if target_user.team_id != user.team_id:
                    logger.warning(f"User {user.email} blocked from sharing with external team user: {target_user.email}")
                    return False

    return True
