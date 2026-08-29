# PR66 preparation pack

Source baseline: `main@1379881cc362aedf6027c415856eaaa924ed3e38`

This branch accumulates changes that do not require GitHub Actions minutes or live production credentials. It must not be merged or deployed until the full quality gates run successfully.

## Work that can be prepared now

- Static Lovable/Supabase runtime inventory and rejection checks.
- Frontend typecheck, safety/smoke tests and build definitions.
- Backend Ruff, Mypy, Pytest and migration checks.
- Auth/RBAC/tenant test matrix.
- Credit coverage and marketplace authorization hardening.
- CMS, demo/hardcode and public-content audit.
- Storage policy, MIME and path-traversal tests.
- AI prompt/output contract tests using fixtures.
- Worker/job contracts without calling external providers.
- Load-test and UAT scripts.
- Runbooks, acceptance matrix, migration mapping and release checklist.
- Implementation code that can be validated with mocks and local services.

## Work that needs live access later

- GitHub Actions execution and required status checks.
- Branch protection changes.
- Real Zarinpal sandbox payment and reconciliation.
- SMS/email delivery tests.
- External AI provider and fallback tests.
- Real Make/PhantomBuster sourcing webhook.
- Migration export from the source Lovable/Supabase project.
- Offsite backup target and restore drill.
- Staging deploy, browser UAT, load test and clean-server install.

## First hardening decision

Marketplace entitlement is server-authoritative. A browser user may read their purchases but cannot insert a `user_purchases` record. Verified payment processing will be the only normal path that creates an entitlement.

## Merge gate

Before opening the final PR:

1. Run `bash scripts/pr66-offline-preflight.sh`.
2. Run Alembic round-trip against an empty PostgreSQL database.
3. Confirm all GitHub checks are green.
4. Review the full diff for scope and migration risk.
5. Perform one consolidated Staging deployment; never deploy Production without Ali's explicit approval.
