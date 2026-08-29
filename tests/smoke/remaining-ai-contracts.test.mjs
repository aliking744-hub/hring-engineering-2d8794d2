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


test('company AI connection control plane keeps secrets tenant-scoped and headhunting deferred', async () => {
  const model = await read('apps/api/src/hring_api/domains/company_ai/models.py');
  const service = await read('apps/api/src/hring_api/domains/company_ai/service.py');
  const routes = await read('apps/api/src/hring_api/domains/company_ai/routes.py');
  const migration = await read(
    'apps/api/alembic/versions/20260829_0028_company_ai_connections.py',
  );

  assert.match(model, /secret_ciphertext/);
  assert.match(model, /uq_company_ai_connections_capability/);
  assert.match(service, /ProviderSecretCipher/);
  assert.match(service, /assert_provider_host_is_safe/);
  assert.match(service, /COMPANY_CONFIGURABLE_FEATURE_KEYS/);
  assert.equal(/smart_headhunting\.candidate_analysis/.test(service), false);
  assert.match(routes, /company\.integrations\.read/);
  assert.match(routes, /company\.integrations\.manage/);
  assert.match(migration, /down_revision: str \| None = "20260829_0027"/);
});


test('development and compatibility AI honor healthy company BYOK before managed billing', async () => {
  const development = await read('apps/api/src/hring_api/domains/development/service.py');
  const compatibility = await read('apps/api/src/hring_api/domains/compat/functions.py');

  assert.match(development, /from hring_api\.domains\.company_ai\.service import uses_company_byok/);
  assert.match(development, /capability_key=ONBOARDING_FEATURE_KEY/);
  assert.match(development, /capability_key=LEARNING_PATH_FEATURE_KEY/);
  assert.match(development, /if managed_cost == 0:/);
  assert.match(compatibility, /capability_key=feature_key/);
  assert.match(compatibility, /credits_charged=managed_cost/);
  assert.match(compatibility, /if managed_cost <= 0:/);
});


test('company settings exposes a permission-gated AI connection panel without rendering secrets', async () => {
  const settings = await read('src/pages/CompanySettings.tsx');

  assert.match(settings, /company\.integrations\.read/);
  assert.match(settings, /company\.integrations\.manage/);
  assert.match(settings, /ai-connections\/catalog/);
  assert.match(settings, /\/test/);
  assert.match(settings, /secret_configured/);
  assert.match(settings, /type="password"/);
  assert.equal(/secret_ciphertext/.test(settings), false);
  assert.equal(/smart_headhunting/.test(settings), false);
});
