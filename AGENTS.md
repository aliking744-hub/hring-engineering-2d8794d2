# HRing Engineering Agent Constitution

## Scope
This repository is the isolated engineering mirror of HRing. Production HRing is outside this repository's change boundary unless a human explicitly authorizes a production promotion.

## Prime Directive
Make the smallest safe change that satisfies the request. Preserve existing behavior unless the requested change explicitly requires behavior to change.

## Hard Safety Rules
- Never deploy to the production CloudIva service from this repository.
- Never add production deployment credentials or commands to automated workflows in this repository.
- Never push application changes directly to `main`; work on a named branch and review the diff first.
- Never bypass RBAC, RLS, authentication, tenant boundaries, credit checks, billing checks, or audit logging.
- Never expose service-role keys, API keys, payment credentials, or secrets in client code, logs, documentation, commits, or prompts.
- Never change database schema without an explicit migration and impact analysis.
- Never delete or rewrite existing migrations to make a new change fit.
- Never change shared components, auth, credits, billing, company membership, permissions, or routing without checking downstream consumers.
- Never replace an existing provider or integration as a side effect of an unrelated task.
- Never perform broad formatting/refactors in the same change as a functional fix.

## Required Change Protocol
Before editing:
1. Restate the requested behavior in one sentence.
2. Identify the affected domain(s), routes, hooks/components, Edge Functions, tables, external integrations, and permissions.
3. Search for all callers/consumers of the symbols being changed.
4. Decide whether the change is UI-only, domain logic, data contract, persistence, integration, or infrastructure.

During editing:
5. Keep the diff narrow.
6. Prefer stable interfaces/adapters over adding new direct Supabase calls from UI code.
7. Preserve backwards compatibility unless explicitly approved otherwise.
8. Add or update tests when test infrastructure exists for the affected layer.
9. Add comments only where intent is non-obvious; do not narrate obvious code.

Before completion:
10. Run typecheck and build.
11. Run lint and distinguish pre-existing lint failures from new failures.
12. Inspect the final diff for unrelated changes.
13. Report affected files, validation results, known risks, and rollback path.

## Architectural Direction
HRing is being evolved incrementally into an AI-maintainable modular monolith. Do not rewrite the product from scratch.

Target dependency direction:
UI -> domain/service boundary -> API/Edge adapter -> persistence/integrations

Avoid introducing additional direct coupling from pages/components to Supabase. Existing direct calls are technical debt to be reduced gradually through adapters/services, not removed in one big-bang rewrite.

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
- Unicorn Lab / Strategic Intelligence
- Digital Products / Marketplace
- Notifications & Support
- Administration / Control Center
- AI & External Integrations

## Data & Multi-Tenancy
- Treat `company_id`, user ownership, role checks, and RLS policies as security boundaries.
- Server-side authorization must be authoritative; client-side hiding is not authorization.
- For new tables, define ownership/tenant model, RLS, indexes, and audit requirements before implementation.
- For schema changes, document forward migration and rollback/mitigation strategy.

## AI / External Provider Rules
- AI provider configuration must not be hardwired into UI components.
- Prefer a gateway/adapter so model/provider changes do not require page-level rewrites.
- Validate structured AI outputs before persistence.
- External scraping/search/payment/email services must fail safely and expose actionable logs without leaking secrets.

## Baseline as of Foundation 01
- Production build: passing.
- TypeScript `tsc --noEmit`: passing.
- Lint: failing on pre-existing issues; do not treat the baseline lint failure as newly introduced without comparing deltas.
- Source files under `src`: 257.
- Supabase client direct imports in `src`: 31 files.
- `supabase.functions.invoke` references in `src`: 35 files / 44 occurrences.
- The engineering database is separate from the production HRing database.

## Definition of Done for Future Changes
A change is not complete merely because the preview looks correct. It is complete when its behavior, data contract, authorization boundary, build/type safety, regression risk, and rollback path have been checked and reported.
