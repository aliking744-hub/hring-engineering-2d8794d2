import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('employee development pages use typed native APIs only', async () => {
  const onboarding = await read('src/pages/SuccessArchitect.tsx');
  const learning = await read('src/pages/LearningPath.tsx');

  assert.match(onboarding, /\/development\/onboarding-plans\/generate/);
  assert.match(onboarding, /X-Idempotency-Key/);
  assert.equal(/integrations\/supabase|supabase\.|generate-onboarding-plan/.test(onboarding), false);

  assert.match(learning, /\/development\/learning-paths\/generate/);
  assert.match(learning, /\/development\/learning-paths\/\$\{targetRecordId\}\/email/);
  assert.match(learning, /X-Idempotency-Key/);
  assert.equal(
    /integrations\/supabase|supabase\.|learning_path_records|generate-learning-path|send-learning-path-email/.test(learning),
    false,
  );
});

test('native development persistence is authenticated and owner scoped', async () => {
  const routes = await read('apps/api/src/hring_api/domains/development/routes.py');
  const repository = await read('apps/api/src/hring_api/domains/development/repository.py');
  const service = await read('apps/api/src/hring_api/domains/development/service.py');

  assert.match(routes, /get_current_principal/);
  assert.match(routes, /X-Idempotency-Key/);
  assert.match(repository, /LearningPath\.owner_user_id == owner_user_id/);
  assert.match(repository, /OnboardingPlan\.owner_user_id == owner_user_id/);
  assert.match(service, /run_with_credit_reservation/);
  assert.match(service, /feature_credit_cost/);
});

test('learning AI payload excludes employee identity and email delivery trusts stored rows', async () => {
  const ai = await read('apps/api/src/hring_api/domains/development/ai_service.py');
  const service = await read('apps/api/src/hring_api/domains/development/service.py');

  assert.match(ai, /Deliberately omit employee name\/email/);
  assert.equal(/provider_input[\s\S]*employee_name/.test(ai), false);
  assert.equal(/provider_input[\s\S]*employee_email/.test(ai), false);
  assert.match(service, /row\.employee_email/);
  assert.match(service, /result=row\.result/);
});

test('native development migration follows head and preserves rollback data', async () => {
  const migration = await read(
    'apps/api/alembic/versions/20260824_0015_native_employee_development.py',
  );

  assert.match(migration, /down_revision: str \| None = "20260824_0014"/);
  assert.match(migration, /development_onboarding_plans/);
  assert.match(migration, /development_learning_paths/);
  assert.match(migration, /FROM compat_records AS records/);
  assert.match(migration, /ON CONFLICT \(table_name, record_id\) DO UPDATE/);
  assert.match(migration, /development_onboarding_plans_archive/);
});

