import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { decryptPii, encryptPii } from '../server/crypto.mjs';

test('Production backup uses a separate key and restores encrypted reservation data', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'flytoaspan-backup-prod-'));
  const dbPath = join(dir, 'source.sqlite');
  const backupDir = join(dir, 'archives');
  const restoredPath = join(dir, 'restored.sqlite');
  const piiKey = randomBytes(32);
  const backupKey = randomBytes(32);
  const document = 'TEST-DOCUMENT-01';
  const db = new DatabaseSync(dbPath);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE bookings (pnr TEXT PRIMARY KEY, document TEXT NOT NULL);
    INSERT INTO users VALUES ('test-account');
  `);
  db.prepare('INSERT INTO bookings VALUES (?, ?)').run('TEST-PNR', encryptPii(document, piiKey));

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    FLYTOASPAN_DB: dbPath,
    FLYTOASPAN_BACKUP_DIR: backupDir,
    FLYTOASPAN_PII_KEY: piiKey.toString('hex'),
    FLYTOASPAN_BACKUP_KEY: backupKey.toString('base64'),
  };
  const run = (args, overrides = {}) =>
    spawnSync(process.execPath, args, { env: { ...env, ...overrides }, encoding: 'utf8' });

  for (const key of ['', 'too-short', piiKey.toString('base64')]) {
    const refused = run(['server/backup-db.mjs'], { FLYTOASPAN_BACKUP_KEY: key });
    assert.equal(refused.status, 1);
    assert.deepEqual(readdirSync(backupDir), []);
  }

  const backup = run(['server/backup-db.mjs']);
  assert.equal(backup.status, 0, backup.stderr);
  const files = readdirSync(backupDir);
  assert.equal(files.length, 1);
  assert.match(files[0], /\.ftaenc$/);
  const archive = join(backupDir, files[0]);
  const envelope = JSON.parse(readFileSync(archive, 'utf8'));
  assert.equal(envelope.format, 'flytoaspan-backup-v1');
  assert.equal(envelope.alg, 'aes-256-gcm');

  const restoreArgs = ['server/backup.mjs', 'restore', archive, restoredPath];
  assert.equal(run(restoreArgs, { FLYTOASPAN_BACKUP_KEY: randomBytes(32).toString('hex') }).status, 1);
  const restored = run(restoreArgs);
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(JSON.parse(restored.stdout).counts, { users: 1, bookings: 1 });
  assert.equal(run(restoreArgs).status, 1);

  const recovered = new DatabaseSync(restoredPath, { readOnly: true });
  try {
    const row = recovered.prepare('SELECT document FROM bookings WHERE pnr = ?').get('TEST-PNR');
    assert.match(row.document, /^enc:v1:/);
    assert.equal(decryptPii(row.document, piiKey), document);
  } finally {
    recovered.close();
  }
});
