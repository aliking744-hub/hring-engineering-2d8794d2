# HRing Reengineering Execution Order

This is the working sequence for AI agents and human developers.

1. Independent platform foundation (`apps/api`, PostgreSQL/pgvector, Redis, MinIO, CI).
2. Identity/Auth/Tenancy/RBAC.
3. Smart Headhunting/Candidates Golden Module on the independent API.
4. AI gateway and background-job infrastructure.
5. Files/document pipeline.
6. Credits/plans/billing/payments.
7. Administration / HRing Control Center.
8. Remaining product domains route-by-route.
9. Full Edge Function retirement/migration inventory.
10. Observability, security, backup/restore and load validation.
11. Data/file reconciliation and staged cutover.
12. Remove Supabase/Lovable runtime dependencies.
13. Clean-server installation and handover acceptance.

## Rule
Do not delete a working Supabase dependency before its independent replacement is implemented, tested, data-reconciled and rollback-ready. The final state must contain no operational Supabase dependency; the migration path must remain reversible until cutover is proven.
