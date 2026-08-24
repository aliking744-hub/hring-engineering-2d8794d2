#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_command docker
require_command od
require_command tar
require_file "${ENV_FILE}"
require_file "${COMPOSE_FILE}"
prepare_backup_root

[[ $# -eq 1 ]] || fail "Usage: $0 BACKUP_DIRECTORY"
requested_dir="$1"
"${SCRIPT_DIR}/verify-backup.sh" "${requested_dir}"
backup_dir="$(cd -- "${requested_dir}" && pwd -P)"

timestamp="$(date -u +%Y%m%d%H%M%S)"
random_suffix="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
drill_database="hring_restore_drill_${timestamp}_${random_suffix}"
drill_bucket="hring-restore-drill-${timestamp}-${random_suffix}"
mc_container="hring-minio-restore-${timestamp}-${random_suffix}"
validate_drill_database "${drill_database}"
validate_drill_bucket "${drill_bucket}"

extract_dir="$(mktemp -d "${TMPDIR:-/tmp}/hring-restore-drill.XXXXXXXX")"
database_created=0
bucket_created=0

cleanup() {
  if (( bucket_created == 1 )) && docker inspect "${mc_container}" >/dev/null 2>&1; then
    docker exec -e DRILL_BUCKET="${drill_bucket}" "${mc_container}" sh -ec '
      mc alias set hring http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
      mc rb --force "hring/$DRILL_BUCKET" >/dev/null 2>&1 || true
    ' >/dev/null 2>&1 || true
  fi
  docker rm -f "${mc_container}" >/dev/null 2>&1 || true
  if (( database_created == 1 )); then
    validate_drill_database "${drill_database}"
    compose exec -T -e DRILL_DATABASE="${drill_database}" postgres sh -ec \
      'dropdb --force --if-exists --username="$POSTGRES_USER" "$DRILL_DATABASE"' \
      >/dev/null 2>&1 || true
  fi
  if [[ -d "${extract_dir}" && "${extract_dir}" == "${TMPDIR:-/tmp}/hring-restore-drill."* ]]; then
    find "${extract_dir}" -depth -delete
  fi
}
trap cleanup EXIT

database_created=1
compose exec -T -e DRILL_DATABASE="${drill_database}" postgres sh -ec \
  'createdb --username="$POSTGRES_USER" "$DRILL_DATABASE"'

compose exec -T -e DRILL_DATABASE="${drill_database}" postgres sh -ec \
  'pg_restore --exit-on-error --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$DRILL_DATABASE"' \
  <"${backup_dir}/postgres.dump"

restored_revision="$(
  compose exec -T -e DRILL_DATABASE="${drill_database}" postgres sh -ec \
    'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$DRILL_DATABASE" --command="SELECT version_num FROM alembic_version"' \
    | tr -d '[:space:]'
)"
expected_revision="$(manifest_value "${backup_dir}/manifest.txt" alembic_revision)"
[[ "${restored_revision}" == "${expected_revision}" ]] \
  || fail "Restored Alembic revision does not match the manifest"

public_table_count="$(
  compose exec -T -e DRILL_DATABASE="${drill_database}" postgres sh -ec \
    'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$DRILL_DATABASE" --command="SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = '\''public'\''"' \
    | tr -d '[:space:]'
)"
[[ "${public_table_count}" =~ ^[1-9][0-9]*$ ]] || fail "Restored database has no public tables"

tar -xzf "${backup_dir}/minio.tar.gz" -C "${extract_dir}"
compose run -d --no-deps --name "${mc_container}" --entrypoint /bin/sh minio-init -ec \
  'mkdir -p /restore; trap "exit 0" TERM INT; sleep 900' >/dev/null
docker cp "${extract_dir}/hring-private/." "${mc_container}:/restore/" >/dev/null
docker exec -e DRILL_BUCKET="${drill_bucket}" "${mc_container}" sh -ec '
  set -eu
  mc alias set hring http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mb "hring/$DRILL_BUCKET" >/dev/null
' >/dev/null
bucket_created=1
docker exec -e DRILL_BUCKET="${drill_bucket}" "${mc_container}" sh -ec '
  set -eu
  mc alias set hring http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mirror --overwrite /restore "hring/$DRILL_BUCKET" >/dev/null
' >/dev/null

restored_object_count="$(
  docker exec -e DRILL_BUCKET="${drill_bucket}" "${mc_container}" sh -ec '
    mc alias set hring http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc ls --recursive --json "hring/$DRILL_BUCKET" | wc -l | tr -d " "
  '
)"
expected_object_count="$(manifest_value "${backup_dir}/manifest.txt" minio_object_count)"
[[ "${restored_object_count}" == "${expected_object_count}" ]] \
  || fail "Restored MinIO object count does not match the manifest"

printf 'Restore drill passed: database=%s tables=%s bucket=%s objects=%s\n' \
  "${drill_database}" "${public_table_count}" "${drill_bucket}" "${restored_object_count}"
