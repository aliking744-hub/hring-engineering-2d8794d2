import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("legal advisor UI uses the dedicated independent endpoint", () => {
  const page = read("src/pages/LegalAdvisor.tsx");
  assert.match(page, /apiRequest/);
  assert.match(page, /\/legal\/advisor\/chat/);
  assert.match(page, /X-Idempotency-Key/);
  assert.match(page, /sourceUrl/);
  assert.equal(page.includes('functions.invoke("legal-advisor-chat"'), false);

  const widget = read("src/components/LegalAdvisorWidget.tsx");
  assert.match(widget, /جایگزین بررسی وکیل یا مشاور حقوقی نیستند/);
});

test("native legal advisor preserves the cited RAG contract", () => {
  const advisor = read("apps/api/src/hring_api/domains/legal/advisor.py");
  assert.match(advisor, /match_count=5/);
  assert.match(advisor, /match_threshold=0\.3/);
  assert.match(advisor, /for item in results\[:3\]/);
  assert.match(advisor, /payload\.conversation_history\[-6:\]/);
  assert.match(advisor, /gemini-2\.5-flash|legal_advisor_ai_model/);
  assert.match(advisor, /extract_upload/);
  assert.match(advisor, /rate_limit_legal_advisor_per_minute/);
});


test("legal defense is unavailable until its async execution is observable", () => {
  const defense = read("src/components/legal/DefenseBuilder.tsx");
  assert.match(defense, /const asyncUpgradePending = true/);
  assert.match(defense, /لایحه دفاعیه هوشمند — به‌زودی/);
  assert.match(defense, /هیچ فایل یا اعتباری دریافت نمی‌شود/);
  assert.match(defense, /اجرای غیرهمزمان و پیگیری‌پذیر/);
});
