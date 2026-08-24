#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_command docker
require_command sha256sum
require_command tar
require_file "${ENV_FILE}"
require_file "${COMPOSE_FILE}"
prepare_backup_root

[[ $# -eq 1 ]] || fail "Usage: $0 BACKUP_DIRECTORY"
requested_dir="$1"
[[ -d "${requested_dir}" ]] || fail "Backup directory does not exist: ${requested_dir}"
backup_dir="$(cd -- "${requested_dir}" && pwd -P)"
backup_id="$(basename -- "${backup_dir}")"
validate_backup_id "${backup_id}"
[[ "$(dirname -- "${backup_dir}")" == "${BACKUP_ROOT}" ]] \
  || fail "Backup must be a direct child of BACKUP_ROOT"

for required in postgres.dump minio.tar.gz manifest.txt SHA256SUMS; do
  require_file "${backup_dir}/${required}"
done

(
  cd -- "${backup_dir}"
  sha256sum --check SHA256SUMS
)

compose exec -T postgres pg_restore --list <"${backup_dir}/postgres.dump" >/dev/null

unsafe_entry="$(
  tar -tzf "${backup_dir}/minio.tar.gz" \
    | awk '(/^\// || /(^|\/)\.\.($|\/)/) && !found { unsafe = $0; found = 1 } END { if (found) print unsafe }'
)"
[[ -z "${unsafe_entry}" ]] || fail "Unsafe path in MinIO archive: ${unsafe_entry}"
tar -tzf "${backup_dir}/minio.tar.gz" \
  | awk '/^hring-private\// { found = 1 } END { exit !found }' \
  || fail "MinIO archive does not contain the expected bucket root"

[[ "$(manifest_value "${backup_dir}/manifest.txt" format_version)" == "1" ]] \
  || fail "Unsupported backup format"
[[ "$(manifest_value "${backup_dir}/manifest.txt" created_at_utc)" == "${backup_id}" ]] \
  || fail "Manifest identifier does not match the backup directory"
[[ -n "$(manifest_value "${backup_dir}/manifest.txt" alembic_revision)" ]] \
  || fail "Manifest has no Alembic revision"
[[ "$(manifest_value "${backup_dir}/manifest.txt" minio_object_count)" =~ ^[0-9]+$ ]] \
  || fail "Manifest has an invalid MinIO object count"

printf 'Backup verification passed: %s\n' "${backup_dir}"
