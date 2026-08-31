#!/usr/bin/env bash
set -euo pipefail

[[ $# -eq 1 ]] || { printf 'Usage: %s BACKUP_DIRECTORY\n' "$0" >&2; exit 2; }
command -v rclone >/dev/null || { printf 'rclone is required for offsite backup.\n' >&2; exit 2; }

backup_dir="$(cd -- "$1" && pwd -P)"
backup_id="$(basename -- "$backup_dir")"
[[ "$backup_id" =~ ^20[0-9]{6}T[0-9]{6}Z$ ]] || { printf 'Invalid backup identifier.\n' >&2; exit 2; }
[[ -n "${OFFSITE_REMOTE:-}" ]] || { printf 'Set OFFSITE_REMOTE, e.g. encrypted-remote:hring-backups\n' >&2; exit 2; }

rclone copy --immutable --checksum "$backup_dir" "${OFFSITE_REMOTE%/}/$backup_id"
rclone check --one-way --checksum "$backup_dir" "${OFFSITE_REMOTE%/}/$backup_id"
printf 'Offsite backup verified: %s/%s\n' "${OFFSITE_REMOTE%/}" "$backup_id"
