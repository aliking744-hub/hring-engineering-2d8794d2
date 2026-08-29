import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('labor complaint keeps the four exact evidence contracts', async () => {
  const source = await read('apps/api/src/hring_api/domains/compat/labor_complaint.py');

  for (const claim of ['wrongful_termination', 'unpaid_salary', 'insurance_claim', 'severance_pay']) {
    assert.match(source, new RegExp(`"${claim}"`));
  }
  assert.match(source, /search_legal_knowledge/);
  assert.match(source, /match_count=8/);
  assert.match(source, /match_threshold=0\.5/);
  assert.match(source, /winProbability/);
  assert.match(source, /ریاست محترم هیات تشخیص اداره کار/);
});

test('legacy complaint UI is routed into the native legal workflow', async () => {
  const functions = await read('apps/api/src/hring_api/domains/compat/functions.py');
  const catalog = await read('apps/api/src/hring_api/domains/ai/feature_catalog.py');

  assert.match(functions, /feature_key = "legal\.labor_complaint"/);
  assert.match(functions, /required_evidence\(body\)/);
  assert.match(functions, /build_context\(session, body\)/);
  assert.match(catalog, /legal\.labor_complaint/);
});

test('legal search remains on the native sourced vector endpoint', async () => {
  const search = await read('src/components/LegalSearch.tsx');

  assert.match(search, /apiRequest<SearchResult\[]>\('\/legal\/search'/);
  assert.match(search, /source_url/);
  assert.match(search, /article_number/);
  assert.equal(/search-legal-docs|supabase\.functions/.test(search), false);
});

test('support uses live platform knowledge and emits the widget SSE contract', async () => {
  const support = await read('apps/api/src/hring_api/domains/compat/support.py');
  const routes = await read('apps/api/src/hring_api/domains/compat/routes.py');
  const functions = await read('apps/api/src/hring_api/domains/compat/functions.py');

  assert.match(support, /support_system_prompt/);
  assert.match(support, /support_phone/);
  assert.match(support, /AI_FEATURES/);
  assert.match(support, /قابلیت حذف‌شده یا ناموجود نساز/);
  assert.match(functions, /feature_key = "support\.hring"/);
  assert.match(routes, /text\/event-stream/);
  assert.match(routes, /data: \[DONE\]/);
});

test('active interview screen uses the restored interview kit, not dead guide code', async () => {
  const screen = await read('src/pages/InterviewAssistant.tsx');

  assert.match(screen, /generate-interview-kit/);
  assert.equal(/generate-interview-guide/.test(screen), false);
});

test('new migrations are linear and headhunting remains out of scope', async () => {
  const labor = await read(
    'apps/api/alembic/versions/20260829_0025_restore_labor_complaint_prompt.py',
  );
  const support = await read(
    'apps/api/alembic/versions/20260829_0026_restore_support_prompt.py',
  );

  assert.match(labor, /down_revision: str \| None = "20260829_0024"/);
  assert.match(support, /down_revision: str \| None = "20260829_0025"/);
  assert.equal(/headhunt/i.test(labor + support), false);
});
