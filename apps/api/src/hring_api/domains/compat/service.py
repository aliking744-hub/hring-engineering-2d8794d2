from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.compat.models import CompatRecord
from hring_api.domains.compat.schemas import CompatQueryRequest, QueryFilter
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.identity.models import FeaturePermission, Profile


PUBLIC_READ_TABLES = frozenset({"posts", "testimonials", "digital_products"})
GLOBAL_CONTENT_TABLES = frozenset({"posts", "testimonials", "digital_products"})
GLOBAL_CONTENT_WRITE_ROLES = frozenset({"super_admin", "platform_admin", "content_admin"})


class CompatError(RuntimeError):
    pass


class CompatForbiddenError(CompatError):
    pass


def active_company_ids(principal: Principal) -> set[UUID]:
    return {membership.company_id for membership in principal.memberships if membership.is_active}


def primary_company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


def _value(row: dict[str, Any], column: str) -> Any:
    return row.get(column)


def _matches_filter(row: dict[str, Any], item: QueryFilter) -> bool:
    current = _value(row, item.column)
    expected = item.value
    if item.operator == "eq":
        return bool(current == expected)
    if item.operator == "neq":
        return bool(current != expected)
    if item.operator == "in":
        return bool(isinstance(expected, list) and current in expected)
    if item.operator == "is":
        return bool(current is expected)
    if item.operator == "contains":
        if isinstance(current, list):
            if isinstance(expected, list):
                return bool(all(value in current for value in expected))
            return bool(expected in current)
        if isinstance(current, str) and isinstance(expected, str):
            return bool(expected in current)
        if isinstance(current, dict) and isinstance(expected, dict):
            return bool(all(current.get(key) == value for key, value in expected.items()))
        return False
    try:
        if item.operator == "gt":
            return bool(current > expected)
        if item.operator == "gte":
            return bool(current >= expected)
        if item.operator == "lt":
            return bool(current < expected)
        if item.operator == "lte":
            return bool(current <= expected)
    except TypeError:
        return False
    return False


def _apply_filters(rows: list[dict[str, Any]], request: CompatQueryRequest) -> list[dict[str, Any]]:
    filtered = [
        row for row in rows if all(_matches_filter(row, item) for item in request.filters)
    ]
    if request.order is not None:
        column = request.order.column

        def order_key(row: dict[str, Any]) -> tuple[bool, str]:
            value = row.get(column)
            return (value is None, "" if value is None else str(value))

        filtered.sort(key=order_key, reverse=not request.order.ascending)
    if request.limit is not None:
        filtered = filtered[: request.limit]
    return filtered


def _project(row: dict[str, Any], columns: str | None) -> dict[str, Any]:
    if not columns or columns.strip() == "*":
        return row
    selected: dict[str, Any] = {}
    simple_columns = [part.strip() for part in columns.split(",") if part.strip()]
    if any("(" in part or ")" in part for part in simple_columns):
        return row
    for column in simple_columns:
        if column in row:
            selected[column] = row[column]
    return selected


def _shape(rows: list[dict[str, Any]], request: CompatQueryRequest) -> Any:
    projected = [_project(row, request.columns) for row in rows]
    if request.single:
        if len(projected) != 1:
            raise CompatError("Expected exactly one record")
        return projected[0]
    if request.maybe_single:
        if len(projected) > 1:
            raise CompatError("Expected at most one record")
        return projected[0] if projected else None
    return projected


def _profile_payload(profile: Profile) -> dict[str, Any]:
    return {
        "id": str(profile.id),
        "email": profile.email,
        "full_name": profile.full_name,
        "avatar_url": profile.avatar_url,
        "title": profile.title,
        "user_type": profile.user_type,
        "subscription_tier": profile.subscription_tier,
        "monthly_credits": profile.monthly_credits,
        "used_credits": profile.used_credits,
        "is_active": profile.is_active,
        "last_credit_reset": profile.last_credit_reset.isoformat() if profile.last_credit_reset else None,
        "created_at": profile.created_at.isoformat(),
    }


def _feature_payload(item: FeaturePermission) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "feature_key": item.feature_key,
        "feature_name": item.feature_name,
        "feature_category": item.feature_category,
        "description": item.description,
        "allowed_tiers": item.allowed_tiers,
        "allowed_company_roles": item.allowed_company_roles,
        "allow_view": item.allow_view,
        "allow_edit": item.allow_edit,
        "credit_cost": item.credit_cost,
        "is_active": item.is_active,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


async def _query_profiles(
    db: AsyncSession,
    *,
    principal: Principal,
    request: CompatQueryRequest,
) -> Any:
    profile = await db.get(Profile, principal.user_id)
    if profile is None:
        return None if request.single or request.maybe_single else []
    row = _profile_payload(profile)
    rows = _apply_filters([row], request)
    if request.operation == "select":
        return _shape(rows, request)
    if request.operation != "update":
        raise CompatForbiddenError("Profile compatibility only supports select/update")
    if not rows:
        return None if request.single or request.maybe_single else []
    if not isinstance(request.values, dict):
        raise CompatError("Profile update requires an object")
    allowed = {"full_name", "avatar_url", "title"}
    for key, value in request.values.items():
        if key in allowed:
            setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return _shape([_profile_payload(profile)], request)


async def _query_feature_permissions(
    db: AsyncSession,
    *,
    request: CompatQueryRequest,
) -> Any:
    if request.operation != "select":
        raise CompatForbiddenError("Feature permissions are read-only through compatibility API")
    result = await db.execute(select(FeaturePermission))
    rows = [_feature_payload(item) for item in result.scalars().all()]
    return _shape(_apply_filters(rows, request), request)


async def _load_compat_rows(
    db: AsyncSession,
    *,
    table: str,
    principal: Principal | None,
    public: bool,
) -> list[CompatRecord]:
    result = await db.execute(select(CompatRecord).where(CompatRecord.table_name == table))
    records = list(result.scalars().all())
    if public:
        return [record for record in records if record.owner_user_id is None and record.company_id is None]
    if principal is None:
        raise CompatForbiddenError("Authentication required")
    companies = active_company_ids(principal)
    return [
        record
        for record in records
        if record.owner_user_id == principal.user_id
        or (record.company_id is not None and record.company_id in companies)
        or (record.owner_user_id is None and record.company_id is None)
    ]


def _record_payload(record: CompatRecord) -> dict[str, Any]:
    row = dict(record.data)
    row.setdefault("id", record.record_id)
    row.setdefault("created_at", record.created_at.isoformat())
    row.setdefault("updated_at", record.updated_at.isoformat())
    return row


async def _ensure_global_write_allowed(
    db: AsyncSession,
    *,
    principal: Principal,
    table: str,
    operation: str,
) -> None:
    if table not in GLOBAL_CONTENT_TABLES or operation == "select":
        return
    if "admin" in principal.app_roles:
        return
    platform_roles = set(await list_platform_roles(db, principal.user_id))
    if platform_roles.isdisjoint(GLOBAL_CONTENT_WRITE_ROLES):
        raise CompatForbiddenError("Global product/content writes require product administration access")


async def execute_query(
    db: AsyncSession,
    *,
    request: CompatQueryRequest,
    principal: Principal | None,
    public: bool = False,
) -> Any:
    if public and (request.operation != "select" or request.table not in PUBLIC_READ_TABLES):
        raise CompatForbiddenError("Public compatibility query is not allowed")
    if request.table == "profiles":
        if principal is None:
            raise CompatForbiddenError("Authentication required")
        return await _query_profiles(db, principal=principal, request=request)
    if request.table == "feature_permissions":
        return await _query_feature_permissions(db, request=request)

    if principal is not None:
        await _ensure_global_write_allowed(
            db,
            principal=principal,
            table=request.table,
            operation=request.operation,
        )

    records = await _load_compat_rows(
        db,
        table=request.table,
        principal=principal,
        public=public,
    )
    payloads = [_record_payload(record) for record in records]
    selected_payloads = _apply_filters(payloads, request)

    if request.operation == "select":
        return _shape(selected_payloads, request)
    if principal is None:
        raise CompatForbiddenError("Authentication required")

    if request.operation in {"insert", "upsert"}:
        if request.values is None:
            raise CompatError("Insert requires values")
        values_list = request.values if isinstance(request.values, list) else [request.values]
        now = datetime.now(UTC).isoformat()
        created_rows: list[dict[str, Any]] = []
        for raw in values_list:
            row = dict(raw)
            record_id = str(row.get("id") or uuid4())
            row["id"] = record_id
            row.setdefault("created_at", now)
            row["updated_at"] = now
            existing_result = await db.execute(
                select(CompatRecord).where(
                    CompatRecord.table_name == request.table,
                    CompatRecord.record_id == record_id,
                )
            )
            existing = existing_result.scalar_one_or_none()
            if existing is not None:
                if request.operation != "upsert":
                    raise CompatError("duplicate key value violates unique constraint")
                existing.data = row
                created_rows.append(row)
                continue
            global_content = request.table in GLOBAL_CONTENT_TABLES
            db.add(
                CompatRecord(
                    table_name=request.table,
                    record_id=record_id,
                    owner_user_id=None if global_content else principal.user_id,
                    company_id=None if global_content else primary_company_id(principal),
                    data=row,
                )
            )
            created_rows.append(row)
        await db.commit()
        return _shape(created_rows, request)

    matched_ids = {str(row.get("id")) for row in selected_payloads if row.get("id") is not None}
    matched_records = [record for record in records if record.record_id in matched_ids]

    if request.operation == "update":
        if not isinstance(request.values, dict):
            raise CompatError("Update requires an object")
        now = datetime.now(UTC).isoformat()
        updated_rows: list[dict[str, Any]] = []
        for record in matched_records:
            row = dict(record.data)
            row.update(request.values)
            row["id"] = record.record_id
            row["updated_at"] = now
            record.data = row
            updated_rows.append(row)
        await db.commit()
        return _shape(updated_rows, request)

    if request.operation == "delete":
        deleted_rows = [_record_payload(record) for record in matched_records]
        ids = [record.id for record in matched_records]
        if ids:
            await db.execute(delete(CompatRecord).where(CompatRecord.id.in_(ids)))
            await db.commit()
        return _shape(deleted_rows, request)

    raise CompatError("Unsupported compatibility operation")


async def get_user_credits(db: AsyncSession, *, principal: Principal) -> int:
    profile = await db.get(Profile, principal.user_id)
    if profile is None:
        return 0
    company_ids = active_company_ids(principal)
    if company_ids:
        from hring_api.domains.identity.models import Company

        for company_id in company_ids:
            company = await db.get(Company, company_id)
            if company is not None and company.credit_pool_enabled:
                return max(0, int(company.credit_pool or 0))
    return max(0, profile.monthly_credits - profile.used_credits)


async def deduct_user_credits(
    db: AsyncSession,
    *,
    principal: Principal,
    amount: int,
) -> bool:
    if amount <= 0:
        raise CompatError("amount must be positive")
    from hring_api.domains.identity.models import Company

    company_ids = active_company_ids(principal)
    for company_id in company_ids:
        result = await db.execute(select(Company).where(Company.id == company_id).with_for_update())
        company = result.scalar_one_or_none()
        if company is not None and company.credit_pool_enabled:
            available = int(company.credit_pool or 0)
            if available < amount:
                await db.rollback()
                return False
            company.credit_pool = available - amount
            await db.commit()
            return True

    result = await db.execute(select(Profile).where(Profile.id == principal.user_id).with_for_update())
    profile = result.scalar_one_or_none()
    if profile is None or profile.monthly_credits - profile.used_credits < amount:
        await db.rollback()
        return False
    profile.used_credits += amount
    await db.commit()
    return True
