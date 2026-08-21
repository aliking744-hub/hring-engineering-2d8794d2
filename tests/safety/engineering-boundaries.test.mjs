import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('engineering mirror never contains production CloudIva deploy command', async () => {
  const workflow = await read('.github/workflows/deploy-cloudiva.yml');
  assert.equal(workflow.includes('diva deploy -s hring-app'), false);
  assert.equal(workflow.includes('CHABOKAN_TOKEN'), false);
  assert.match(workflow, /production deploy disabled/i);
});

test('engineering mirror points to engineering Supabase project, not production', async () => {
  const env = await read('.env');
  assert.match(env, /lfiptdlxqefjxbhsqcrx/);
  assert.equal(env.includes('pvtppgnwhkbihsnfzvym'), false);
});

test('agent constitution preserves isolated mirror boundary', async () => {
  const agents = await read('AGENTS.md');
  assert.match(agents, /isolated engineering mirror/i);
  assert.match(agents, /Never deploy to the production CloudIva service/i);
});
