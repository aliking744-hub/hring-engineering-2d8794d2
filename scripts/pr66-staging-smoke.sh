#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-https://hring.ir}"
base_url="${base_url%/}"
report_dir="${PR66_REPORT_DIR:-artifacts/pr66/release}"
mkdir -p "$report_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
report="$report_dir/smoke-$timestamp.txt"

request_status() {
  local path="$1"
  shift
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 10 --max-time 30 "$@" "$base_url$path"
}

health_status="$(request_status /api/v1/health)"
web_status="$(request_status /)"
anonymous_credit_status="$(request_status /api/v1/billing/credits/me)"
public_paths=(/blog /faq /product-catalog /sitemap.xml /auth)

{
  printf 'timestamp=%s\n' "$timestamp"
  printf 'base_url=%s\n' "$base_url"
  printf 'health_status=%s\n' "$health_status"
  printf 'web_status=%s\n' "$web_status"
  printf 'anonymous_credit_status=%s\n' "$anonymous_credit_status"
} >"$report"

for public_path in "${public_paths[@]}"; do
  public_status="$(request_status "$public_path")"
  printf 'public_status[%s]=%s\n' "$public_path" "$public_status" >>"$report"
  if [[ "$public_status" != "200" ]]; then
    printf 'Public route %s failed with HTTP %s\n' "$public_path" "$public_status" >&2
    exit 1
  fi
done

health_body="$(curl --silent --show-error --fail --connect-timeout 10 --max-time 30   "$base_url/api/v1/health")"
if [[ "$health_body" != *'"status":"ok"'* ]]; then
  printf 'Health endpoint returned an unexpected body.\n' >&2
  exit 1
fi

sitemap_body="$(curl --silent --show-error --fail --connect-timeout 10 --max-time 30   "$base_url/sitemap.xml")"
if [[ "$sitemap_body" != *'<urlset'* && "$sitemap_body" != *'<sitemapindex'* ]]; then
  printf 'Sitemap response is not valid sitemap XML.\n' >&2
  exit 1
fi

if [[ "$health_status" != "200" ]]; then
  printf 'Health check failed with HTTP %s\n' "$health_status" >&2
  exit 1
fi
if [[ "$web_status" != "200" ]]; then
  printf 'Web check failed with HTTP %s\n' "$web_status" >&2
  exit 1
fi
if [[ "$anonymous_credit_status" != "401" && "$anonymous_credit_status" != "403" ]]; then
  printf 'Protected credit endpoint returned unsafe HTTP %s\n' "$anonymous_credit_status" >&2
  exit 1
fi

headers_report="$report_dir/headers-$timestamp.txt"
curl --silent --show-error --head --connect-timeout 10 --max-time 30 \
  "$base_url/" >"$headers_report"

require_header() {
  local header_name="$1"
  if ! grep -Eqi "^${header_name}:" "$headers_report" >/dev/null; then
    printf 'Required security header %s is missing.\n' "$header_name" >&2
    exit 1
  fi
}

require_header 'x-content-type-options'
require_header 'x-frame-options'
require_header 'content-security-policy'
if [[ "${PR66_REQUIRE_HSTS:-true}" == "true" ]]; then
  require_header 'strict-transport-security'
fi

if [[ -n "${PR66_AUTH_TOKEN:-}" ]]; then
  authenticated_credit_status="$(request_status /api/v1/billing/credits/me \
    --header "Authorization: Bearer ${PR66_AUTH_TOKEN}")"
  printf 'authenticated_credit_status=%s\n' "$authenticated_credit_status" >>"$report"
  if [[ "$authenticated_credit_status" != "200" ]]; then
    printf 'Authenticated credit check failed with HTTP %s\n' "$authenticated_credit_status" >&2
    exit 1
  fi
fi

printf 'Non-destructive release health gate passed. Evidence: %s\n' "$report"
