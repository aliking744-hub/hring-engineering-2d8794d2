from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


PLATFORM_ROLES = {"super_admin", "platform_admin", "content_admin", "support_admin"}
COMPANY_ROLES = {"ceo", "deputy", "manager", "employee"}


class PlatformOverviewResponse(BaseModel):
    total_users: int
    active_users: int
    total_companies: int
    active_companies: int
    trial_companies: int
    suspended_companies: int


class AdminUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None
    is_active: bool
    email_verified_at: datetime | None
    platform_roles: list[str]
    app_roles: list[str]
    failed_login_attempts: int
    locked_until: datetime | None
    mfa_enabled: bool
    created_at: datetime


class CreateManagedUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)
    full_name: str = Field(min_length=1, max_length=200)
    company_id: UUID | None = None
    company_role: str = Field(default="employee", pattern=r"^(deputy|manager|employee)$")
    initial_credits: int = Field(default=0, ge=0, le=10_000_000)


class AdminUserStatusRequest(BaseModel):
    is_active: bool


class AdminPlatformRolesRequest(BaseModel):
    roles: list[str] = Field(default_factory=list, max_length=4)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, value: list[str]) -> list[str]:
        unique = list(dict.fromkeys(value))
        invalid = set(unique) - PLATFORM_ROLES
        if invalid:
            raise ValueError(f"Unsupported platform roles: {', '.join(sorted(invalid))}")
        return unique


class CompanyOwnerAccountRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)
    full_name: str = Field(min_length=2, max_length=200)


class CreateManagedCompanyRequest(BaseModel):
    name: str = Field(min_length=2, max_length=240)
    domain: str | None = Field(default=None, max_length=255)
    status: str = Field(default="active", pattern=r"^(active|trial|suspended)$")
    subscription_tier: str = Field(default="corporate_expert", max_length=64)
    monthly_credits: int = Field(default=100, ge=0, le=10_000_000)
    max_members: int = Field(default=10, ge=1, le=100_000)
    owner: CompanyOwnerAccountRequest


class UpdateManagedCompanyRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=240)
    domain: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, pattern=r"^(active|trial|suspended)$")
    subscription_tier: str | None = Field(default=None, max_length=64)
    monthly_credits: int | None = Field(default=None, ge=0, le=10_000_000)
    max_members: int | None = Field(default=None, ge=1, le=100_000)


class AdminCompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    domain: str | None
    status: str
    subscription_tier: str
    monthly_credits: int
    used_credits: int
    max_members: int
    created_at: datetime
    updated_at: datetime


class ManagedCompanyCreatedResponse(BaseModel):
    company: AdminCompanyResponse
    owner: AdminUserResponse


class SiteSettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    key: str
    value: str | None
    label: str | None
    category: str
    value_type: str
    is_public: bool
    updated_at: datetime


class UpsertSiteSettingRequest(BaseModel):
    value: str | None = Field(default=None, max_length=200_000)
    label: str | None = Field(default=None, max_length=240)
    category: str = Field(default="general", min_length=1, max_length=80)
    value_type: str = Field(default="text", pattern=r"^(text|boolean|number|json|url)$")
    is_public: bool = False


class BulkSiteSettingItem(UpsertSiteSettingRequest):
    key: str = Field(min_length=1, max_length=160)


class BulkUpsertSiteSettingsRequest(BaseModel):
    settings: list[BulkSiteSettingItem] = Field(min_length=1, max_length=100)

    @field_validator("settings")
    @classmethod
    def validate_unique_keys(cls, value: list[BulkSiteSettingItem]) -> list[BulkSiteSettingItem]:
        normalized = [item.key.strip().lower() for item in value]
        if len(normalized) != len(set(normalized)):
            raise ValueError("Duplicate site setting keys are not allowed")
        return value


class PublicSettingsResponse(BaseModel):
    settings: dict[str, str | None]


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user_id: UUID | None
    company_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    outcome: str
    metadata_json: dict[str, object]
    ip_address: str | None
    created_at: datetime


class CompanyPermissionDefinition(BaseModel):
    key: str
    label: str


class CompanyRolePermissionState(BaseModel):
    role: str
    permission_key: str
    allowed: bool
    source: str


class CompanyPermissionMatrixResponse(BaseModel):
    catalog: list[CompanyPermissionDefinition]
    matrix: list[CompanyRolePermissionState]


class UpdateCompanyRolePermissionRequest(BaseModel):
    role: str
    permission_key: str = Field(min_length=1, max_length=120)
    allowed: bool

    @field_validator("role")
    @classmethod
    def validate_company_role(cls, value: str) -> str:
        if value not in COMPANY_ROLES:
            raise ValueError("Unsupported company role")
        return value
