import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('public SEO metadata no longer advertises Lovable or Supabase', async () => {
  const files = await Promise.all([
    read('index.html'),
    read('public/robots.txt'),
    read('scripts/generate-sitemap.ts'),
  ]);
  const combined = files.join('\n');
  assert.equal(combined.includes('hring-app.lovable.app'), false);
  assert.equal(combined.toLowerCase().includes('supabase'), false);
  assert.match(combined, /https:\/\/hring\.ir/);
});

test('vite production build does not execute Lovable tooling', async () => {
  const vite = await read('vite.config.ts');
  assert.equal(vite.includes('componentTagger'), false);
  assert.equal(vite.includes('lovable-tagger'), false);
});

test('standalone compose owns core runtime dependencies', async () => {
  const compose = await read('compose.yaml');
  for (const service of ['postgres:', 'redis:', 'minio:', 'api:', 'web:']) {
    assert.match(compose, new RegExp(`\\n  ${service}`));
  }
  assert.match(compose, /alembic upgrade head/);
  assert.match(compose, /API_WEB_CONCURRENCY: \$\{API_WEB_CONCURRENCY:-2\}/);
  assert.match(compose, /--workers "\$\$\{API_WEB_CONCURRENCY\}"/);
  assert.equal(compose.includes('supabase'), false);
  assert.equal(compose.includes('lovable'), false);
  assert.match(compose, /PUBLIC_BASE_URL: \$\{PUBLIC_SITE_URL:-https:\/\/hring\.ir\}/);
  assert.equal(compose.includes('PUBLIC_BASE_URL: ${PUBLIC_APP_URL'), false);
});

test('container build context excludes local credentials', async () => {
  const ignore = await read('.dockerignore');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^node_modules$/m);
  assert.match(ignore, /^\.git$/m);
});

test('nginx gateway carries core browser security controls', async () => {
  const nginx = await read('infra/nginx/default.conf');
  assert.match(nginx, /X-Content-Type-Options/);
  assert.match(nginx, /Content-Security-Policy/);
  assert.match(nginx, /frame-ancestors 'none'/);
  assert.match(nginx, /Referrer-Policy/);
  assert.match(nginx, /Permissions-Policy/);
  assert.match(nginx, /resolver 127\.0\.0\.11 valid=10s ipv6=off/);
  assert.match(nginx, /set \$api_backend api:8000/);
  assert.match(nginx, /proxy_pass http:\/\/\$api_backend/);
  assert.match(nginx, /return 308 https:\/\/hring\.ir\$request_uri/);
  assert.equal(nginx.includes('^(?:www\\.|staging\\.)hring\\.ir$'), true);
});
