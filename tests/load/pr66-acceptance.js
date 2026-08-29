import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'https://staging.hring.ir').replace(/\/$/, '');
const webPath = __ENV.WEB_PATH || '/api/v1/health';
const webOnly = __ENV.PR66_WEB_ONLY === 'true';
const aiUrl = __ENV.AI_TEST_URL || '';
const aiToken = __ENV.AI_AUTH_TOKEN || '';
const aiPayload = __ENV.AI_PAYLOAD || '{}';

const webFailures = new Rate('pr66_web_failures');
const aiFailures = new Rate('pr66_ai_failures');
const aiDuration = new Trend('pr66_ai_duration', true);

const scenarios = {
  web_users: {
    executor: 'constant-vus',
    exec: 'webTraffic',
    vus: Number(__ENV.WEB_VUS || 100),
    duration: __ENV.WEB_DURATION || '2m',
  },
};

if (!webOnly) {
  scenarios.ai_jobs = {
    executor: 'constant-vus',
    exec: 'aiTraffic',
    vus: Number(__ENV.AI_VUS || 5),
    duration: __ENV.AI_DURATION || '2m',
  };
}

export const options = {
  scenarios,
  thresholds: {
    pr66_web_failures: ['rate<0.01'],
    'http_req_duration{scenario:web_users}': ['p(95)<1000'],
    pr66_ai_failures: webOnly ? [] : ['rate<0.05'],
    pr66_ai_duration: webOnly ? [] : ['p(95)<60000'],
  },
};

export function setup() {
  if (webOnly) return;
  if (!aiUrl || !aiToken) {
    fail('AI_TEST_URL and AI_AUTH_TOKEN are required unless PR66_WEB_ONLY=true');
  }
  try {
    JSON.parse(aiPayload);
  } catch {
    fail('AI_PAYLOAD must be valid JSON');
  }
}

export function webTraffic() {
  const response = http.get(`${baseUrl}${webPath}`, {
    tags: { name: 'pr66_web_health' },
  });
  const ok = check(response, {
    'web response is 2xx': (result) => result.status >= 200 && result.status < 300,
  });
  webFailures.add(!ok);
}

export function aiTraffic() {
  const response = http.post(aiUrl, aiPayload, {
    headers: {
      Authorization: `Bearer ${aiToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pr66-${__VU}-${__ITER}`,
    },
    timeout: __ENV.AI_TIMEOUT || '90s',
    tags: { name: 'pr66_ai_job' },
  });
  const ok = check(response, {
    'AI response is 2xx': (result) => result.status >= 200 && result.status < 300,
    'AI response is not empty': (result) => Boolean(result.body && result.body.trim()),
  });
  aiDuration.add(response.timings.duration);
  aiFailures.add(!ok);
}
