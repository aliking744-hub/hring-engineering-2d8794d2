import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('core HRing routes remain registered', async () => {
  const app = await read('src/App.tsx');
  const requiredRoutes = [
    '/dashboard',
    '/hr-dashboard',
    '/smart-headhunting',
    '/campaign/:id',
    '/campaign/:campaignId/candidate/:candidateId',
    '/admin',
  ];

  for (const route of requiredRoutes) {
    assert.equal(app.includes(`path=\"${route}\"`), true, `missing route: ${route}`);
  }
});

test('admin area keeps both admin and super-admin authorization checks', async () => {
  const admin = await read('src/pages/Admin.tsx');
  assert.match(admin, /useAdmin/);
  assert.match(admin, /useSuperAdmin/);
  assert.match(admin, /!isAdmin && !isSuperAdmin/);
});

test('auto-headhunt persists candidates with allowed pending status', async () => {
  const headhunt = await read('supabase/functions/auto-headhunt/index.ts');
  assert.match(headhunt, /status:\s*['\"]pending['\"]/);
  assert.equal(/status:\s*['\"]analyzed['\"]/.test(headhunt), false);
});
