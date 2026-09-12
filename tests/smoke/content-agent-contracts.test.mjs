import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const app = read('src/App.tsx');
const admin = read('src/pages/Admin.tsx');
const blog = read('src/pages/Blog.tsx');
const post = read('src/pages/BlogPost.tsx');
const worker = read('apps/api/src/hring_api/worker/app.py');
const migration = read('apps/api/alembic/versions/20260909_0042_autonomous_content_agent.py');
const contentAdmin = read('src/pages/ContentAgentAdmin.tsx');
const contentService = read('apps/api/src/hring_api/domains/content/service.py');

assert.match(app, /\/admin\/content-agent/);
assert.match(admin, /ایجنت تحریریه HR/);
assert.doesNotMatch(blog, /supabase/);
assert.doesNotMatch(post, /supabase/);
assert.match(worker, /hring\.content\.generate_article/);
assert.match(worker, /minute="\*\/15"/);
assert.match(migration, /content_agent_settings/);
assert.match(migration, /content_articles/);
assert.match(migration, /content_agent_runs/);
assert.match(migration, /content\.hr_trend_research/);
assert.match(migration, /content\.hr_article_writer/);

console.log('content-agent-contracts: ok');

assert.match(contentAdmin, /پیش‌نمایش/);
assert.match(contentAdmin, /انتشار دستی/);
assert.match(contentAdmin, /ReactMarkdown/);
assert.match(contentService, /return "draft", "drafted"/);
