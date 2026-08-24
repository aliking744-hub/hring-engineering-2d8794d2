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

test('dashboard and tool navigation only target registered product routes', async () => {
  const tools = await read('src/pages/ToolsGrid.tsx');
  const analytics = await read('src/pages/AnalyticsHub.tsx');
  const individual = await read('src/components/dashboard/IndividualDashboard.tsx');
  const corporate = await read('src/components/dashboard/CorporateDashboard.tsx');
  const featureGate = await read('src/components/FeatureGate.tsx');
  const navigationSources = [tools, analytics, individual, corporate];

  for (const page of navigationSources) {
    assert.equal(/["']\/smart-ad["']/.test(page), false);
    assert.equal(/["']\/interviews["']/.test(page), false);
    assert.equal(/\/unicorn-lab/.test(page), false);
  }
  assert.match(tools, /\/smart-ad-generator/);
  assert.match(tools, /\/interview-assistant/);
  assert.match(featureGate, /navigate\(['"]\/upgrade['"]\)/);
  assert.equal(/navigate\(['"]\/shop['"]\)/.test(featureGate), false);
});

test('public and dashboard metadata use the configurable canonical origin', async () => {
  const pages = await Promise.all([
    read('src/pages/FAQ.tsx'),
    read('src/pages/Blog.tsx'),
    read('src/pages/BlogPost.tsx'),
    read('src/pages/Dashboard.tsx'),
  ]);

  for (const page of pages) {
    assert.match(page, /seo_canonical_base_url/);
    assert.equal(/hring-app\.lovable\.app/.test(page), false);
  }
});

test('FAQ reuses the live pricing and credit catalogs', async () => {
  const faq = await read('src/pages/FAQ.tsx');

  assert.match(faq, /<PricingSection \/>/);
  assert.match(faq, /DIAMOND_COSTS/);
  assert.equal(/individual_expert/.test(faq), false);
});

test('sample and estimated analytics are visibly labelled', async () => {
  const analytics = await read('src/pages/AnalyticsHub.tsx');
  const radar = await read('src/components/strategic-radar/RadarDashboard.tsx');

  assert.match(analytics, /داده‌های نمایشی/);
  assert.match(analytics, /گزارش عملیاتی سازمان شما نیستند/);
  assert.match(radar, /برآورد سناریویی/);
  assert.equal(/>\s*LIVE\s*</.test(radar), false);
});

test('dashboards do not present invented operational metrics or retired modules', async () => {
  const individual = await read('src/components/dashboard/IndividualDashboard.tsx');
  const corporate = await read('src/components/dashboard/CorporateDashboard.tsx');
  const dashboard = await read('src/pages/Dashboard.tsx');

  assert.match(individual, /useCampaigns/);
  assert.match(individual, /candidatesCount/);
  assert.equal(/سارا احمدی|const hiringHealth = 95|\/unicorn-lab/.test(individual), false);

  assert.match(corporate, /members\.length/);
  assert.match(corporate, /این داشبورد عدد نمونه نشان نمی‌دهد/);
  assert.equal(/پروژه‌های فعال|جلسات این هفته|\/unicorn-lab/.test(corporate), false);

  assert.equal(/planMaxCredits|allocatedCredits|creditPercentage/.test(dashboard), false);
});
