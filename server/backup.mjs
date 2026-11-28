// Encrypted SQLite Backup & Restore Utility for FlyToAspan
// Uses SQLite VACUUM INTO (safe online hot-backup under WAL) + AES-256-GCM + SHA-256 integrity envelope.
// Usage:
//   node server/backup.mjs create <outFile.enc.json>
//   node server/backup.mjs restore <inFile.enc.json> <targetDbPath>
import { constants, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { decryptBufferEnvelope, encryptBufferEnvelope, resolvePiiKey } from './crypto.mjs';

function productionKey(raw, name) {
  if (Buffer.isBuffer(raw) && raw.length === 32) return raw;
  const value = String(raw ?? '').trim();
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const key = Buffer.from(value, 'base64');
  if (key.length === 32 && key.toString('base64').replace(/=+$/, '') === value.replace(/=+$/, '')) return key;
  throw new Error(name + ' üretimde 32 baytlık bir anahtar olarak tanımlanmalı.');
}

function backupEncryptionKey(dbPath, explicitKey) {
  const value = explicitKey || process.env.FLYTOASPAN_BACKUP_KEY;
  if (process.env.NODE_ENV !== 'production') return value || resolvePiiKey(dbPath);
  const backup = productionKey(value, 'FLYTOASPAN_BACKUP_KEY');
  const pii = productionKey(process.env.FLYTOASPAN_PII_KEY, 'FLYTOASPAN_PII_KEY');
  if (backup.equals(pii)) throw new Error('Yedek anahtarı yolcu verisi anahtarından farklı olmalı.');
  return backup;
}

export function createEncryptedBackup({ dbPath, outPath, backupKey }) {
  const resolvedDb = resolve(dbPath);
  const resolvedOut = resolve(outPath);
  const key = backupEncryptionKey(resolvedDb, backupKey);
  const tmpDir = mkdtempSync(join(tmpdir(), 'flytoaspan-bak-'));
  const snapshotPath = join(tmpDir, 'snapshot.sqlite');
  try {
    const db = new DatabaseSync(resolvedDb, { readOnly: true });
    try {
      db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }
    const raw = readFileSync(snapshotPath);
    const envelope = encryptBufferEnvelope(raw, key);
    mkdirSync(dirname(resolvedOut), { recursive: true, mode: 0o700 });
    writeFileSync(resolvedOut, envelope, { mode: 0o600, flag: 'wx' });
    return { outPath: resolvedOut, bytes: raw.length, encryptedBytes: Buffer.byteLength(envelope) };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function restoreEncryptedBackup({ inPath, targetDbPath, backupKey }) {
  const resolvedIn = resolve(inPath);
  const resolvedTarget = resolve(targetDbPath);
  const key = backupEncryptionKey(resolvedTarget, backupKey);
  if ([resolvedTarget, resolvedTarget + '-wal', resolvedTarget + '-shm'].some(existsSync)) {
    throw new Error('Geri yükleme için kullanılmamış bir veritabanı dosyası seçin.');
  }
  const envelopeJson = readFileSync(resolvedIn, 'utf8');
  const { plain, meta } = decryptBufferEnvelope(envelopeJson, key);

  const tmpDir = mkdtempSync(join(tmpdir(), 'flytoaspan-restore-'));
  const stagedPath = join(tmpDir, 'restored.sqlite');
  try {
    writeFileSync(stagedPath, plain, { mode: 0o600 });
    // Integrity check BEFORE touching target DB
    const testDb = new DatabaseSync(stagedPath);
    try {
      const check = testDb.prepare('PRAGMA integrity_check').get();
      if (check?.integrity_check !== 'ok') {
        throw new Error(`SQLite bütünlük kontrolü başarısız: ${JSON.stringify(check)}`);
      }
      const counts = {
        users: testDb.prepare('SELECT COUNT(*) AS c FROM users').get()?.c ?? 0,
        bookings: testDb.prepare('SELECT COUNT(*) AS c FROM bookings').get()?.c ?? 0,
      };
      mkdirSync(dirname(resolvedTarget), { recursive: true, mode: 0o700 });
      copyFileSync(stagedPath, resolvedTarget, constants.COPYFILE_EXCL);
      return { targetDbPath: resolvedTarget, sha256: meta.sha256, createdAt: meta.createdAt, counts };
    } finally {
      testDb.close();
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  const dbPath = process.env.FLYTOASPAN_DB || '.data/flytoaspan.sqlite';
  if (cmd === 'create' && arg1) {
    const res = createEncryptedBackup({ dbPath, outPath: arg1 });
    console.log(JSON.stringify({ ok: true, action: 'backup_created', ...res }));
  } else if (cmd === 'restore' && arg1 && arg2) {
    const res = restoreEncryptedBackup({ inPath: arg1, targetDbPath: arg2 });
    console.log(JSON.stringify({ ok: true, action: 'backup_restored', ...res }));
  } else {
    console.error('Usage:\n  node server/backup.mjs create <out.enc.json>\n  node server/backup.mjs restore <in.enc.json> <target.sqlite>');
    process.exit(1);
  }
}
