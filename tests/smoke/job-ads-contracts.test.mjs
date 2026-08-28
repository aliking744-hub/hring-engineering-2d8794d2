import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("smart ad UI uses the dedicated independent endpoint", () => {
  const client = read("src/integrations/supabase/client.ts");
  assert.match(client, /functionName === 'generate-job-ad'/);
  assert.match(client, /\/job-ads\/generate/);
});

test("native smart ad preserves Lovable text and image behavior", () => {
  const service = read("apps/api/src/hring_api/domains/job_ads/service.py");
  const schemas = read("apps/api/src/hring_api/domains/job_ads/schemas.py");

  assert.match(service, /Start with a compelling hook/);
  assert.match(service, /Use hashtags at the bottom \(3-5 relevant ones\)/);
  assert.match(service, /Keep the main text under 200 words/);
  assert.match(service, /Formal and professional tone/);
  assert.match(service, /Friendly and energetic tone/);
  assert.match(service, /Challenge and growth-oriented tone/);
  assert.match(service, /modalities=\["image", "text"\]/);
  assert.match(service, /SMART_AD_TEXT_DEFAULT_CREDIT_COST = 5/);
  assert.match(service, /SMART_AD_IMAGE_DEFAULT_CREDIT_COST = 25/);
  assert.match(schemas, /"16:9": \(1920, 1080\)/);
  assert.match(schemas, /"1:1": \(1080, 1080\)/);
  assert.match(schemas, /"9:16": \(1080, 1920\)/);
});

