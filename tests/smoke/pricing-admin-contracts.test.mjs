import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/pages/PricingAdmin.tsx', 'utf8');
const admin = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.match(page, /\/platform\/billing\/exchange-rate/);
assert.match(page, /price_usd_cents/);
assert.match(page, /monthly_credits/);
assert.match(page, /حاشیه روی دلار/);
assert.match(admin, /\/admin\/pricing/);
assert.match(app, /path="\/admin\/pricing"/);

console.log('PRICING_ADMIN_CONTRACTS=PASSED');
