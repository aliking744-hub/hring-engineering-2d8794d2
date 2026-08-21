import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('headhunting campaign persistence no longer imports Supabase', async () => {
  const hook = await read('src/hooks/useCampaigns.tsx');
  assert.equal(hook.includes('@/integrations/supabase/client'), false);
  assert.match(hook, /\/headhunting\/campaigns/);
});

test('legacy headhunting function names are bridged to HRing API', async () => {
  const client = await read('src/integrations/supabase/client.ts');
  assert.match(client, /functionName === 'analyze-candidates'/);
  assert.match(client, /\/headhunting\/analyze-candidates/);
  assert.match(client, /functionName === 'auto-headhunt'/);
  assert.match(client, /\/headhunting\/auto-headhunt/);
});

test('independent backend owns headhunting persistence and AI routes', async () => {
  const router = await read('apps/api/src/hring_api/domains/headhunting/routes.py');
  const models = await read('apps/api/src/hring_api/domains/headhunting/models.py');
  assert.match(router, /\/analyze-candidates/);
  assert.match(router, /\/auto-headhunt/);
  assert.match(models, /__tablename__ = "campaigns"/);
  assert.match(models, /__tablename__ = "candidates"/);
  assert.match(models, /company_id/);
});
