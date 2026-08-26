import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('legal user and admin surfaces use typed native APIs only', async () => {
  const search = await read('src/components/LegalSearch.tsx');
  const importer = await read('src/components/admin/LegalImporter.tsx');
  const status = await read('src/components/admin/KnowledgeBaseStatus.tsx');

  assert.match(search, /\/legal\/search/);
  assert.match(importer, /\/legal\/admin\/sources\/upload/);
  assert.match(importer, /\/legal\/admin\/sources\/html/);
  assert.match(importer, /\/legal\/admin\/sources\/url/);
  assert.match(status, /\/legal\/admin\/stats/);
  assert.match(status, /\/reindex/);
  assert.match(status, /method: 'DELETE'/);

  for (const source of [search, importer, status]) {
    assert.equal(/integrations\/supabase|supabase\.|\/functions\/v1\//.test(source), false);
  }
});

test('legal routes require authentication and separate read from manage permissions', async () => {
  const routes = await read('apps/api/src/hring_api/domains/legal/routes.py');
  const policy = await read('apps/api/src/hring_api/domains/access/policy.py');

  assert.match(routes, /get_current_principal/);
  assert.match(routes, /product\.legal\.read/);
  assert.match(routes, /product\.legal\.manage/);
  assert.match(routes, /MAX_DOCUMENT_BYTES \+ 1/);
  assert.match(routes, /await db\.rollback\(\)/);
  assert.match(policy, /"content_admin"[\s\S]*"product\.legal\.manage"/);
});

test('legal ingestion is local, bounded, OCR capable, and SSRF resistant', async () => {
  const ingestion = await read('apps/api/src/hring_api/domains/legal/ingestion.py');
  const embedding = await read('apps/api/src/hring_api/domains/legal/embedding.py');
  const dockerfile = await read('apps/api/Dockerfile');

  assert.match(ingestion, /MAX_DOCUMENT_BYTES = 10 \* 1024 \* 1024/);
  assert.match(ingestion, /MAX_OCR_PAGES = 50/);
  assert.match(ingestion, /follow_redirects=False/);
  assert.match(ingestion, /ip\.is_private/);
  assert.match(ingestion, /tesseract/);
  assert.match(ingestion, /pdftoppm/);
  assert.match(embedding, /hring-fa-hash-v1/);
  assert.equal(/OpenAI|Gemini|Anthropic|api_key|httpx/.test(embedding), false);
  assert.match(dockerfile, /tesseract-ocr-fas/);
  assert.match(dockerfile, /poppler-utils/);
});

test('legal persistence deduplicates, versions, reindexes, deletes vectors, and audits', async () => {
  const models = await read('apps/api/src/hring_api/domains/legal/models.py');
  const service = await read('apps/api/src/hring_api/domains/legal/service.py');
  const repository = await read('apps/api/src/hring_api/domains/legal/repository.py');

  assert.match(models, /UniqueConstraint\("checksum"/);
  assert.match(models, /source_key[\s\S]*version/);
  assert.match(models, /vector_cosine_ops/);
  assert.match(repository, /vector_score \* 0\.75 \+ lexical_score \* 0\.25/);
  assert.match(service, /legal\.source\.duplicate/);
  assert.match(service, /legal\.source\.reindex/);
  assert.match(service, /legal\.source\.delete/);
  assert.match(service, /replace_source_chunks\(session, source=source, chunks=\[\]\)/);
});

test('native legal migration follows head and preserves forward and rollback data', async () => {
  const migration = await read(
    'apps/api/alembic/versions/20260826_0016_native_legal_knowledge.py',
  );

  assert.match(migration, /down_revision: str \| None = "20260824_0015"/);
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  assert.match(migration, /FROM compat_records AS records/);
  assert.match(migration, /records\.table_name = 'legal_docs'/);
  assert.match(migration, /digest\(document_text, 'sha256'\)/);
  assert.match(migration, /legacy-pending/);
  assert.match(migration, /ON CONFLICT \(source_id, content_checksum\) DO NOTHING/);
  assert.match(migration, /INSERT INTO compat_records/);
  assert.match(migration, /ON CONFLICT \(table_name, record_id\) DO UPDATE/);
});
