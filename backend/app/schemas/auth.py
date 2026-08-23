"""Request and Response Pydantic schemas for authentication and profile actions."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """Payload schema required for registering a new user account."""
    email: EmailStr = Field(..., description="Unique email address of the user")
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")
    full_name: str = Field(..., min_length=1, max_length=100, description="Full name of the user")
    department: Optional[str] = Field(None, max_length=100, description="Corporate department")
    company_name: Optional[str] = Field(None, max_length=100, description="Corporate company name")


class UserLoginRequest(BaseModel):
    """Payload schema required for logging in."""
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")


class UserUpdateRequest(BaseModel):
    """Payload schema required for updating user profile fields."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Updated full name")
    department: Optional[str] = Field(None, max_length=100, description="Updated department")
    company_name: Optional[str] = Field(None, max_length=100, description="Updated company name")


class UserResponse(BaseModel):
    """Response schema containing user profile data."""
    id: str
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    company_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Response schema containing authentication tokens and user information."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    """Payload schema containing the refresh token to renew credentials."""
    refresh_token: str = Field(..., description="Active session refresh token")


class AuditLogResponse(BaseModel):
    """Response schema containing audit log entries for compliance viewing."""
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    result: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
