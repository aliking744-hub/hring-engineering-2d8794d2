from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


COMPANY_MEMBER_ROLES = {"ceo", "deputy", "manager", "employee"}
MANAGED_MEMBER_ROLES = {"deputy", "manager", "employee"}


class InviteValidationRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=64)


class InviteValidationResponse(BaseModel):
    is_valid: bool
    invite_id: UUID | None = None
    role: str | None = None
    company_id: UUID | None = None
    company_name: str | None = None
    error: str | None = None


class CreateInviteRequest(BaseModel):
    role: str = Field(pattern=r"^(deputy|manager|employee)$")
    max_uses: int = Field(default=1, ge=1, le=1000)
    expires_in_days: int = Field(default=7, ge=1, le=365)


class CompanyInviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    invite_code: str
    role: str
    max_uses: int | None
    used_count: int
    expires_at: datetime | None
    created_by: UUID
    created_at: datetime
    is_active: bool


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    domain: str | None
    status: str
    subscription_tier: str
    monthly_credits: int
    used_credits: int
    max_members: int
    credit_pool: int | None
    credit_pool_enabled: bool | None
    created_at: datetime
    updated_at: datetime


class UpdateCompanySettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    domain: str | None = Field(default=None, max_length=255)
    credit_pool_enabled: bool | None = None


class MemberProfileResponse(BaseModel):
    id: UUID
    email: EmailStr | None
    full_name: str | None
    title: str | None
    avatar_url: str | None


class CompanyMemberResponse(BaseModel):
    id: UUID
    company_id: UUID
    user_id: UUID
    role: str
    can_invite: bool
    is_active: bool
    invited_by: UUID | None
    joined_at: datetime
    profile: MemberProfileResponse | None = None


class JoinCompanyResponse(BaseModel):
    company_id: UUID
    company_name: str
    member_id: UUID
    role: str
    already_member: bool = False


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(pattern=r"^(deputy|manager|employee)$")


class UpdateInvitePermissionRequest(BaseModel):
    can_invite: bool


class CreateCompanyUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = Field(pattern=r"^(deputy|manager|employee)$")


class ResetCompanyUserPasswordRequest(BaseModel):
    new_password: str = Field(min_length=10, max_length=256)


class UpdateCompanyUserProfileRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, max_length=200)


class CompanyUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None
    role: str
