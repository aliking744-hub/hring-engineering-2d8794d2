import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('onboarding preserves Lovable labels, phases, and provider controls', async () => {
  const ai = await read('apps/api/src/hring_api/domains/development/ai_service.py');

  assert.match(ai, /جونیور \(۰-۲ سال\)/);
  assert.match(ai, /تحویل سریع و کارایی/);
  assert.match(ai, /ماه اول: فاز یادگیری \(روز ۱-۳۰\)/);
  assert.match(ai, /ماه دوم: فاز مشارکت \(روز ۳۱-۶۰\)/);
  assert.match(ai, /ماه سوم: فاز استقلال \(روز ۶۱-۹۰\)/);
  assert.match(ai, /temperature=0\.7/);
  assert.match(ai, /source_contract.*lovable\.generate-onboarding-plan/);
});

test('learning path enforces realistic one-focus-per-month capacity', async () => {
  const ai = await read('apps/api/src/hring_api/domains/development/ai_service.py');

  assert.match(ai, /ONE course per month/);
  assert.match(ai, /EXACTLY.*milestones/);
  assert.match(ai, /at least 4 hard skills/);
  assert.match(ai, /at least 3 soft skills/);
  assert.match(ai, /len\(validated\.roadmap\) != expected_months/);
  assert.match(ai, /employee identity.*excluded from the provider payload/);
});

test('development prompt migration publishes the exact source contracts', async () => {
  const migration = await read(
    'apps/api/alembic/versions/20260829_0024_restore_development_prompts.py',
  );

  assert.match(migration, /down_revision: str \| None = "20260829_0023"/);
  assert.match(migration, /development\.onboarding_plan/);
  assert.match(migration, /development\.learning_path/);
  assert.match(migration, /gemini-3-flash-preview/);
  assert.match(migration, /'published'/);
  assert.match(migration, /SET status = 'archived'/);
});
