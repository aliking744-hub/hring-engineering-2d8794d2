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
  assert.match(advisor, /_CITATION_PATTERN/);
  assert.match(advisor, /reference_number=index/);
  assert.match(advisor, /payload\.conversation_history\[-6:\]/);
  assert.match(advisor, /gemini-2\.5-flash|legal_advisor_ai_model/);
  assert.match(advisor, /extract_upload/);
  assert.match(advisor, /rate_limit_legal_advisor_per_minute/);
});

test("legal sources are refreshed and versioned by the maintenance worker", () => {
  const sync = read("apps/api/src/hring_api/domains/legal/source_sync.py");
  const worker = read("apps/api/src/hring_api/worker/app.py");
  assert.match(sync, /labor_law/);
  assert.match(sync, /social_security/);
  assert.match(sync, /court_rulings/);
  assert.match(sync, /ROBOTS_CRAWL_DELAY_SECONDS = 10\.0/);
  assert.match(worker, /daily-legal-source-sync/);
});


test("legal defense is enabled with direct official citations", () => {
  const defense = read("src/components/legal/DefenseBuilder.tsx");
  assert.doesNotMatch(defense, /asyncUpgradePending/);
  assert.match(defense, /شروع تحلیل پرونده/);
  assert.match(defense, /law\.sourceUrl/);
  assert.match(defense, /noopener noreferrer/);
});
