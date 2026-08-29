import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("HR dashboard private uploads use the native owner-scoped API", () => {
  const page = read("src/pages/HRDashboard.tsx");
  const history = read("src/components/hr-dashboard/UploadHistorySheet.tsx");
  const routes = read("apps/api/src/hring_api/domains/hr_dashboard/routes.py");

  assert.doesNotMatch(page, /from\('hr_uploads'\)/);
  assert.doesNotMatch(history, /from\('hr_uploads'\)/);
  assert.match(page, /\/hr-dashboard\/uploads/);
  assert.match(history, /\/hr-dashboard\/uploads/);
  assert.match(routes, /owner_user_id == principal\.user_id/);
});

test("HR dashboard keeps demo data out of the private upload history", () => {
  const page = read("src/pages/HRDashboard.tsx");
  const upload = read("src/components/hr-dashboard/UploadPage.tsx");

  assert.match(upload, /source: 'upload' \| 'demo'/);
  assert.match(page, /if \(source === 'demo'\)/);
  assert.match(page, /دادهٔ نمایشی است/);
});
