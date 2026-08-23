# HRing Independence Engineering Backlog

This backlog is the implementation checklist for replacing the current Lovable/Supabase runtime with the independent HRing platform. Items are acceptance requirements, not optional ideas.

## P0 — Foundation
- [x] Establish isolated engineering repository and non-production workflow.
- [x] Record current build/type/lint baseline.
- [x] Add agent/change rules and architecture documentation.
- [x] Scaffold independent FastAPI/Pydantic backend.
- [x] Define PostgreSQL/pgvector, Redis and MinIO development stack.
- [ ] Add Alembic baseline and database naming conventions.
- [ ] Add backend CI: ruff, mypy, pytest, container build.
- [ ] Add request IDs, structured errors and structured logging.
- [ ] Add dev/staging/production configuration contract.

## P1 — Identity, Authentication and Tenancy
- [ ] Inventory current Supabase Auth flows and dependent UI.
- [ ] Implement independent users/credentials/sessions model.
- [ ] Implement login, logout, refresh, password reset and session revocation.
- [ ] Implement MFA support for privileged accounts.
- [ ] Implement companies/tenants and memberships.
- [ ] Implement server-side RBAC/feature permission enforcement.
- [ ] Add IDOR and cross-tenant authorization tests.
- [ ] Migrate users/companies/memberships from Supabase with reconciliation.
- [ ] Switch frontend auth client to HRing API.
- [ ] Remove Supabase Auth runtime dependency.

## P2 — Smart Headhunting / Candidates Golden Module
- [ ] Inventory `campaigns`, `candidates`, RLS and all current callers.
- [ ] Inventory `auto-headhunt` and `analyze-candidates` contracts/providers/retries/side effects.
- [ ] Implement campaign/candidate domain models and repositories in PostgreSQL.
- [ ] Implement versioned campaign/candidate endpoints.
- [ ] Move AI orchestration behind backend service/adapters.
- [ ] Implement background jobs for long-running headhunting work.
- [ ] Add idempotency, retries and failure visibility.
- [ ] Migrate/reconcile campaign and candidate data.
- [ ] Switch Smart Headhunting UI to centralized HRing API client.
- [ ] Remove corresponding Supabase tables/function runtime dependency.

## P3 — AI Platform
- [ ] Inventory every AI/search/scraping provider and current prompt.
- [ ] Create provider-neutral AI gateway.
- [ ] Support OpenAI-compatible internal endpoint using vLLM/Ollama.
- [ ] Add model/provider configuration in admin.
- [ ] Add prompt versioning and rollback.
- [ ] Validate structured model outputs before persistence.
- [ ] Add RAG/pgvector where domain requirements justify it.
- [ ] Add API key rotation/scopes/quotas.
- [ ] Add usage/cost/latency/error telemetry.
- [ ] Remove model/provider credentials and direct calls from frontend.

## P4 — Files and Document Processing
- [ ] Inventory Supabase Storage/file flows and current document extraction functions.
- [ ] Implement private MinIO/S3 buckets.
- [ ] Implement presigned upload/download.
- [ ] Implement MIME/size validation and malware scanning policy.
- [ ] Migrate files with checksums and source/destination reconciliation.
- [ ] Switch frontend file traffic to HRing API.
- [ ] Remove Supabase Storage runtime dependency.

## P5 — Credits, Plans, Billing and Payments
- [ ] Inventory credit/payment tables, functions and client assumptions.
- [ ] Implement transactional credit ledger in PostgreSQL.
- [ ] Implement plans/entitlements/feature permissions server-side.
- [ ] Implement payment provider adapter(s), callbacks and idempotency.
- [ ] Implement audit/reconciliation reports.
- [ ] Add tests preventing double-spend/double-credit.
- [ ] Switch frontend billing/credits to HRing API.

## P6 — Administration / HRing Control Center
- [ ] Users and companies.
- [ ] Roles/RBAC/feature permissions.
- [ ] Plans, credits and payments.
- [ ] Files/storage visibility.
- [ ] AI providers, models and prompts.
- [ ] API keys/connections.
- [ ] Feature flags.
- [ ] Background jobs/queues/failed jobs/retry.
- [ ] Audit logs.
- [ ] Support/system health/reports.
- [ ] Tenant/system settings.

## P7 — Remaining Product Domains
For each current route/table/function, repeat the same migration protocol: contract inventory -> independent service -> auth/tenant tests -> data reconciliation -> frontend cutover -> remove Supabase dependency.

Domains include:
- [ ] Job Engineering.
- [ ] Smart Ads.
- [ ] Interview.
- [ ] Onboarding.
- [ ] Learning Path.
- [ ] HR Dashboard / Analytics.
- [ ] Legal Intelligence.
- [ ] Strategic Compass.
- [ ] Strategic Radar.
- [x] Retire Unicorn Lab by product-owner decision; retain shared funding tracking under Strategic Radar.
- [ ] Digital Products / Marketplace.
- [ ] Notifications / Support.
- [ ] Blog/site/content/settings/feedback.

## P8 — Edge Function Exit
Create a contract inventory for every current execution function, including input/output, authentication, permission, validation, provider/model/prompt, timeout, retry and side effects. Reimplement or retire each function explicitly. No orphaned function may be silently dropped.

Current inventory must cover all functions present under `supabase/functions` plus shared utilities.

## P9 — Observability, Security and Operations
- [ ] Prometheus metrics.
- [ ] Grafana dashboards.
- [ ] Loki structured logs.
- [ ] Central error visibility and actionable failed-job logs.
- [ ] Security review for auth, RBAC, IDOR, file access and secret handling.
- [ ] Performance/load tests for critical paths.
- [ ] Backup/restore drill.
- [ ] Migration rollback drill.
- [ ] Clean-server install from documentation.

## P10 — Environments and Delivery
- [ ] Reproducible Docker Compose development environment.
- [ ] Staging created from zero using code + migrations.
- [ ] Production deployment pipeline with explicit approval and rollback.
- [ ] No production deploy path from the engineering mirror until promotion policy is approved.
- [ ] Separate secrets/config for dev, staging and production.

## P11 — Final Supabase/Lovable Removal Gate
- [ ] No `@supabase/supabase-js` runtime usage.
- [ ] No operational `*.supabase.co` URLs.
- [ ] No Supabase Auth dependency.
- [ ] No Supabase Storage dependency.
- [ ] No Supabase database dependency.
- [ ] No Supabase Edge Function dependency.
- [ ] No Lovable operational/build/deployment dependency.
- [ ] Remove obsolete Supabase migrations/functions/integration code only after verified cutover and rollback window.

## P12 — Handover / Ownership
- [ ] Employer/user-owned source repositories and infrastructure accounts.
- [ ] Complete secret/access inventory without committing secrets.
- [ ] Database schema/migrations documentation.
- [ ] API/OpenAPI documentation.
- [ ] AI provider/model/prompt documentation.
- [ ] Docker/deployment/runbooks.
- [ ] Backup/restore/runbook.
- [ ] Monitoring/incident runbook.
- [ ] Training/operational handover.
- [ ] Warranty/defect acceptance process for external delivery if applicable.

## Independence Definition of Done
The platform passes only when a clean environment can run HRing from owned source code and documented infrastructure without Lovable or Supabase, and migrated data/files reconcile with an exercised rollback path.
