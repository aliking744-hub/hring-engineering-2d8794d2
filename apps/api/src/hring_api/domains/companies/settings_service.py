from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.policy import is_company_permission_allowed
from hring_api.domains.companies.repository import get_company, get_membership
from hring_api.domains.companies.service import (
    CompanyAccessDeniedError,
    CompanyError,
    CompanyNotFoundError,
    CompanySuspendedError,
)
from hring_api.domains.billing.models import CreditAccount
from hring_api.domains.identity.models import Company


async def update_company_settings(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    name: str | None,
    domain: str | None,
    domain_supplied: bool,
    credit_pool_enabled: bool | None,
) -> Company:
    company = await get_company(session, company_id, for_update=True)
    if company is None:
        raise CompanyNotFoundError("Company not found")
    if company.status == "suspended":
        raise CompanySuspendedError("این شرکت در حال حاضر غیرفعال است")

    membership = await get_membership(
        session,
        company_id=company_id,
        user_id=actor_user_id,
        active_only=True,
    )
    if membership is None or not await is_company_permission_allowed(
        session,
        membership=membership,
        permission_key="company.settings.manage",
    ):
        raise CompanyAccessDeniedError("Forbidden")

    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise CompanyError("Company name cannot be empty")
        company.name = clean_name

    if domain_supplied:
        normalized_domain = domain.strip().lower() if domain else None
        if normalized_domain:
            existing_id = await session.scalar(
                select(Company.id).where(
                    Company.domain == normalized_domain,
                    Company.id != company_id,
                )
            )
            if existing_id is not None:
                raise CompanyError("Company domain is already registered")
        company.domain = normalized_domain

    if credit_pool_enabled is not None:
        if credit_pool_enabled and not company.credit_pool_enabled:
            account = await session.scalar(
                select(CreditAccount).where(CreditAccount.company_id == company.id)
            )
            company.credit_pool = (
                int(account.available_credits)
                if account is not None
                else max(0, int(company.monthly_credits) - int(company.used_credits))
            )
        company.credit_pool_enabled = credit_pool_enabled

    await session.flush()
    return company
