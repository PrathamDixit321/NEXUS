"""Authentication endpoints exposing registration, login, logout, profile updates, and token refresh."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.db.database import get_db
from app.models.auth import Role, User
from app.schemas.auth import (
    TokenRefreshRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.services.auth_service import (
    create_user_session,
    decode_access_token,
    log_auth_event,
    refresh_user_session,
    revoke_user_session,
)

logger = logging.getLogger("nexusai")
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Define OAuth2 bearer scheme pointing to our login route
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Dependency validator fetching the authenticated user from the request header."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user account has been deactivated."
        )
        
    return user


class PermissionChecker:
    """RBAC authorization checker dependency protecting routes with required capability scopes."""
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Extract list of permissions mapped to the user's role
        permissions = {p.name for p in current_user.role.permissions}
        if self.required_permission not in permissions:
            logger.warning(
                f"User {current_user.email} (Role: {current_user.role.name}) "
                f"denied access to capability: {self.required_permission}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to execute this action."
            )
        return current_user


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: Request, payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user profile and returns access and refresh tokens."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account is already registered with this email address."
        )

    # Fetch default role 'Employee' for new registrants
    default_role = db.query(Role).filter(Role.name == "Employee").first()
    if not default_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System role configuration not initialized. Contact Admin."
        )

    # Hash user password
    hashed_pass = get_password_hash(payload.password)

    # Create new User model
    new_user = User(
        email=payload.email,
        hashed_password=hashed_pass,
        full_name=payload.full_name,
        department=payload.department,
        company_name=payload.company_name,
        role_id=default_role.id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Gather client meta details
    ip_addr = request.client.host if request.client else None
    user_agt = request.headers.get("user-agent")

    log_auth_event(
        db=db,
        user_id=new_user.id,
        action="user:registered",
        ip_address=ip_addr,
        user_agent=user_agt
    )

    # Automatically sign user in upon registration
    session_data = create_user_session(db=db, user=new_user, ip_address=ip_addr, user_agent=user_agt)
    return session_data


@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticates credentials and establishes a user session."""
    ip_addr = request.client.host if request.client else None
    user_agt = request.headers.get("user-agent")

    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user or not verify_password(payload.password, user.hashed_password):
        # Log login failure audit event
        log_auth_event(
            db=db,
            action=f"user:login_failed_for_{payload.email}",
            ip_address=ip_addr,
            user_agent=user_agt
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated."
        )

    # Generate session tokens
    session_data = create_user_session(db=db, user=user, ip_address=ip_addr, user_agent=user_agt)
    return session_data


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    """Invalidates the provided session refresh token."""
    success = revoke_user_session(db=db, refresh_token=payload.refresh_token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already revoked session token."
        )
    return {"message": "Session logged out successfully."}


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    """Exchanges an active refresh token for a new set of access/refresh tokens."""
    ip_addr = request.client.host if request.client else None
    user_agt = request.headers.get("user-agent")

    session_data = refresh_user_session(
        db=db,
        refresh_token=payload.refresh_token,
        ip_address=ip_addr,
        user_agent=user_agt
    )

    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session refresh token."
        )

    return session_data


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile details."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.name,
        "department": current_user.department,
        "company_name": current_user.company_name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }


@router.put("/profile", response_model=UserResponse)
def update_profile(
    request: Request,
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates profile attributes for the authenticated user."""
    ip_addr = request.client.host if request.client else None
    user_agt = request.headers.get("user-agent")

    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.department is not None:
        current_user.department = payload.department
    if payload.company_name is not None:
        current_user.company_name = payload.company_name

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    log_auth_event(
        db=db,
        user_id=current_user.id,
        action="user:profile_updated",
        ip_address=ip_addr,
        user_agent=user_agt
    )

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.name,
        "department": current_user.department,
        "company_name": current_user.company_name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }
