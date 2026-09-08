import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("defense builder UI uses the dedicated independent endpoint", () => {
  const client = read("src/integrations/supabase/client.ts");
  assert.match(client, /functionName === 'defense-builder'/);
  assert.match(client, /\/legal\/defense\/analyze/);
});

test("native defense builder preserves the three-phase Lovable contract", () => {
  const defense = read("apps/api/src/hring_api/domains/legal/defense.py");
  assert.match(defense, /legal\.defense_builder/);
  assert.match(defense, /legal\.defense_gap/);
  assert.match(defense, /legal\.defense_verdict/);
  assert.match(defense, /match_count=3/);
  assert.match(defense, /match_threshold=0\.4/);
  assert.match(defense, /relevant_laws\[:5\]/);
  assert.match(defense, /extract_upload/);
  assert.match(defense, /rate_limit_legal_defense_per_minute/);
  assert.match(defense, /legal_defense_ai_model/);
  assert.match(defense, /search_domain_filter=list\(OFFICIAL_LEGAL_DOMAINS\)/);
  assert.match(defense, /official_citations/);
  const ui = read("src/components/legal/DefenseBuilder.tsx");
  assert.doesNotMatch(ui, /asyncUpgradePending/);
  assert.match(ui, /law\.sourceUrl/);
});
