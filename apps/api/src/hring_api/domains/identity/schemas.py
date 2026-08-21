from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)
    full_name: str | None = Field(default=None, max_length=200)

    @field_validator("password")
    @classmethod
    def password_must_not_be_blank(cls, value: str) -> str:
        if value.strip() != value or not value.strip():
            raise ValueError("Password cannot be blank or padded with whitespace")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=40, max_length=512)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=40, max_length=512)


class SmsLoginRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=32)


class SmsLoginVerifyRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(pattern=r"^\d{6}$")


class SmsChallengeResponse(BaseModel):
    challenge_id: UUID
    expires_at: datetime


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_expires_at: datetime
    refresh_expires_at: datetime


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    is_active: bool
    email_verified_at: datetime | None
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenPairResponse


class MembershipResponse(BaseModel):
    company_id: UUID
    role: str
    can_invite: bool
    is_active: bool


class CurrentUserResponse(UserResponse):
    app_roles: list[str]
    memberships: list[MembershipResponse]
