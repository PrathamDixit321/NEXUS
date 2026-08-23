"""Authentication services handling token lifecycle, sessions, and audit logging."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.auth import AuditLog, User, UserSession

logger = logging.getLogger("nexusai")
settings = get_settings()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a short-lived JSON Web Token (JWT) access token containing claims."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decodes a JWT access token and verifies its signature and expiration."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None


def log_auth_event(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    result: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Records an entry in the audit log for security compliance and visibility."""
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            result=result,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to write audit log event: {str(e)}")


def create_user_session(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """Creates a new user session, generates tokens, and logs the login event."""
    # 1. Create short-lived access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    # Include user identity and role name in access token payload
    token_payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role.name
    }
    access_token = create_access_token(data=token_payload, expires_delta=access_token_expires)

    # 2. Create long-lived secure random refresh token
    refresh_token = secrets.token_urlsafe(64)
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)

    # 3. Save session to database
    session = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()

    # 4. Write audit log
    log_auth_event(
        db=db,
        user_id=user.id,
        action="user:login_success",
        ip_address=ip_address,
        user_agent=user_agent
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.name,
            "department": user.department,
            "company_name": user.company_name,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
    }


def refresh_user_session(
    db: Session,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[dict]:
    """Validates a refresh token, performs rotation (security best practice), and returns new tokens."""
    # Find active, unrevoked session matching the refresh token
    session = db.query(UserSession).filter(
        UserSession.refresh_token == refresh_token,
        UserSession.is_revoked == False
    ).first()

    if not session:
        log_auth_event(
            db=db,
            action="session:refresh_failed_invalid_token",
            ip_address=ip_address,
            user_agent=user_agent
        )
        return None

    # Check expiration date
    current_time = datetime.now(UTC)
    session_expires = session.expires_at
    if session_expires.tzinfo is None:
        session_expires = session_expires.replace(tzinfo=UTC)

    if session_expires < current_time:
        # Session expired, revoke it
        session.is_revoked = True
        db.add(session)
        db.commit()
        
        log_auth_event(
            db=db,
            user_id=session.user_id,
            action="session:refresh_failed_expired_token",
            ip_address=ip_address,
            user_agent=user_agent
        )
        return None

    # Rotate refresh token: revoke current one and create a new session record
    session.is_revoked = True
    db.add(session)
    db.commit()

    user = session.user
    
    # Create new session tokens
    new_session_data = create_user_session(
        db=db,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    # Log session refresh success
    log_auth_event(
        db=db,
        user_id=user.id,
        action="session:refresh_success",
        ip_address=ip_address,
        user_agent=user_agent
    )

    return new_session_data


def revoke_user_session(db: Session, refresh_token: str) -> bool:
    """Revokes an active session by marking the refresh token as revoked (Logout behavior)."""
    session = db.query(UserSession).filter(UserSession.refresh_token == refresh_token).first()
    if session:
        session.is_revoked = True
        db.add(session)
        db.commit()
        
        log_auth_event(
            db=db,
            user_id=session.user_id,
            action="user:logout"
        )
        return True
    return False
