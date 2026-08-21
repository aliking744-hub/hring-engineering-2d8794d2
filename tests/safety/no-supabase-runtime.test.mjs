import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const RUNTIME_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const NEEDLES = [
  /@supabase\//,
  /integrations\/supabase/,
  /\bsupabase\./,
  /VITE_SUPABASE_/,
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

function findRuntimeReferences() {
  const targets = walk(path.join(ROOT, 'src'));
  const packageJson = path.join(ROOT, 'package.json');
  if (fs.existsSync(packageJson)) targets.push(packageJson);

  const hits = [];
  for (const file of targets) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (NEEDLES.some((needle) => needle.test(line))) {
        hits.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 180)}`);
      }
    });
  }
  return hits;
}

test('browser/runtime code has zero Supabase dependency', () => {
  const hits = findRuntimeReferences();
  assert.deepEqual(
    hits,
    [],
    `Remaining Supabase runtime references (${hits.length}):\n${hits.join('\n')}`,
  );
});
