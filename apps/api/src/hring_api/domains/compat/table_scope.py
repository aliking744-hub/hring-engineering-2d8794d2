from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID


Scope = Literal[
    "personal",
    "global_public",
    "global_authenticated",
    "compass",
    "admin_only",
    "dedicated",
]


@dataclass(frozen=True)
class TableScope:
    scope: Scope
    owner_field: str | None = None


# This map intentionally mirrors the legacy Supabase RLS boundary rather than
# inferring sharing from whether a user happens to belong to a company.
TABLE_SCOPES: dict[str, TableScope] = {
    # Dedicated independent HRing domains: never fall through the generic bridge.
    "campaigns": TableScope("dedicated"),
    "candidates": TableScope("dedicated"),
    "companies": TableScope("dedicated"),
    "company_invites": TableScope("dedicated"),
    "company_members": TableScope("dedicated"),
    "payment_transactions": TableScope("dedicated"),
    "profiles": TableScope("dedicated"),
    "feature_permissions": TableScope("dedicated"),
    "site_settings": TableScope("dedicated"),

    # Public website/product content. Mutations are separately admin-gated.
    "posts": TableScope("global_public"),
    "testimonials": TableScope("global_public"),
    "digital_products": TableScope("global_public"),

    # Global knowledge that legacy RLS exposed only to authenticated users.
    "legal_docs": TableScope("global_authenticated"),

    # Legacy RLS is strictly per-user for these records.
    "notifications": TableScope("personal", "user_id"),
    "hr_uploads": TableScope("personal", "user_id"),
    "learning_path_records": TableScope("personal", "user_id"),
    "legal_conversations": TableScope("personal", "user_id"),
    "site_feedback": TableScope("personal", "user_id"),
    "support_chat_logs": TableScope("personal", "user_id"),
    "user_credits": TableScope("personal", "user_id"),
    "user_purchases": TableScope("personal", "user_id"),
    "user_roles": TableScope("personal", "user_id"),

    # Relationship/CEO/assignee rules. These must never inherit company-wide visibility.
    "legal_messages": TableScope("compass"),

    # Financial/audit data must not become generic tenant data.
    "audit_logs": TableScope("admin_only"),
    "credit_transactions": TableScope("personal", "user_id"),
}


class TableScopeError(RuntimeError):
    pass


def scope_for(table: str) -> TableScope:
    try:
        return TABLE_SCOPES[table]
    except KeyError as exc:
        raise TableScopeError(f"Compatibility table is not explicitly scoped: {table}") from exc


def personal_owner_id(*, values: dict[str, Any], owner_field: str, principal_id: UUID) -> UUID:
    raw = values.get(owner_field)
    if raw is None:
        values[owner_field] = str(principal_id)
        return principal_id
    try:
        owner_id = UUID(str(raw))
    except (TypeError, ValueError) as exc:
        raise TableScopeError(f"{owner_field} must be a valid user id") from exc
    if owner_id != principal_id:
        raise TableScopeError("A personal record cannot be assigned to another user")
    return owner_id
