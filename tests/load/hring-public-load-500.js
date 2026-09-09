import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'https://hring.ir').replace(/\/$/, '');
const SMOKE = __ENV.SMOKE === '1';

if (BASE_URL !== 'https://hring.ir') {
  throw new Error('Safety guard: this test is locked to https://hring.ir');
}

const fullStages = [
  { duration: '20s', target: 25 },
  { duration: '20s', target: 25 },
  { duration: '20s', target: 50 },
  { duration: '20s', target: 50 },
  { duration: '30s', target: 100 },
  { duration: '30s', target: 100 },
  { duration: '40s', target: 200 },
  { duration: '40s', target: 200 },
  { duration: '45s', target: 350 },
  { duration: '45s', target: 350 },
  { duration: '60s', target: 500 },
  { duration: '60s', target: 500 },
  { duration: '30s', target: 0 },
];

export const options = {
  discardResponseBodies: false,
  scenarios: {
    public_capacity: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: SMOKE
        ? [
            { duration: '10s', target: 5 },
            { duration: '20s', target: 5 },
            { duration: '10s', target: 0 },
          ]
        : fullStages,
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate>0.99', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<3000', abortOnFail: true, delayAbortEval: '45s' }],
  },
};

const pages = ['/', '/plans', '/blog', '/faq', '/shop', '/product-catalog'];
const commonParams = {
  headers: {
    'User-Agent': 'HRing-Owned-Capacity-Test/1.0',
    Accept: 'text/html,application/xhtml+xml,application/json',
  },
  timeout: '10s',
};

function localAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('/')) return `${BASE_URL}${value}`;
  if (value.startsWith(`${BASE_URL}/`)) return value;
  return null;
}

export default function () {
  const pagePath = pages[Math.floor(Math.random() * pages.length)];
  const page = http.get(`${BASE_URL}${pagePath}`, {
    ...commonParams,
    tags: { endpoint: 'public_page' },
  });

  check(page, {
    'public page status is 200': (response) => response.status === 200,
    'public page has HTML': (response) =>
      String(response.headers['Content-Type'] || '').includes('text/html'),
  });

  if (page.status === 200) {
    const assetUrls = [];
    page
      .html()
      .find('script[src], link[rel="stylesheet"][href]')
      .each((_index, element) => {
        const assetUrl = localAssetUrl(element.attr('src') || element.attr('href'));
        if (assetUrl && !assetUrls.includes(assetUrl)) assetUrls.push(assetUrl);
      });

    const assetResponses = http.batch(
      assetUrls.slice(0, 8).map((url) => [
        'GET',
        url,
        null,
        { ...commonParams, tags: { endpoint: 'static_asset' } },
      ]),
    );
    check(assetResponses, {
      'static assets are successful': (responses) =>
        responses.every((response) => response.status === 200 || response.status === 304),
    });
  }

  const apiResponses = http.batch([
    [
      'GET',
      `${BASE_URL}/api/v1/health`,
      null,
      { ...commonParams, tags: { endpoint: 'api_health' } },
    ],
    [
      'GET',
      `${BASE_URL}/api/v1/billing/plans`,
      null,
      { ...commonParams, tags: { endpoint: 'billing_plans' } },
    ],
  ]);

  check(apiResponses, {
    'public APIs return 200': (responses) =>
      responses.every((response) => response.status === 200),
  });

  sleep(1 + Math.random() * 2);
}

