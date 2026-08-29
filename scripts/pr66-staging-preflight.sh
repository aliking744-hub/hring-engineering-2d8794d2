#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

env_file="${PR66_ENV_FILE:-.env.standalone}"
if [[ ! -f "$env_file" ]]; then
  printf 'Missing %s. Set PR66_ENV_FILE to the protected standalone environment file.\n' "$env_file" >&2
  exit 2
fi

value_for() {
  local key="$1"
  awk -F= -v wanted="$key" '$1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}

require_real_value() {
  local key="$1"
  local value
  value="$(value_for "$key")"
  if [[ -z "$value" || "$value" == *"CHANGE_ME"* ]]; then
    printf 'Required runtime value %s is missing or still a placeholder.\n' "$key" >&2
    exit 2
  fi
}

for key in \
  POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD \
  AUTH_JWT_SECRET AUTH_SECURITY_TOKEN_PEPPER AUTH_MFA_ENCRYPTION_KEY \
  SMS_OTP_PEPPER AI_API_KEY INTEGRATION_SECRET_ENCRYPTION_KEY
do
  require_real_value "$key"
done

printf '==> Validate standalone Compose configuration\n'
docker compose --env-file "$env_file" config --quiet

printf '==> Validate Alembic upgrade/downgrade on an isolated database\n'
PR66_ENV_FILE="$env_file" bash scripts/pr66-migration-roundtrip.sh

printf '\nPR66 staging preflight passed. The package is ready for the controlled staging deployment runbook.\n'
