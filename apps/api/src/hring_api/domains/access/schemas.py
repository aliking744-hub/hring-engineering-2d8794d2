from pydantic import BaseModel, Field, field_validator

from hring_api.domains.access.policy import COMPANY_PERMISSION_CATALOG


COMPANY_ROLES = {"ceo", "deputy", "manager", "employee"}


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

    @field_validator("permission_key")
    @classmethod
    def validate_permission_key(cls, value: str) -> str:
        if value not in COMPANY_PERMISSION_CATALOG:
            raise ValueError("Unsupported company permission")
        return value
