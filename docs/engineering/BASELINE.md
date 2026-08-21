# Foundation 01 Baseline

Recorded before structural refactoring of HRing Engineering.

## Validation
- Production build: `bun run build` -> PASS (exit 0)
- TypeScript: `bunx tsc --noEmit` -> PASS (exit 0)
- Lint: `bun run lint` -> FAIL (exit 1), pre-existing baseline

## Measured Inventory
- Source files under `src`: 257
- Supabase client imports from `@/integrations/supabase/client`: 31 files / 31 occurrences
- `supabase.functions.invoke`: 35 files / 44 occurrences
- Routes in `src/App.tsx`: 35 including catch-all
- Supabase function directories: 42 functional directories plus `_shared`
- Engineering public tables observed: 38
- GitHub workflows: 1 (`deploy-cloudiva.yml`), converted on the Foundation branch to a no-op safety guard

## Package State
Both npm and Bun lockfiles currently exist (`package-lock.json`, `bun.lockb`/Bun artifacts observed). Package-manager standardization is intentionally deferred; Foundation 01 does not alter dependency resolution.

## Important Repository Observation
The GitHub-connected engineering mirror contains only three migration files dated 2026-08-20, while the live engineering Supabase database contains the broader application schema. Therefore the checked-in migration directory must not yet be treated as a complete reproducible history of the current database. Before database portability work, we need a controlled schema baseline/export and migration reconciliation step.

## Lint Baseline Policy
Future changes must not claim "lint failed because of this change" without comparing against this baseline. Prefer zero new lint errors in touched files; legacy lint debt will be remediated deliberately rather than mixed into unrelated product changes.

## Safety Boundary
Production HRing is not a test environment. All engineering changes start in this mirror and are promoted only after explicit review and approval.
