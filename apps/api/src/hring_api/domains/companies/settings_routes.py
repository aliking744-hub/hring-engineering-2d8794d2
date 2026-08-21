from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.companies.schemas import CompanyResponse, UpdateCompanySettingsRequest
from hring_api.domains.companies.service import (
    CompanyAccessDeniedError,
    CompanyError,
    CompanyNotFoundError,
    CompanySuspendedError,
)
from hring_api.domains.companies.settings_service import update_company_settings
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(tags=["company-settings"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    return request.client.host if request.client else None


def _settings_error(exc: CompanyError) -> HTTPException:
    if isinstance(exc, CompanyAccessDeniedError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if isinstance(exc, CompanyNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CompanySuspendedError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch(
    "/companies/{company_id}/settings",
    response_model=CompanyResponse,
)
async def change_company_settings(
    company_id: UUID,
    payload: UpdateCompanySettingsRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyResponse:
    changed_fields = sorted(payload.model_fields_set)
    try:
        company = await update_company_settings(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            name=payload.name,
            domain=payload.domain,
            domain_supplied="domain" in payload.model_fields_set,
            credit_pool_enabled=payload.credit_pool_enabled,
        )
        await add_audit_log(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            action="company.settings.update",
            resource_type="company",
            resource_id=str(company_id),
            metadata_json={"changed_fields": changed_fields},
            ip_address=_client_ip(request),
        )
    except CompanyError as exc:
        await db.rollback()
        raise _settings_error(exc) from exc
    await db.commit()
    return CompanyResponse.model_validate(company)
