#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_command docker
require_command find
require_command flock
require_command sha256sum
require_command tar
require_file "${ENV_FILE}"
require_file "${COMPOSE_FILE}"
umask 077
prepare_backup_root

RETENTION_DAYS="${RETENTION_DAYS:-14}"
[[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] || fail "RETENTION_DAYS must be a non-negative integer"

backup_id="$(date -u +%Y%m%dT%H%M%SZ)"
target_dir="$(backup_directory "${backup_id}")"
partial_dir="${BACKUP_ROOT}/.${backup_id}.partial"
minio_container="hring-minio-export-$(printf '%s' "${backup_id}" | tr '[:upper:]' '[:lower:]')"

cleanup() {
  docker rm -f "${minio_container}" >/dev/null 2>&1 || true
  if [[ -d "${partial_dir}" && "${partial_dir}" == "${BACKUP_ROOT}/."*.partial ]]; then
    find "${partial_dir}" -depth -delete
  fi
}
trap cleanup EXIT

exec 9>"${BACKUP_ROOT}/.backup.lock"
flock -n 9 || fail "Another HRing backup is already running"
[[ ! -e "${target_dir}" && ! -e "${partial_dir}" ]] || fail "Backup target already exists"
mkdir -p -- "${partial_dir}"

postgres_id="$(compose ps -q postgres)"
minio_id="$(compose ps -q minio)"
[[ -n "${postgres_id}" ]] || fail "PostgreSQL container is not running"
[[ -n "${minio_id}" ]] || fail "MinIO container is not running"

compose exec -T postgres sh -ec \
  'pg_dump --format=custom --compress=6 --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  >"${partial_dir}/postgres.dump"

alembic_revision="$(
  compose exec -T postgres sh -ec \
    'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --command="SELECT version_num FROM alembic_version"' \
    | tr -d '[:space:]'
)"
[[ -n "${alembic_revision}" ]] || fail "Could not read the Alembic revision"

compose run -d --no-deps --name "${minio_container}" --entrypoint /bin/sh minio-init -ec '
  set -eu
  rm -rf /tmp/hring-export
  mkdir -p /tmp/hring-export/hring-private
  mc alias set hring http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mirror --overwrite hring/hring-private /tmp/hring-export/hring-private >/dev/null
' >/dev/null

minio_exit="$(docker wait "${minio_container}")"
if [[ "${minio_exit}" != "0" ]]; then
  docker logs "${minio_container}" >&2 || true
  fail "MinIO export failed"
fi
docker cp "${minio_container}:/tmp/hring-export/hring-private" "${partial_dir}/" >/dev/null
minio_object_count="$(find "${partial_dir}/hring-private" -type f | wc -l | tr -d '[:space:]')"
[[ "${minio_object_count}" =~ ^[0-9]+$ ]] || fail "Invalid MinIO object count"
tar -C "${partial_dir}" -czf "${partial_dir}/minio.tar.gz" hring-private
find "${partial_dir}/hring-private" -depth -delete

git_commit="$(git -C "${REPOSITORY_ROOT}" rev-parse HEAD 2>/dev/null || printf 'unknown')"
{
  printf 'format_version=1\n'
  printf 'created_at_utc=%s\n' "${backup_id}"
  printf 'git_commit=%s\n' "${git_commit}"
  printf 'database=hring\n'
  printf 'alembic_revision=%s\n' "${alembic_revision}"
  printf 'minio_bucket=hring-private\n'
  printf 'minio_object_count=%s\n' "${minio_object_count}"
} >"${partial_dir}/manifest.txt"

(
  cd -- "${partial_dir}"
  sha256sum postgres.dump minio.tar.gz manifest.txt >SHA256SUMS
)

mv -- "${partial_dir}" "${target_dir}"
trap - EXIT
docker rm -f "${minio_container}" >/dev/null 2>&1 || true

if (( RETENTION_DAYS > 0 )); then
  while IFS= read -r -d '' old_backup; do
    old_id="$(basename -- "${old_backup}")"
    validate_backup_id "${old_id}"
    find "${old_backup}" -depth -delete
  done < <(
    find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
      -regextype posix-extended -regex '.*/[0-9]{8}T[0-9]{6}Z' \
      -mtime "+${RETENTION_DAYS}" -print0
  )
fi

printf 'HRing backup completed: %s\n' "${target_dir}"
