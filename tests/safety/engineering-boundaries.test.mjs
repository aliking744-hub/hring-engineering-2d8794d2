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

test('engineering browser runtime uses HRing API and no Supabase environment', async () => {
  const apiClient = await read('src/lib/api.ts');
  assert.match(apiClient, /import\.meta\.env\.VITE_API_BASE_URL/);
  assert.match(apiClient, /configuredBase \|\| '\/api\/v1'/);
  assert.equal(apiClient.includes('VITE_SUPABASE_'), false);
  assert.equal(apiClient.includes('.supabase.co'), false);
});

test('agent constitution preserves isolated mirror boundary', async () => {
  const agents = await read('AGENTS.md');
  assert.match(agents, /isolated engineering mirror/i);
  assert.match(agents, /Never deploy to the production CloudIva service/i);
});

test('frontend typecheck compiles both application and build-tool projects', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const command = packageJson.scripts?.typecheck ?? '';

  assert.match(command, /tsc\s+-p\s+tsconfig\.app\.json\s+--noEmit/);
  assert.match(command, /tsc\s+-p\s+tsconfig\.node\.json\s+--noEmit/);
  assert.notEqual(command.trim(), 'tsc --noEmit');
});
