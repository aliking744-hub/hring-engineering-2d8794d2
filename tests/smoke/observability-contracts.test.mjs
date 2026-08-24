import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('monitoring images are pinned and control-plane ports are loopback-only', async () => {
  const compose = await read('compose.yaml');

  assert.match(compose, /prom\/prometheus:v3\.13\.2/);
  assert.match(compose, /prom\/alertmanager:v0\.34\.0/);
  assert.match(compose, /prom\/blackbox-exporter:v0\.28\.0/);
  assert.match(compose, /127\.0\.0\.1:\$\{PROMETHEUS_PORT:-9090\}:9090/);
  assert.match(compose, /127\.0\.0\.1:\$\{ALERTMANAGER_PORT:-9093\}:9093/);
  assert.doesNotMatch(compose, /(?:^|\n)\s+- "?0\.0\.0\.0:909[03]/);
});

test('Prometheus scrapes both applications and probes all stateful services', async () => {
  const config = await read('infra/monitoring/prometheus.yml');

  for (const expected of [
    'api:8000',
    'ai:8000',
    'web/healthz',
    'minio:9000/minio/health/live',
    'postgres:5432',
    'redis:6379',
    'alertmanager:9093',
  ]) {
    assert.match(config, new RegExp(expected.replaceAll('/', '\\/')));
  }
});

test('metrics stay off the public API prefix and avoid unbounded URL labels', async () => {
  const apiMain = await read('apps/api/src/hring_api/main.py');
  const apiMetrics = await read('apps/api/src/hring_api/observability.py');
  const aiMain = await read('services/ai-gateway/src/hring_ai_gateway/main.py');
  const nginx = await read('infra/nginx/default.conf');

  assert.match(apiMain, /@app\.get\("\/metrics"/);
  assert.match(apiMain, /allowed_hosts=\[\*settings\.trusted_hosts, "api"\]/);
  assert.match(aiMain, /@app\.get\("\/metrics"/);
  assert.match(apiMetrics, /candidate\.matches\(scope\)/);
  assert.match(apiMetrics, /match is Match\.FULL/);
  assert.match(apiMain, /routes=tuple\(app\.routes\)/);
  assert.doesNotMatch(apiMetrics, /request\.url\.(?:query|path).*labels/);
  assert.doesNotMatch(nginx, /location[^\n]*\/metrics/);
});

test('runtime alert rules cover availability, errors, latency, memory, and config failure', async () => {
  const alerts = await read('infra/monitoring/alerts.yml');

  for (const alert of [
    'HRingScrapeTargetDown',
    'HRingEndpointUnavailable',
    'HRingHighServerErrorRatio',
    'HRingHighRequestLatency',
    'HRingProcessMemoryHigh',
    'HRingPrometheusConfigReloadFailed',
  ]) {
    assert.match(alerts, new RegExp(`alert: ${alert}`));
  }
});
