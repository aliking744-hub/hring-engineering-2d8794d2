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

test('navbar reflects the authenticated session instead of showing login', async () => {
  const navbar = await read('src/components/Navbar.tsx');

  assert.match(navbar, /useAuth/);
  assert.match(navbar, /useUserContext/);
  assert.match(navbar, /userContext\?\.fullName\?\.trim\(\)/);
  assert.match(navbar, /user\?\.email\?\.split\('@'\)\[0\]/);
  assert.match(navbar, /showLogin && !authLoading/);
  assert.match(navbar, /to="\/profile"/);
  assert.match(navbar, /to="\/auth"/);
});

test('landing pricing uses backend plans and the shared diamond cost catalog', async () => {
  const pricing = await read('src/components/landing/PricingSection.tsx');

  assert.match(pricing, /\/billing\/plans/);
  assert.match(pricing, /auth: false/);
  assert.match(pricing, /price_toman/);
  assert.match(pricing, /monthly_credits/);
  assert.match(pricing, /DIAMOND_COSTS/);
  assert.equal(/۲,۵۰۰,۰۰۰|۵,۰۰۰,۰۰۰|۱۲,۰۰۰,۰۰۰/.test(pricing), false);
});

test('product catalogs describe the independent runtime and omit retired claims', async () => {
  const catalog = await read('src/pages/ProductCatalog.tsx');
  const staticCatalog = await read('public/hring-product-catalog.html');

  for (const source of [catalog, staticCatalog]) {
    assert.equal(/hring-app\.lovable\.app|Supabase \(PostgreSQL\)|Edge Functions \(Deno\)|Row Level Security/.test(source), false);
    assert.match(source, /FastAPI \+ Pydantic/);
    assert.match(source, /PostgreSQL \+ pgvector/);
    assert.match(source, /Server-side RBAC/);
  }
  assert.equal(/Unicorn Lab|یونیکورن/.test(staticCatalog), false);
});

test('onboarding roadmap does not present invented employee activity as real data', async () => {
  const onboarding = await read('src/pages/OnboardingRoadmap.tsx');

  assert.match(onboarding, /نمونه ساختار/);
  assert.match(onboarding, /ساخت برنامه ۹۰ روزه/);
  assert.equal(/progress: (?:30|75|100)|done: true|شنبه ۱۵ دی|یکشنبه ۱۶ دی|سه‌شنبه ۱۸ دی/.test(onboarding), false);
});

test('payment setup errors are actionable for staging users', async () => {
  const upgrade = await read('src/pages/Upgrade.tsx');

  assert.match(upgrade, /error\.status === 503/);
  assert.match(upgrade, /درگاه پرداخت هنوز توسط مدیر سیستم فعال نشده است/);
});

test('auto-headhunt persists candidates with allowed pending status', async () => {
  const headhunt = await read('supabase/functions/auto-headhunt/index.ts');
  assert.match(headhunt, /status:\s*['\"]pending['\"]/);
  assert.equal(/status:\s*['\"]analyzed['\"]/.test(headhunt), false);
});
