import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('core HRing routes remain registered', async () => {
  const app = await read('src/App.tsx');
  const requiredRoutes = [
    '/dashboard',
    '/hr-dashboard',
    '/smart-headhunting',
    '/campaign/:id',
    '/campaign/:campaignId/candidate/:candidateId',
    '/admin',
    '/admin/platform',
    '/admin/product',
    '/company-members',
    '/company-settings',
  ];

  for (const route of requiredRoutes) {
    assert.equal(app.includes(`path=\"${route}\"`), true, `missing route: ${route}`);
  }
});

test('admin hub derives control-plane access from server-issued user context', async () => {
  const admin = await read('src/pages/Admin.tsx');
  assert.match(admin, /useUserContext/);
  assert.match(admin, /platformRoles/);
  assert.match(admin, /companyId/);
  assert.match(admin, /\/admin\/platform/);
  assert.match(admin, /\/admin\/product/);
  assert.equal(/UsersView|CompanyManager|SiteSettingsManager/.test(admin), false);
});

test('platform role management is limited to super admins in the UI', async () => {
  const platform = await read('src/pages/PlatformAdmin.tsx');
  assert.match(platform, /roles\.includes\('super_admin'\)/);
  assert.match(platform, /if \(!isSuperAdmin\) return/);
  assert.match(platform, /\/admin\/platform\/users\/\$\{user\.id\}\/roles/);
});

test('platform audit log refreshes when the audit tab is selected', async () => {
  const platform = await read('src/pages/PlatformAdmin.tsx');
  assert.match(platform, /const refreshAuditLogs = useCallback/);
  assert.match(platform, /if \(value === 'audit'\) void refreshAuditLogs\(\)/);
  assert.match(platform, /<Tabs value=\{activeTab\} onValueChange=\{handleTabChange\}>/);
});

test('product admin uses backend product settings and does not import Supabase', async () => {
  const product = await read('src/pages/ProductAdmin.tsx');
  assert.match(product, /\/admin\/product\/settings/);
  assert.equal(/integrations\/supabase|supabase\./.test(product), false);
});

test('billing checkout and history use independent HRing API contracts', async () => {
  const upgrade = await read('src/pages/Upgrade.tsx');
  const history = await read('src/pages/PaymentHistory.tsx');

  assert.match(upgrade, /\/billing\/plans/);
  assert.match(upgrade, /\/billing\/payments\/init/);
  assert.match(upgrade, /\/billing\/payments\/verify/);
  assert.match(upgrade, /useEffect\(\(\) => \{/);
  assert.equal(/useState\(\(\) =>/.test(upgrade), false);
  assert.equal(/integrations\/supabase|supabase\./.test(upgrade), false);

  assert.match(history, /\/billing\/payments/);
  assert.match(history, /amount_toman/);
  assert.equal(/integrations\/supabase|supabase\./.test(history), false);
});

test('auto-headhunt persists candidates with allowed pending status', async () => {
  const headhunt = await read('supabase/functions/auto-headhunt/index.ts');
  assert.match(headhunt, /status:\s*['\"]pending['\"]/);
  assert.equal(/status:\s*['\"]analyzed['\"]/.test(headhunt), false);
});
