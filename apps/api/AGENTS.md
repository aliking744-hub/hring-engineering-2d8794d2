# HRing API Agent Rules

This file applies to `apps/api/**`.

## Architecture
- Backend framework: FastAPI.
- Validation/contracts: Pydantic v2.
- Persistence: SQLAlchemy 2 async + PostgreSQL/pgvector.
- Schema migration: Alembic only; never mutate production schema ad hoc.
- Background work: Celery or an explicitly approved equivalent backed by Redis.
- Object storage: private S3-compatible storage/MinIO with presigned access.
- AI: provider-neutral OpenAI-compatible adapter; internal vLLM/Ollama is the default independence target.

## Hard Rules
- Never introduce Supabase SDK, Supabase URLs, Supabase Auth, Supabase Storage, or Supabase Edge Function dependencies into this backend.
- Never place authorization decisions in the frontend only.
- Every tenant-owned resource must have an explicit tenant/ownership boundary and server-side authorization.
- Sensitive actions require audit events.
- Secrets come from environment/secret management only.
- External AI/search/payment/storage providers must live behind adapters.
- API routes are versioned under `/api/v1` until a deliberate version change is approved.
- Do not expose raw database models as public API contracts.

## Change Protocol
Before changing a domain, identify its current Supabase tables/functions/RLS behavior and preserve the business/security behavior in the independent implementation.

For every migrated endpoint add:
1. Pydantic request/response contracts.
2. Server-side auth/RBAC/tenant checks.
3. Repository/service separation.
4. Tests for happy path and unauthorized/cross-tenant behavior.
5. Migration/rollback notes when persistence changes.

## Definition of Done
A module is not migrated merely because a new endpoint exists. It is migrated only when frontend traffic uses the independent API, required data/files are reconciled, tests pass, observability exists, rollback is documented, and the corresponding Supabase runtime dependency can be removed safely.
