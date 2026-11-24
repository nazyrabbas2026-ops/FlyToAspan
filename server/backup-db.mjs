import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDatabase } from './store.mjs';

const dbPath = process.env.FLYTOASPAN_DB || '.data/flytoaspan.sqlite';
const backupDir = resolve(process.env.FLYTOASPAN_BACKUP_DIR || 'backups');
const keepDays = Math.max(1, Number(process.env.FLYTOASPAN_BACKUP_KEEP) || 14);

mkdirSync(backupDir, { recursive: true, mode: 0o700 });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = join(backupDir, `flytoaspan-${stamp}.sqlite`);
const escaped = outFile.replace(/'/g, "''");

const db = openDatabase(dbPath);
try {
  // VACUUM INTO creates a consistent, defragmented online snapshot safe under active WAL writes
  db.exec(`VACUUM INTO '${escaped}'`);
  console.log(`[FlyToAspan Backup] Saved: ${outFile}`);
} finally {
  db.close();
}

// Rotate old backups beyond keepDays
const files = readdirSync(backupDir)
  .filter((f) => f.startsWith('flytoaspan-') && f.endsWith('.sqlite'))
  .sort()
  .reverse();

for (const oldFile of files.slice(keepDays)) {
  rmSync(join(backupDir, oldFile), { force: true });
  console.log(`[FlyToAspan Backup] Rotated old backup: ${oldFile}`);
}
