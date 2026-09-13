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

  for (const diamonds of [50, 100, 10, 1500, 30, 20, 250, 200, 100, 600]) {
    assert.ok(migration.includes(`credit_cost": ${diamonds}`));
  }
});

test("individual plans use fixed 720-hour validity and corporate self-service is disabled", async () => {
  const [billing, pricing, migration] = await Promise.all([
    read("apps/api/src/hring_api/domains/billing/service.py"),
    read("src/components/landing/PricingSection.tsx"),
    read("apps/api/alembic/versions/20260913_0044_diamond_pricing.py"),
  ]);

  assert.match(billing, /timedelta\(hours=720\)/);
  assert.match(billing, /plan\.plan_type\.startswith\("corporate_"\)/);
  assert.match(pricing, /۷۲۰ ساعت/);
  assert.match(pricing, /۰۹۳۲۱۱۱۱۱۲۰/);
  assert.doesNotMatch(pricing, /یک.?ساله|سالانه/);
  assert.match(migration, /"individual_free"[\s\S]*?"monthly_credits": 0/);
  assert.match(migration, /"individual_pro"[\s\S]*?"monthly_credits": 2_000/);
  assert.match(migration, /"individual_plus"[\s\S]*?"monthly_credits": 6_000/);
});

test("admin AI quality receives only real user messages", async () => {
  const [service, routes] = await Promise.all([
    read("apps/api/src/hring_api/domains/ai/service.py"),
    read("apps/api/src/hring_api/domains/ai/insight_routes.py"),
  ]);
  assert.match(service, /role\)\s*!=\s*"user"/);
  assert.match(routes, /_user_only_payload/);
  assert.doesNotMatch(service, /role\)\s*in\s*\{"user",\s*"assistant"\}/);
});

test("all printable AI results use the RTL-safe PDF exporter", async () => {
  const [exporter, ...pages] = await Promise.all([
    read("src/lib/exportPdf.ts"),
    read("src/pages/SuccessArchitect.tsx"),
    read("src/pages/LearningPath.tsx"),
    read("src/pages/InterviewAssistant.tsx"),
    read("src/pages/JobDescriptionGenerator.tsx"),
  ]);
  assert.match(exporter, /html2canvas/);
  assert.match(exporter, /direction: rtl/);
  assert.match(exporter, /totalPages/);
  for (const page of pages) {
    assert.match(page, /exportElementToPdf/);
    assert.doesNotMatch(page, /pdf\.html\(/);
  }
});
