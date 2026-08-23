# HRing Engineering Agent Constitution

## Scope
This repository is the isolated engineering mirror of HRing. Production HRing is outside this repository's change boundary unless a human explicitly authorizes a production promotion.

## Prime Directive
Make the smallest safe change that satisfies the request. Preserve existing behavior unless the requested change explicitly requires behavior to change.

## Hard Safety Rules
- Never deploy to the production CloudIva service from this repository.
- Never add production deployment credentials or commands to automated workflows in this repository.
- Never push application changes directly to `main`; work on a named branch and review the diff first.
- Never bypass RBAC, authentication, tenant boundaries, credit checks, billing checks, or audit logging.
- Never expose service-role keys, API keys, payment credentials, or secrets in client code, logs, documentation, commits, or prompts.
- Never change database schema without an explicit migration and impact analysis.
- Never delete or rewrite existing migrations to make a new change fit.
- Never change shared components, auth, credits, billing, company membership, permissions, or routing without checking downstream consumers.
- Never replace an existing provider or integration as a side effect of an unrelated task.
- Never perform broad formatting/refactors in the same change as a functional fix.

## Required Change Protocol
Before editing:
1. Restate the requested behavior in one sentence.
2. Identify the affected domain(s), routes, hooks/components, Edge Functions, tables, external integrations, permissions and migration risk.
3. Search for all callers/consumers of the symbols being changed.
4. Decide whether the change is UI-only, domain logic, data contract, persistence, integration, infrastructure or migration.

During editing:
5. Keep the diff narrow.
6. Do not add new direct Supabase calls from UI code.
7. New backend functionality belongs behind the independent HRing API unless the change is explicitly a temporary migration adapter.
8. Preserve backwards compatibility until the replacement path is tested and rollback-ready.
9. Add or update tests for the affected layer.
10. Add comments only where intent is non-obvious; do not narrate obvious code.

Before completion:
11. Run the relevant frontend/backend type, test and build checks.
12. Distinguish pre-existing lint failures from newly introduced failures.
13. Inspect the final diff for unrelated changes.
14. Report affected files, validation results, known risks, migration impact and rollback path.

## Architectural Direction
HRing is being evolved incrementally into an AI-maintainable modular monolith. Do not rewrite the product from scratch and do not perform a big-bang Supabase deletion.

Final target dependency direction:

UI -> centralized HRing API client -> FastAPI domain/service layer -> repositories/adapters -> PostgreSQL/pgvector, Redis, MinIO, AI/providers

The current Supabase runtime is transitional technical debt. It must be removed domain-by-domain only after the independent replacement is implemented, tested, reconciled and rollback-ready. The final accepted platform must contain no operational Supabase or Lovable runtime dependency.

## Target Independent Stack
- FastAPI + Pydantic v2
- SQLAlchemy 2 async
- PostgreSQL + pgvector
- Alembic migrations
- Redis
- Celery or an explicitly approved equivalent
- Private S3-compatible storage / MinIO
- Provider-neutral AI gateway with internal vLLM/Ollama OpenAI-compatible target
- Docker Compose for reproducible environments
- Prometheus + Grafana + Loki for observability
- CI/CD with dev/staging/production separation and rollback

## Initial Domain Boundaries
- Identity & Authentication
- Companies & Membership
- RBAC / Feature Permissions
- Credits, Plans, Billing & Payments
- Job Engineering
- Smart Ads
- Interview
- Onboarding & Learning
- Smart Headhunting
- Candidates & Campaigns
- HR Dashboard & Analytics
- Legal Intelligence
- Strategic Compass / Strategic Radar
- Strategic Intelligence (Strategic Compass / Strategic Radar; Unicorn Lab retired by product-owner decision)
- Digital Products / Marketplace
- Notifications & Support
- Administration / Control Center
- AI & External Integrations

## Data & Multi-Tenancy
- Treat `company_id`, user ownership, role checks and current RLS behavior as security requirements that must be preserved or strengthened in the independent backend.
- Server-side authorization must be authoritative; client-side hiding is not authorization.
- Every migrated tenant-owned resource requires cross-tenant/IDOR tests.
- For new tables, define ownership/tenant model, indexes, audit requirements and migration strategy before implementation.
- For schema changes, document forward migration and rollback/mitigation strategy.

## AI / External Provider Rules
- AI provider configuration must not be hardwired into UI components.
- Use a gateway/adapter so model/provider changes do not require page-level rewrites.
- Validate structured AI outputs before persistence.
- External scraping/search/payment/email/storage services must fail safely and expose actionable logs without leaking secrets.

## Migration Rule
Do not delete a working Supabase Auth/DB/Storage/Function path until:
1. its current contract and security behavior are inventoried,
2. its independent replacement exists,
3. tests pass,
4. required data/files reconcile,
5. frontend traffic has been switched in staging,
6. observability is available, and
7. rollback is documented and exercised where appropriate.

## Baseline as of Foundation 01
- Production build: passing.
- TypeScript `tsc --noEmit`: passing.
- Lint: failing on pre-existing issues; do not treat the baseline lint failure as newly introduced without comparing deltas.
- Source files under `src`: 257.
- Supabase client direct imports in `src`: 31 files.
- `supabase.functions.invoke` references in `src`: 35 files / 44 occurrences.
- The engineering database is separate from the production HRing database.

## Definition of Done for Future Changes
A change is not complete merely because the preview looks correct. It is complete when its behavior, data contract, authorization boundary, build/type safety, regression risk, migration impact and rollback path have been checked and reported.

For the full reengineering program, completion additionally requires the independence acceptance gate in `docs/architecture/INDEPENDENT_PLATFORM.md` and the full checklist in `docs/engineering/INDEPENDENCE_BACKLOG.md`.
