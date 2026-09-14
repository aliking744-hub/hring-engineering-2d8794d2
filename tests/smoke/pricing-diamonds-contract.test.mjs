import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public diamond rate card stays aligned across frontend and API", async () => {
  const [frontend, backend, migration] = await Promise.all([
    read("src/hooks/useCredits.tsx"),
    read("apps/api/src/hring_api/domains/billing/credit_service.py"),
    read("apps/api/alembic/versions/20260913_0044_diamond_pricing.py"),
  ]);

  const expected = {
    JOB_PROFILE: 50,
    INTERVIEW_KIT: 100,
    SMART_AD_TEXT: 10,
    SMART_AD_IMAGE: 1500,
    ONBOARDING_PLAN: 50,
    LEARNING_PATH: 30,
    LEGAL_ADVISOR: 20,
    LABOR_COMPLAINT: 250,
    LEGAL_DEFENSE: 200,
    HR_SUPPORT: 10,
    COST_CALCULATOR: 20,
    HR_DASHBOARD: 0,
    HR_DASHBOARD_UPLOAD: 100,
    HEADHUNTING: 600,
  };

  for (const [operation, diamonds] of Object.entries(expected)) {
    assert.match(frontend, new RegExp(`\\b${operation}: ${diamonds}\\b`));
    assert.match(backend, new RegExp(`"${operation}": \\("[^"]+", ${diamonds}\\)`));
  }

  const migratedRates = {
    "job_engineering.job_profile": 50,
    "interview.kit": 100,
    "job_ads.smart_ad_text": 10,
    "job_ads.smart_ad_image": 1500,
    "development.onboarding_plan": 50,
    "development.learning_path": 30,
    "legal.advisor": 20,
    "compat.labor-complaint-assistant": 250,
    "legal.defense": 200,
    "compat.hring-support": 10,
    "costing.employee_cost_calculator": 20,
    "hr_data.dashboard_demo": 0,
    "hr_data.dashboard_upload": 100,
    "recruiting.headhunting": 600,
  };
  for (const [featureKey, diamonds] of Object.entries(migratedRates)) {
    assert.ok(migration.includes(`"${featureKey}": ${diamonds}`));
  }
});

test("individual plans use fixed 720-hour validity and corporate self-service is disabled", async () => {
  const [billing, pricing, migration] = await Promise.all([
    read("apps/api/src/hring_api/domains/billing/service.py"),
    read("src/components/landing/PricingSection.tsx"),
    read("apps/api/alembic/versions/20260913_0044_diamond_pricing.py"),
  ]);

  assert.match(billing, /timedelta\(hours=720\)/);
  assert.match(billing, /plan\.scope\s*==\s*"corporate"/);
  assert.match(pricing, /۷۲۰ ساعت/);
  assert.match(pricing, /مانده قبلی حفظ و به بسته جدید اضافه می‌شود/);
  assert.match(pricing, /۰۹۳۲۱۱۱۱۱۲۰/);
  assert.doesNotMatch(pricing, /یک.?ساله|سالانه/);
  assert.match(migration, /WHEN 'individual_free' THEN 0/);
  assert.match(migration, /WHEN 'individual_pro' THEN 2000/);
  assert.match(migration, /WHEN 'individual_plus' THEN 6000/);
});

test("free registrations start with zero diamonds", async () => {
  const [models, migration] = await Promise.all([
    read("apps/api/src/hring_api/domains/identity/models.py"),
    read("apps/api/alembic/versions/20260914_0049_free_plan_zero_credits.py"),
  ]);
  assert.match(models, /monthly_credits: Mapped\[int\] = mapped_column\(Integer, nullable=False, default=0\)/);
  assert.match(migration, /server_default="0"/);
  assert.match(migration, /Legacy free-plan credit removal/);
});

test("admin AI quality receives only real user messages", async () => {
  const [service, routes] = await Promise.all([
    read("apps/api/src/hring_api/domains/ai/service.py"),
    read("apps/api/src/hring_api/domains/ai/insight_routes.py"),
  ]);
  assert.match(service, /role\s*!=\s*"user"/);
  assert.match(routes, /_user_only_payload/);
  assert.doesNotMatch(service, /role\)\s*in\s*\{"user",\s*"assistant"\}/);
});

test("all printable AI and legal results use semantic RTL-safe PDF pagination", async () => {
  const [exporter, ...pages] = await Promise.all([
    read("src/lib/exportPdf.ts"),
    read("src/pages/SuccessArchitect.tsx"),
    read("src/pages/LearningPath.tsx"),
    read("src/pages/InterviewAssistant.tsx"),
    read("src/pages/JobDescriptionGenerator.tsx"),
    read("src/components/legal/DefenseBuilder.tsx"),
    read("src/components/legal/LaborComplaintAssistant.tsx"),
  ]);
  assert.match(exporter, /html2canvas/);
  assert.match(exporter, /direction: rtl/);
  assert.match(exporter, /calculatePageSlices/);
  assert.match(exporter, /semanticBoundaries/);
  assert.doesNotMatch(exporter, /sourceY\s*=\s*page\s*\*\s*pageHeightPx/);
  for (const page of pages) {
    assert.match(page, /export(?:Element|Text)ToPdf/);
    assert.doesNotMatch(page, /pdf\.html\(|new jsPDF/);
  }
});
