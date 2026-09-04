import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('cost calculator is server-authoritative, current-year and explicitly metered', async () => {
  const page = await read('src/pages/CostCalculator.tsx');
  const routes = await read('apps/api/src/hring_api/domains/costing/routes.py');
  const service = await read('apps/api/src/hring_api/domains/costing/service.py');

  assert.match(page, /\/costing\/statutory-rates\/current/);
  assert.match(page, /\/costing\/calculate/);
  assert.match(page, /X-Idempotency-Key/);
  assert.match(page, /محاسبه نهایی \(۵ اعتبار\)/);
  assert.equal(page.includes('useMemo'), false);
  assert.match(routes, /run_with_credit_reservation/);
  assert.match(routes, /COST_CALCULATOR_DEFAULT_CREDIT_COST = 5/);
  assert.match(service, /year=1405/);
  assert.match(service, /housing_allowance_rial=30_000_000/);
  assert.match(service, /grocery_allowance_rial=22_000_000/);
});

test('HR dashboard charges demo and spreadsheet differently before reveal', async () => {
  const page = await read('src/pages/HRDashboard.tsx');
  const upload = await read('src/components/hr-dashboard/UploadPage.tsx');
  const routes = await read('apps/api/src/hring_api/domains/hr_data/routes.py');

  assert.match(routes, /HR_DASHBOARD_DEMO_DEFAULT_CREDIT_COST = 5/);
  assert.match(routes, /HR_DASHBOARD_UPLOAD_DEFAULT_CREDIT_COST = 15/);
  assert.match(routes, /dashboard_upload_credit_cost/);
  assert.match(routes, /run_with_credit_reservation/);
  assert.match(routes, /X-Idempotency-Key/);
  assert.ok(page.indexOf('const id = await persistUpload') < page.indexOf('setData(employees)'));
  assert.match(upload, /Promise<void>/);
  assert.match(upload, /await onDataLoaded/);
});

test('support and legal calls use independent metered API paths', async () => {
  const client = await read('src/integrations/supabase/client.ts');
  const support = await read('src/components/SupportChatWidget.tsx');
  const legal = await read('apps/api/src/hring_api/domains/legal/routes.py');

  assert.equal(support.includes('/functions/v1/hring-support'), false);
  assert.match(support, /functions\.invoke\('hring-support'/);
  assert.match(client, /'hring-support'/);
  assert.match(client, /'legal-advisor-chat'/);
  assert.match(client, /'defense-builder'/);
  assert.match(legal, /feature_credit_cost/);
  assert.match(legal, /run_with_credit_reservation/);
});

test('runtime migration preserves admin routes and seeds cost baselines', async () => {
  const migration = await read(
    'apps/api/alembic/versions/20260902_0032_runtime_routing_and_metering.py',
  );

  assert.match(migration, /down_revision: str \| None = "20260831_0031"/);
  assert.match(migration, /provider_alias = 'avalai\.primary'/);
  assert.match(migration, /provider_alias = 'avalai\.search'/);
  assert.match(migration, /costing\.employee_cost_calculator/);
  assert.match(migration, /hr_data\.dashboard_upload/);
  assert.match(migration, /ai_rate_cards/);
  assert.match(migration, /intentionally not reversed/);
});
