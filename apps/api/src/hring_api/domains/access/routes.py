from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import (
    COMPANY_PERMISSION_CATALOG,
    DEFAULT_COMPANY_ROLE_PERMISSIONS,
)
from hring_api.domains.access.repository import (
    list_company_permission_overrides,
    set_company_permission_override,
)
from hring_api.domains.access.schemas import (
    CompanyPermissionDefinition,
    CompanyPermissionMatrixResponse,
    CompanyRolePermissionState,
    UpdateCompanyRolePermissionRequest,
)
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.companies.service import (
    CompanyAccessDeniedError,
    CompanyError,
    require_company_ceo,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/company-admin", tags=["company-admin"])
ROLES = ("ceo", "deputy", "manager", "employee")


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _require_ceo_or_403(
    db: AsyncSession,
    *,
    principal: Principal,
    company_id: UUID,
) -> None:
    try:
        await require_company_ceo(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
        )
    except CompanyAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden") from exc
    except CompanyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/{company_id}/permissions",
    response_model=CompanyPermissionMatrixResponse,
)
async def company_permission_matrix(
    company_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyPermissionMatrixResponse:
    await _require_ceo_or_403(db, principal=principal, company_id=company_id)
    overrides = await list_company_permission_overrides(db, company_id=company_id)
    override_map = {(row.role, row.permission_key): row.allowed for row in overrides}

    matrix: list[CompanyRolePermissionState] = []
    for role in ROLES:
        for permission_key in COMPANY_PERMISSION_CATALOG:
            override = override_map.get((role, permission_key))
            if role == "ceo":
                allowed = True
                source = "protected-ceo-default"
            elif override is not None:
                allowed = override
                source = "company-override"
            else:
                allowed = permission_key in DEFAULT_COMPANY_ROLE_PERMISSIONS.get(role, frozenset())
                source = "role-default"
            matrix.append(
                CompanyRolePermissionState(
                    role=role,
                    permission_key=permission_key,
                    allowed=allowed,
                    source=source,
                )
            )

    return CompanyPermissionMatrixResponse(
        catalog=[
            CompanyPermissionDefinition(key=key, label=label)
            for key, label in COMPANY_PERMISSION_CATALOG.items()
        ],
        matrix=matrix,
    )


@router.put(
    "/{company_id}/permissions",
    response_model=CompanyRolePermissionState,
)
async def change_company_role_permission(
    company_id: UUID,
    payload: UpdateCompanyRolePermissionRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyRolePermissionState:
    await _require_ceo_or_403(db, principal=principal, company_id=company_id)

    # CEO access is a structural safety invariant. It cannot be weakened from the
    # tenant panel, preventing accidental lock-out or privilege-policy corruption.
    if payload.role == "ceo":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CEO permissions are protected",
        )

    row = await set_company_permission_override(
        db,
        company_id=company_id,
        role=payload.role,
        permission_key=payload.permission_key,
        allowed=payload.allowed,
        updated_by=principal.user_id,
    )
    await add_audit_log(
        db,
        actor_user_id=principal.user_id,
        company_id=company_id,
        action="company.permission.update",
        resource_type="company_role_permission",
        resource_id=str(row.id),
        metadata_json={
            "role": row.role,
            "permission_key": row.permission_key,
            "allowed": row.allowed,
        },
        ip_address=_client_ip(request),
    )
    await db.commit()
    return CompanyRolePermissionState(
        role=row.role,
        permission_key=row.permission_key,
        allowed=row.allowed,
        source="company-override",
    )
