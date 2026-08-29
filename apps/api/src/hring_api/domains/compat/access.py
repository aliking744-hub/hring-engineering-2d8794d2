from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.compat.models import CompatRecord
from hring_api.domains.compat.table_scope import TableScope, TableScopeError, personal_owner_id, scope_for
from hring_api.domains.identity.dependencies import Principal


ADMIN_ROLES = frozenset({"super_admin", "platform_admin", "content_admin"})
GLOBAL_WRITE_TABLES = frozenset({"posts", "testimonials", "digital_products"})

PERSONAL_OPERATION_RULES: dict[str, frozenset[str]] = {
    "notifications": frozenset({"select", "update", "delete"}),
    "hr_uploads": frozenset({"select", "insert", "update", "delete", "upsert"}),
    "learning_path_records": frozenset({"select", "insert", "delete"}),
    "legal_conversations": frozenset({"select", "insert", "update", "delete", "upsert"}),
    "site_feedback": frozenset({"select", "insert"}),
    "strategic_radar_analyses": frozenset({"select", "insert", "update", "delete", "upsert"}),
    "support_chat_logs": frozenset({"select", "insert", "update", "upsert"}),
    "unicorn_analyses": frozenset({"select", "insert", "update", "delete", "upsert"}),
    "user_credits": frozenset({"select"}),
    "user_purchases": frozenset({"select"}),
    "user_roles": frozenset({"select"}),
    "credit_transactions": frozenset({"select"}),
}


class CompatAccessError(RuntimeError):
    pass


class CompatAccessForbiddenError(CompatAccessError):
    pass


async def is_compat_admin(db: AsyncSession, principal: Principal) -> bool:
    if "admin" in principal.app_roles:
        return True
    roles = set(await list_platform_roles(db, principal.user_id))
    return not roles.isdisjoint(ADMIN_ROLES)


def _data_user_id(data: dict[str, Any], field: str) -> UUID | None:
    raw = data.get(field)
    if raw is None:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


async def _records(db: AsyncSession, table: str) -> list[CompatRecord]:
    result = await db.execute(select(CompatRecord).where(CompatRecord.table_name == table))
    return list(result.scalars().all())


async def _compass_role(db: AsyncSession, principal: Principal) -> str | None:
    for record in await _records(db, "compass_user_roles"):
        if _data_user_id(record.data, "user_id") == principal.user_id:
            role = record.data.get("role")
            return str(role) if role is not None else None
    return None


async def _is_compass_ceo(db: AsyncSession, principal: Principal) -> bool:
    return (await _compass_role(db, principal)) == "ceo"


async def _is_compass_user(db: AsyncSession, principal: Principal) -> bool:
    return (await _compass_role(db, principal)) is not None


async def _owns_behavior(db: AsyncSession, principal: Principal, behavior_id: object) -> bool:
    if behavior_id is None:
        return False
    target = str(behavior_id)
    for record in await _records(db, "behaviors"):
        data = record.data
        if record.record_id == target or str(data.get("id")) == target:
            return _data_user_id(data, "deputy_id") == principal.user_id
    return False


async def _owns_legal_conversation(
    db: AsyncSession,
    principal: Principal,
    conversation_id: object,
) -> bool:
    if conversation_id is None:
        return False
    target = str(conversation_id)
    for record in await _records(db, "legal_conversations"):
        data = record.data
        if record.record_id == target or str(data.get("id")) == target:
            return (
                record.owner_user_id == principal.user_id
                or _data_user_id(data, "user_id") == principal.user_id
            )
    return False


async def can_read_record(
    db: AsyncSession,
    *,
    principal: Principal,
    table: str,
    record: CompatRecord,
    is_admin: bool,
) -> bool:
    table_scope = scope_for(table)
    data = record.data

    if is_admin:
        return table_scope.scope != "dedicated"
    if table_scope.scope == "dedicated":
        return False
    if table_scope.scope in {"global_public", "global_authenticated"}:
        return record.owner_user_id is None and record.company_id is None
    if table_scope.scope == "admin_only":
        return False
    if table_scope.scope == "personal":
        owner_field = table_scope.owner_field
        return bool(
            record.owner_user_id == principal.user_id
            or (
                owner_field is not None
                and _data_user_id(data, owner_field) == principal.user_id
            )
        )

    # Legacy relationship-aware RLS for Strategic Compass / Legal messages.
    if table == "compass_user_roles":
        return _data_user_id(data, "user_id") == principal.user_id or await _is_compass_ceo(db, principal)
    if table == "behaviors":
        return _data_user_id(data, "deputy_id") == principal.user_id or await _is_compass_ceo(db, principal)
    if table == "bet_allocations":
        return _data_user_id(data, "user_id") == principal.user_id or await _is_compass_ceo(db, principal)
    if table == "scenario_responses":
        return _data_user_id(data, "user_id") == principal.user_id or await _is_compass_ceo(db, principal)
    if table == "decision_journals":
        return await _is_compass_ceo(db, principal) or await _owns_behavior(
            db, principal, data.get("behavior_id")
        )
    if table == "intent_assignments":
        return _data_user_id(data, "user_id") == principal.user_id or await _is_compass_ceo(db, principal)
    if table == "scenarios":
        return bool(data.get("is_active") is True or await _is_compass_ceo(db, principal))
    if table == "strategic_bets":
        return True  # Legacy RLS allowed every authenticated user to read bets.
    if table == "strategic_intents":
        return bool(data.get("status") == "active" or await _is_compass_ceo(db, principal))
    if table == "strategic_achievements":
        return await _is_compass_user(db, principal) or await _is_compass_ceo(db, principal)
    if table == "legal_messages":
        return await _owns_legal_conversation(db, principal, data.get("conversation_id"))
    return False


async def ensure_table_operation_allowed(
    db: AsyncSession,
    *,
    principal: Principal,
    table: str,
    operation: str,
    is_admin: bool,
) -> TableScope:
    try:
        table_scope = scope_for(table)
    except TableScopeError as exc:
        raise CompatAccessForbiddenError(str(exc)) from exc

    if table_scope.scope == "dedicated":
        raise CompatAccessForbiddenError(f"{table} must use its dedicated HRing API")
    if is_admin:
        return table_scope
    if table_scope.scope == "admin_only":
        raise CompatAccessForbiddenError(f"{table} requires platform administration access")
    if table_scope.scope in {"global_public", "global_authenticated"}:
        if operation != "select":
            raise CompatAccessForbiddenError("Global content writes require content-admin access")
        return table_scope
    if table_scope.scope == "personal":
        allowed = PERSONAL_OPERATION_RULES.get(table, frozenset({"select"}))
        if operation not in allowed:
            raise CompatAccessForbiddenError(f"{operation} is not allowed for {table}")
        return table_scope

    # Compass writes mirror the legacy RLS intent. Read filtering is record-specific.
    if operation == "select":
        return table_scope
    is_ceo = await _is_compass_ceo(db, principal)
    if table in {"intent_assignments", "scenarios", "strategic_bets", "strategic_intents", "compass_user_roles"}:
        if not is_ceo:
            raise CompatAccessForbiddenError("This Strategic Compass mutation requires CEO access")
        return table_scope
    if table == "strategic_achievements":
        if operation == "insert" or is_ceo:
            return table_scope
        raise CompatAccessForbiddenError("Only CEO can modify existing strategic achievements")
    if table == "legal_messages":
        if operation != "insert":
            raise CompatAccessForbiddenError("Legal messages are append-only for conversation owners")
        return table_scope
    # behaviors, bet_allocations, scenario_responses, decision_journals are owner-managed.
    return table_scope


async def metadata_for_insert(
    db: AsyncSession,
    *,
    principal: Principal,
    table: str,
    values: dict[str, Any],
    is_admin: bool,
) -> tuple[UUID | None, UUID | None]:
    table_scope = scope_for(table)
    if table_scope.scope in {"global_public", "global_authenticated", "admin_only"}:
        return None, None
    if table_scope.scope == "personal":
        owner_field = table_scope.owner_field
        if owner_field is None:
            raise CompatAccessForbiddenError("Personal table is missing an owner field")
        if is_admin:
            raw = values.get(owner_field)
            return (_data_user_id(values, owner_field) if raw is not None else principal.user_id), None
        try:
            return personal_owner_id(
                values=values,
                owner_field=owner_field,
                principal_id=principal.user_id,
            ), None
        except TableScopeError as exc:
            raise CompatAccessForbiddenError(str(exc)) from exc

    if table in {"behaviors"}:
        field = "deputy_id"
    elif table in {"bet_allocations", "scenario_responses", "strategic_achievements", "compass_user_roles", "intent_assignments"}:
        field = "user_id"
    else:
        field = ""

    if field:
        if is_admin or await _is_compass_ceo(db, principal):
            return _data_user_id(values, field), None
        try:
            return personal_owner_id(values=values, owner_field=field, principal_id=principal.user_id), None
        except TableScopeError as exc:
            raise CompatAccessForbiddenError(str(exc)) from exc

    if table == "decision_journals":
        if not is_admin and not await _owns_behavior(db, principal, values.get("behavior_id")):
            raise CompatAccessForbiddenError("Journal must belong to the current deputy's behavior")
        return principal.user_id if not is_admin else None, None
    if table == "legal_messages":
        if not is_admin and not await _owns_legal_conversation(
            db, principal, values.get("conversation_id")
        ):
            raise CompatAccessForbiddenError("Message must belong to the current user's conversation")
        return principal.user_id if not is_admin else None, None
    return None, None


async def ensure_record_mutation_allowed(
    db: AsyncSession,
    *,
    principal: Principal,
    table: str,
    operation: str,
    record: CompatRecord,
    new_values: dict[str, Any] | None,
    is_admin: bool,
) -> None:
    if is_admin:
        return
    if not await can_read_record(
        db,
        principal=principal,
        table=table,
        record=record,
        is_admin=False,
    ):
        raise CompatAccessForbiddenError("Record is outside the current authorization scope")

    table_scope = scope_for(table)
    if table_scope.scope == "personal":
        if table_scope.owner_field and new_values and table_scope.owner_field in new_values:
            owner = _data_user_id(new_values, table_scope.owner_field)
            if owner != principal.user_id:
                raise CompatAccessForbiddenError("Record ownership cannot be transferred")
        return

    if table == "behaviors" and _data_user_id(record.data, "deputy_id") != principal.user_id:
        raise CompatAccessForbiddenError("Only the assigned deputy can modify this behavior")
    if table in {"bet_allocations", "scenario_responses"} and _data_user_id(record.data, "user_id") != principal.user_id:
        raise CompatAccessForbiddenError("Only the record owner can modify this record")
    if table == "decision_journals" and not await _owns_behavior(
        db, principal, record.data.get("behavior_id")
    ):
        raise CompatAccessForbiddenError("Only the assigned deputy can modify this journal")
    if table == "strategic_achievements" and operation != "insert":
        raise CompatAccessForbiddenError("Only CEO can modify existing strategic achievements")
    if table == "legal_messages" and operation != "insert":
        raise CompatAccessForbiddenError("Legal messages are append-only")
