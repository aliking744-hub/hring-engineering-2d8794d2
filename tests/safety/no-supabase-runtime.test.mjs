import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const RUNTIME_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const FORBIDDEN = [
  /@supabase\//,
  /VITE_SUPABASE_/,
  /\.supabase\.co/i,
  /supabase\.com/i,
  /ai\.gateway\.lovable\.dev/i,
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (RUNTIME_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function findExternalRuntimeReferences() {
  const targets = walk(path.join(ROOT, 'src'));
  const packageJson = path.join(ROOT, 'package.json');
  if (fs.existsSync(packageJson)) targets.push(packageJson);

  const hits = [];
  for (const file of targets) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (FORBIDDEN.some((needle) => needle.test(line))) {
        hits.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 180)}`);
      }
    });
  }
  return hits;
}

test('browser/runtime code has zero external Supabase or Lovable AI dependency', () => {
  const hits = findExternalRuntimeReferences();
  assert.deepEqual(
    hits,
    [],
    `Remaining external runtime references (${hits.length}):\n${hits.join('\n')}`,
  );
});

test('legacy compatibility client is implemented by HRing API, not Supabase SDK', () => {
  const clientPath = path.join(ROOT, 'src/integrations/supabase/client.ts');
  const client = fs.readFileSync(clientPath, 'utf8');
  assert.doesNotMatch(client, /createClient\s*\(/);
  assert.doesNotMatch(client, /@supabase\//);
  assert.doesNotMatch(client, /VITE_SUPABASE_/);
  assert.match(client, /\/compat\/query/);
  assert.match(client, /\/compat\/functions\//);
  assert.match(client, /\/compat\/storage\//);
});
