import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("interview UI uses the dedicated independent endpoint", () => {
  const client = read("src/integrations/supabase/client.ts");
  assert.match(client, /functionName === 'generate-interview-kit'/);
  assert.match(client, /\/interview\/kits\/generate/);
});

test("native interview kit preserves the exact Lovable contract", () => {
  const service = read("apps/api/src/hring_api/domains/interview/service.py");
  const schemas = read("apps/api/src/hring_api/domains/interview/schemas.py");

  assert.match(service, /هرگز سوالات کلیشه‌ای/);
  assert.match(service, /متد STAR/);
  assert.match(service, /سوالات تخصصی و فنی \(۴ سوال\)/);
  assert.match(service, /سوالات رفتاری و مهارت‌های نرم \(۳ سوال\)/);
  assert.match(service, /سوالات هوش و حل مسئله \(۲ سوال\)/);
  assert.match(service, /سوالات صنعت و تناسب فرهنگی \(۲ سوال\)/);
  assert.match(service, /run_with_credit_reservation/);
  assert.match(service, /generate_with_managed_prompt/);
  assert.match(schemas, /good_signs: list\[str\]/);
  assert.match(schemas, /red_flags: list\[str\]/);
});

