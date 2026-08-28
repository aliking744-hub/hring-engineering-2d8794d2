import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("job profile UI uses the dedicated independent endpoint", () => {
  const client = read("src/integrations/supabase/client.ts");
  assert.match(client, /functionName === 'generate-job-profile'/);
  assert.match(client, /\/job-engineering\/job-profiles\/generate/);
});

test("native job profile preserves the five-section Lovable contract", () => {
  const service = read(
    "apps/api/src/hring_api/domains/job_engineering/service.py",
  );
  for (const heading of [
    "## بخش اول: هویت شغلی",
    "## بخش دوم: ماموریت شغل",
    "## بخش سوم: حوزه‌های کلیدی مسئولیت (KRAs)",
    "## بخش چهارم: شرایط احراز شغل",
    "## بخش پنجم: شرایط محیطی",
  ]) {
    assert.ok(service.includes(heading), `missing contract heading: ${heading}`);
  }
  assert.match(service, /run_with_credit_reservation/);
  assert.match(service, /generate_with_managed_prompt/);
});
