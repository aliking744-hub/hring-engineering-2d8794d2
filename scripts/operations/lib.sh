#!/usr/bin/env bash

set -Eeuo pipefail

OPERATIONS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${OPERATIONS_DIR}/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPOSITORY_ROOT}/.env.standalone}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPOSITORY_ROOT}/compose.yaml}"
BACKUP_ROOT="${BACKUP_ROOT:-${REPOSITORY_ROOT}/backups}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command is unavailable: $1"
}

require_file() {
  [[ -f "$1" ]] || fail "Required file does not exist: $1"
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

prepare_backup_root() {
  [[ -n "${BACKUP_ROOT}" ]] || fail "BACKUP_ROOT cannot be empty"
  case "${BACKUP_ROOT}" in
    /|/root|/home|/opt|/var|"${REPOSITORY_ROOT}")
      fail "BACKUP_ROOT is too broad: ${BACKUP_ROOT}"
      ;;
  esac
  mkdir -p -m 0700 -- "${BACKUP_ROOT}"
  BACKUP_ROOT="$(cd -- "${BACKUP_ROOT}" && pwd -P)"
  case "${BACKUP_ROOT}" in
    /|/root|/home|/opt|/var|"${REPOSITORY_ROOT}")
      fail "Resolved BACKUP_ROOT is too broad: ${BACKUP_ROOT}"
      ;;
  esac
  [[ "${BACKUP_ROOT}" =~ ^/[^/]+/[^/]+(/.*)?$ ]] \
    || fail "Resolved BACKUP_ROOT must contain at least two path components: ${BACKUP_ROOT}"
  chmod 0700 -- "${BACKUP_ROOT}"
}

validate_backup_id() {
  [[ "$1" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || fail "Invalid backup identifier: $1"
}

validate_drill_database() {
  [[ "$1" =~ ^hring_restore_drill_[0-9]{14}_[a-f0-9]{8}$ ]] \
    || fail "Refusing unsafe drill database name: $1"
}

validate_drill_bucket() {
  [[ "$1" =~ ^hring-restore-drill-[0-9]{14}-[a-f0-9]{8}$ ]] \
    || fail "Refusing unsafe drill bucket name: $1"
}

backup_directory() {
  local backup_id="$1"
  validate_backup_id "${backup_id}"
  printf '%s/%s\n' "${BACKUP_ROOT}" "${backup_id}"
}

manifest_value() {
  local manifest="$1"
  local key="$2"
  awk -F= -v wanted="${key}" '$1 == wanted { print substr($0, index($0, "=") + 1); exit }' "${manifest}"
}
