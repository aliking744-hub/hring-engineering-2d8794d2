import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("legal advisor UI uses the dedicated independent endpoint", () => {
  const client = read("src/integrations/supabase/client.ts");
  assert.match(client, /functionName === 'legal-advisor-chat'/);
  assert.match(client, /\/legal\/advisor\/chat/);
});

test("native legal advisor preserves the Lovable RAG contract", () => {
  const advisor = read("apps/api/src/hring_api/domains/legal/advisor.py");
  assert.match(advisor, /match_count=5/);
  assert.match(advisor, /match_threshold=0\.3/);
  assert.match(advisor, /for item in results\[:3\]/);
  assert.match(advisor, /payload\.conversation_history\[-6:\]/);
  assert.match(advisor, /gemini-2\.5-flash|legal_advisor_ai_model/);
  assert.match(advisor, /extract_upload/);
  assert.match(advisor, /rate_limit_legal_advisor_per_minute/);
});
