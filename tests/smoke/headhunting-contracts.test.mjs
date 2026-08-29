import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("headhunting UI calls the independent analysis API", () => {
  const page = read("src/pages/SmartHeadhunting.tsx");
  assert.doesNotMatch(page, /supabase\.functions\.invoke\("analyze-candidates"/);
  assert.match(page, /"\/recruiting\/analyze-candidates"/);
  assert.match(page, /enableWebSearch: enableWebEnrichment/);
});

test("candidate analysis preserves privacy and five-layer contract", () => {
  const service = read("apps/api/src/hring_api/domains/recruiting/ai_service.py");
  const schemas = read("apps/api/src/hring_api/domains/recruiting/schemas.py");
  const routes = read("apps/api/src/hring_api/domains/recruiting/routes.py");

  assert.match(service, /Activity & Sentiment/);
  assert.match(service, /Hard Skill Match/);
  assert.match(service, /Career Trajectory/);
  assert.match(service, /Culture Fit/);
  assert.match(service, /Risk & Opportunity/);
  assert.match(service, /exclude=\{"raw_data", "email", "phone", "linkedin"\}/);
  assert.match(service, /sourceIndex is the integrity key/);
  assert.match(schemas, /enable_web_search: bool = Field\(default=False/);
  assert.match(routes, /@router\.post\("\/analyze-candidates"/);
});
