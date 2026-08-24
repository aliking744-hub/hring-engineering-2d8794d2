import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('worker uses authenticated isolated Redis databases and fixed queues', async () => {
  const compose = await read('compose.yaml');

  assert.match(compose, /CELERY_BROKER_URL: redis:\/\/:\$\{REDIS_PASSWORD\}@redis:6379\/1/);
  assert.match(compose, /CELERY_RESULT_BACKEND: redis:\/\/:\$\{REDIS_PASSWORD\}@redis:6379\/2/);
  assert.match(
    compose,
    /--queues=hring\.default,hring\.ai,hring\.notifications,hring\.maintenance/,
  );
  assert.match(compose, /worker:[\s\S]*?read_only: true[\s\S]*?no-new-privileges:true/);
  assert.doesNotMatch(compose, /worker:[\s\S]*?ports:[\s\S]*?9808:9808/);
});

test('Celery accepts JSON only and uses bounded reliable delivery defaults', async () => {
  const worker = await read('apps/api/src/hring_api/worker/app.py');

  assert.match(worker, /accept_content=\("json",\)/);
  assert.match(worker, /task_acks_late=True/);
  assert.match(worker, /task_reject_on_worker_lost=True/);
  assert.match(worker, /worker_prefetch_multiplier=1/);
  assert.match(worker, /task_soft_time_limit=/);
  assert.match(worker, /task_time_limit=/);
});

test('worker readiness and heartbeat are monitored without a public endpoint', async () => {
  const compose = await read('compose.yaml');
  const prometheus = await read('infra/monitoring/prometheus.yml');
  const alerts = await read('infra/monitoring/alerts.yml');

  assert.match(compose, /hring_worker_ready 1\.0/);
  assert.match(prometheus, /job_name: hring-worker[\s\S]*worker:9808/);
  assert.match(alerts, /alert: HRingWorkerHeartbeatStale/);
  assert.match(alerts, /hring_worker_last_heartbeat_timestamp_seconds/);
});

