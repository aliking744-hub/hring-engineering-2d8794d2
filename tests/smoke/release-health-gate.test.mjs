import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../../scripts/pr66-staging-smoke.sh", import.meta.url);

test("release smoke checks every public launch route without mutation", async () => {
  execFileSync("bash", ["-n", scriptUrl.pathname]);
  const script = await readFile(scriptUrl, "utf8");

  assert.match(script, /BASE_URL:-https:\/\/hring\.ir/);
  for (const path of ["/", "/api/v1/health", "/blog", "/faq", "/product-catalog", "/sitemap.xml", "/auth"]) {
    assert.ok(script.includes(path), `missing release route ${path}`);
  }
  assert.match(script, /"status":"ok"/);
  assert.match(script, /<urlset/);
  assert.match(script, /anonymous_credit_status/);
  assert.match(script, /401.*403/);
});
