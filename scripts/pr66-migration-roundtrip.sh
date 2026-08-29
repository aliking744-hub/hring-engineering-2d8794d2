#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

env_file="${PR66_ENV_FILE:-.env.standalone}"
if [[ ! -f "$env_file" ]]; then
  printf 'Missing %s. Set PR66_ENV_FILE to the standalone environment file.\n' "$env_file" >&2
  exit 2
fi

stamp="$(date -u +%Y%m%d%H%M%S)"
db_name="hring_pr66_migration_${stamp}_$$"

cleanup() {
  docker compose --env-file "$env_file" exec -T postgres \
    dropdb --if-exists --force -U hring "$db_name" >/dev/null
}
trap cleanup EXIT

docker compose --env-file "$env_file" up -d postgres
docker compose --env-file "$env_file" exec -T postgres createdb -U hring "$db_name"

docker compose --env-file "$env_file" run --rm --no-deps \
  -e PR66_DB_NAME="$db_name" \
  api /bin/sh -ec '
    export DATABASE_URL="${DATABASE_URL%/*}/${PR66_DB_NAME}"
    alembic upgrade head
    alembic downgrade base
    alembic upgrade head
    alembic current
  '

printf 'Alembic round-trip passed on isolated database %s.\n' "$db_name"
