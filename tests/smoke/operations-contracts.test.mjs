import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('operations shell scripts are syntactically valid', async () => {
  for (const script of [
    'scripts/operations/lib.sh',
    'scripts/operations/backup.sh',
    'scripts/operations/verify-backup.sh',
    'scripts/operations/restore-drill.sh',
    'scripts/operations/offsite-backup.sh',
  ]) {
    await execFileAsync('bash', ['-n', script]);
  }
});

test('backup is atomic, checksummed, private, and covers PostgreSQL plus MinIO', async () => {
  const backup = await read('scripts/operations/backup.sh');

  assert.match(backup, /umask 077/);
  assert.ok(backup.indexOf('umask 077') < backup.indexOf('prepare_backup_root'));
  assert.match(backup, /flock -n/);
  assert.match(backup, /pg_dump --format=custom/);
  assert.match(backup, /mc mirror --overwrite hring\/hring-private/);
  assert.match(backup, /docker cp "\$\{minio_container\}:\/tmp\/hring-export\/hring-private"/);
  assert.match(backup, /find "\$\{partial_dir\}\/hring-private" -type f/);
  assert.match(backup, /tar -C "\$\{partial_dir\}" -czf/);
  assert.doesNotMatch(backup, /find \/tmp\/hring-export|tar -C \/tmp\/hring-export/);
  assert.match(backup, /sha256sum postgres\.dump minio\.tar\.gz manifest\.txt/);
  assert.match(backup, /\.partial/);
  assert.match(backup, /mv -- "\$\{partial_dir\}" "\$\{target_dir\}"/);
});

test('restore drill can only target isolated temporary resources and verifies both stores', async () => {
  const restore = await read('scripts/operations/restore-drill.sh');
  const library = await read('scripts/operations/lib.sh');

  assert.match(library, /\^hring_restore_drill_/);
  assert.match(library, /\^hring-restore-drill-/);
  assert.match(restore, /pg_restore --exit-on-error/);
  assert.match(restore, /restored_revision/);
  assert.match(restore, /public_table_count/);
  assert.match(restore, /restored_object_count/);
  assert.match(restore, /dropdb --force --if-exists/);
  assert.match(restore, /mc rb --force/);
  assert.equal(/--dbname=["']?hring["']?/.test(restore), false);
});

test('daily backup timer verifies each completed artifact', async () => {
  const service = await read('infra/systemd/hring-backup.service');
  const timer = await read('infra/systemd/hring-backup.timer');

  assert.match(service, /scripts\/operations\/backup\.sh/);
  assert.match(service, /scripts\/operations\/verify-backup\.sh/);
  assert.match(service, /BACKUP_ROOT=\/var\/backups\/hring/);
  assert.match(timer, /OnCalendar=\*-\*-\* 02:15:00/);
  assert.match(timer, /Persistent=true/);
});


test('offsite backup is explicitly configured, immutable, and checks its copied artifact', async () => {
  const offsite = await read('scripts/operations/offsite-backup.sh');

  assert.match(offsite, /OFFSITE_REMOTE/);
  assert.match(offsite, /rclone copy --immutable --checksum/);
  assert.match(offsite, /rclone check --one-way --checksum/);
  assert.match(offsite, /Invalid backup identifier/);
  assert.doesNotMatch(offsite, /rclone sync/);
});
