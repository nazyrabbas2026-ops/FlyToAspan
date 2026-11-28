import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDatabase } from './store.mjs';
import { createEncryptedBackup } from './backup.mjs';

const dbPath = process.env.FLYTOASPAN_DB || '.data/flytoaspan.sqlite';
const backupDir = resolve(process.env.FLYTOASPAN_BACKUP_DIR || 'backups');
const keepDays = Math.max(1, Number(process.env.FLYTOASPAN_BACKUP_KEEP) || 14);

mkdirSync(backupDir, { recursive: true, mode: 0o700 });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const production = process.env.NODE_ENV === 'production';
const extension = production ? '.ftaenc' : '.sqlite';
const outFile = join(backupDir, `flytoaspan-${stamp}${extension}`);

if (production) {
  createEncryptedBackup({ dbPath, outPath: outFile });
} else {
  const db = openDatabase(dbPath);
  try {
    db.exec(`VACUUM INTO '${outFile.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}
console.log(`[FlyToAspan Backup] Saved: ${outFile}`);

// Rotate old backups beyond keepDays
const files = readdirSync(backupDir)
  .filter((f) => f.startsWith('flytoaspan-') && f.endsWith(extension))
  .sort()
  .reverse();

for (const oldFile of files.slice(keepDays)) {
  rmSync(join(backupDir, oldFile), { force: true });
  console.log(`[FlyToAspan Backup] Rotated old backup: ${oldFile}`);
}
