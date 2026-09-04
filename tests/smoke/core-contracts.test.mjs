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

test('retired analytics hub is removed from application routing', async () => {
  const app = await read('src/App.tsx');

  assert.equal(/AnalyticsHub|path="\/analytics"/.test(app), false);
});

test('dashboard opens on a real welcome home and supports reversible section navigation', async () => {
  const dashboard = await read('src/pages/Dashboard.tsx');

  assert.match(dashboard, /useCompany/);
  assert.match(dashboard, /location\.hash/);
  assert.match(dashboard, /const currentTier = visibleTiers\.find[\s\S]*\|\| null/);
  assert.match(dashboard, /welcomeSubject/);
  assert.match(dashboard, /خوش آمدید/);
  assert.match(dashboard, /aria-label="بازگشت به خانه داشبورد"/);
  assert.match(dashboard, /DashboardModuleCards tier=\{currentTier\}/);
});

test('dashboard modules expose a visible return to the dashboard home', async () => {
  const modulePages = await Promise.all([
    read('src/pages/JobDescriptionGenerator.tsx'),
    read('src/pages/InterviewAssistant.tsx'),
    read('src/pages/SmartAdGenerator.tsx'),
    read('src/pages/SuccessArchitect.tsx'),
    read('src/pages/OnboardingRoadmap.tsx'),
    read('src/pages/LearningPath.tsx'),
    read('src/pages/Profile.tsx'),
    read('src/pages/HRDashboard.tsx'),
    read('src/pages/CostCalculator.tsx'),
    read('src/pages/SmartHeadhunting.tsx'),
    read('src/pages/LegalAdvisor.tsx'),
  ]);

  const workspaceHeader = await read('src/components/WorkspaceHeader.tsx');
  assert.match(workspaceHeader, /["']\/dashboard["']/);
  assert.match(workspaceHeader, /بازگشت به داشبورد/);

  for (const page of modulePages) {
    assert.match(page, /["']\/dashboard["']|<WorkspaceHeader/);
    if (!/<WorkspaceHeader/.test(page)) {
      assert.match(page, /بازگشت به داشبورد/);
    }
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

test('public landing hides unverified metrics and provider endorsements by default', async () => {
  const testimonials = await read('src/components/landing/TestimonialsSection.tsx');
  const footer = await read('src/components/landing/Footer.tsx');
  const shop = await read('src/components/landing/ShopTeaser.tsx');

  assert.equal(/صدها شرکت|۵۰۰\+|۱۵,۰۰۰\+|۹۸٪|۷۰٪/.test(testimonials), false);
  assert.match(testimonials, /getSetting\('stat_companies', ''\)/);
  assert.match(testimonials, /verifiedStats\.length > 0/);
  assert.equal(/getSetting\('footer_ai', 'Gemini'\)/.test(footer), false);
  assert.match(footer, /footerAi &&/);
  assert.match(shop, /useDigitalProducts/);
  assert.match(shop, /product\.download_count\.toLocaleString/);
  assert.equal(/۲\.۴k|۱\.۸k|۳\.۱k|۲\.۹k/.test(shop), false);
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

  assert.match(onboarding, /\/development\/onboarding-plans/);
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
  const individual = await read('src/components/dashboard/IndividualDashboard.tsx');
  const corporate = await read('src/components/dashboard/CorporateDashboard.tsx');
  const featureGate = await read('src/components/FeatureGate.tsx');
  const navigationSources = [tools, individual, corporate];

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

test('retired strategy product surfaces are absent', async () => {
  const app = await read('src/App.tsx');
  const dashboard = await read('src/pages/Dashboard.tsx');
  const catalog = await read('apps/api/src/hring_api/domains/ai/feature_catalog.py');
  const productCatalog = await read('public/hring-product-catalog.html');
  const individual = await read('src/components/dashboard/IndividualDashboard.tsx');
  const corporate = await read('src/components/dashboard/CorporateDashboard.tsx');

  for (const source of [app, dashboard, individual, corporate, catalog, productCatalog]) {
    assert.equal(
      /StrategicCompass|StrategicRadar|strategic-compass|strategic-radar|قطب‌نمای استراتژیک|رادار اطلاعات استراتژیک/.test(source),
      false,
    );
  }
  assert.equal(/compat\.analyze-competitor|compat\.track-funding|compat\.generate-mental-prism/.test(catalog), false);
});

test('dashboards do not present invented operational metrics or retired modules', async () => {
  const individual = await read('src/components/dashboard/IndividualDashboard.tsx');
  const corporate = await read('src/components/dashboard/CorporateDashboard.tsx');
  const dashboard = await read('src/pages/Dashboard.tsx');

  assert.match(individual, /useCampaigns/);
  assert.match(individual, /candidatesCount/);
  assert.equal(/سارا احمدی|const hiringHealth = 95|\/unicorn-lab/.test(individual), false);

  assert.match(corporate, /members\.length/);
  assert.match(corporate, /دادهٔ نمونه را آگاهانه فعال کنید/);
  assert.equal(/پروژه‌های فعال|جلسات این هفته|\/unicorn-lab/.test(corporate), false);

  assert.equal(/planMaxCredits|allocatedCredits|creditPercentage/.test(dashboard), false);
});

test('active subscription contract excludes the retired individual expert tier', async () => {
  const contractSources = await Promise.all([
    read('apps/api/src/hring_api/domains/identity/enums.py'),
    read('src/types/multiTenant.ts'),
    read('src/integrations/supabase/types.ts'),
    read('src/components/admin/FeatureFlagsManager.tsx'),
    read('src/components/admin/FeaturePermissionsManager.tsx'),
    read('src/components/admin/CorporateUserManager.tsx'),
    read('src/pages/PaymentHistory.tsx'),
  ]);
  const migration = await read(
    'apps/api/alembic/versions/20260824_0014_release_contract_cleanup.py',
  );

  for (const source of contractSources) {
    assert.equal(/individual_expert/.test(source), false);
  }
  assert.match(migration, /UPDATE profiles/);
  assert.match(migration, /individual_expert/);
  assert.match(migration, /individual_pro/);
});

test('integration center only activates adapters backed by runtime consumers', async () => {
  const center = await read('src/pages/IntegrationCenter.tsx');
  const service = await read(
    'apps/api/src/hring_api/domains/integrations/service.py',
  );

  assert.match(center, /RUNTIME_ADAPTERS_BY_TYPE/);
  assert.match(center, /آمادگی سرویس‌های اجرایی/);
  assert.match(center, /سرویس فقط پس از ثبت کلید و تست موفق/);
  assert.equal(/farazsms|melipayamak|smtp|generic_http/.test(center), false);

  assert.match(service, /RUNTIME_ADAPTERS_BY_TYPE/);
  assert.match(service, /_validate_runtime_adapter/);
  assert.match(service, /not runtime-backed/);
});


test('smart ad preserves independent text and image results and rejects empty success', async () => {
  const page = await read('src/pages/SmartAdGenerator.tsx');

  assert.match(page, /formatGeneratedJobAd/);
  assert.match(page, /generated_job_ad/);
  assert.match(page, /if \(!responseText\)/);
  assert.match(page, /if \(!responseImage\)/);
  assert.match(page, /\/job-ads\/generate-text/);
  assert.match(page, /\/job-ads\/generate-image/);
  assert.match(page, /generatedText \|\| generatedImage/);
  assert.match(page, /اعتباری نباید مصرف شود/);
});


test('marketplace purchases cannot be self-granted from the browser', async () => {
  const products = await read('src/hooks/useDigitalProducts.tsx');

  assert.equal(/recordPurchase/.test(products), false);
  assert.equal(/from\(['\"]user_purchases['\"]\)[\s\S]{0,300}\.insert/.test(products), false);
  assert.match(products, /download-product/);
});


test('HR dashboard visibly distinguishes explicitly loaded demo data from uploaded records', async () => {
  const dashboard = await read('src/pages/HRDashboard.tsx');
  const history = await read('src/components/hr-dashboard/UploadHistorySheet.tsx');

  assert.match(dashboard, /dataOrigin/);
  assert.match(dashboard, /حالت دمو/);
  assert.match(dashboard, /داده نمونه/);
  assert.match(history, /uploadId: string, name: string/);
});


test('HR dashboard history uses the native API and not a browser Supabase client', async () => {
  const dashboard = await read('src/pages/HRDashboard.tsx');
  const history = await read('src/components/hr-dashboard/UploadHistorySheet.tsx');

  for (const source of [dashboard, history]) {
    assert.equal(/integrations\/supabase|from\('hr_uploads'\)/.test(source), false);
  }
  assert.match(dashboard, /\/hr-data\/uploads\/latest/);
  assert.match(dashboard, /\/hr-data\/uploads/);
  assert.match(history, /\/hr-data\/uploads\?limit=50/);
  assert.match(history, /\/hr-data\/uploads\/\$\{id\}/);
});


test('smart ad preserves a provider image if client poster composition is blocked', async () => {
  const page = await read('src/pages/SmartAdGenerator.tsx');
  assert.match(page, /Preserve the provider image if a cross-origin host blocks client-side composition/);
  assert.match(page, /A bad uploaded logo must not turn a paid, successful image into a failed action/);
});


test('smart ad keeps private image data alive through canvas composition', async () => {
  const page = await read('src/pages/SmartAdGenerator.tsx');
  assert.match(page, /const blobToDataUrl/);
  assert.match(page, /await blobToDataUrl\(await apiBlobRequest\(responseImage\)\)/);
  assert.equal(page.includes('URL.revokeObjectURL(privateObjectUrl)'), false);
});


test('workspace report exports are branded and reject incomplete responses', async () => {
  const [jobProfile, interview] = await Promise.all([
    read('src/pages/JobDescriptionGenerator.tsx'),
    read('src/pages/InterviewAssistant.tsx'),
  ]);
  assert.match(jobProfile, /alt="HRing"/);
  assert.match(jobProfile, /!data\.content\.trim\(\)/);
  assert.match(interview, /data\.questions\.length !== 11/);
  assert.match(interview, /data-pdf-answer/);
  assert.match(interview, /alt="HRing"/);
});


test('workspace generation pages expose persistent owner-scoped history', async () => {
  const [jobProfile, interview, smartAd] = await Promise.all([
    read('src/pages/JobDescriptionGenerator.tsx'),
    read('src/pages/InterviewAssistant.tsx'),
    read('src/pages/SmartAdGenerator.tsx'),
  ]);
  assert.match(jobProfile, /featureKey=job_engineering\.job_profile/);
  assert.match(interview, /featureKey=interview\.kit/);
  assert.match(smartAd, /\/job-ads\/history/);
  assert.match(smartAd, /\/job-ads\/assets\/\$\{item\.id\}/);
});
