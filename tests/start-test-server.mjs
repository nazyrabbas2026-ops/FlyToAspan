import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const port = process.env.QA_PORT || '4199';
const tempDir = mkdtempSync(join(tmpdir(), 'flytoaspan-e2e-'));
const dbPath = join(tempDir, 'flytoaspan-qa.sqlite');

const child = spawn(process.execPath, [resolve('server/index.mjs')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: port,
    FLYTOASPAN_DB: dbPath,
    FLYTOASPAN_ORIGIN: `http://127.0.0.1:${port}`,
    FLYTOASPAN_ADMIN_EMAIL: 'qa.admin@flytoaspan.test',
    FLYTOASPAN_ADMIN_PASSWORD: process.env.QA_ADMIN_PASS || 'QaAdminTempPass!2026',
  },
});

const cleanup = () => {
  try {
    child.kill();
  } catch {
    /* ignore */
  }
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
};

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
child.on('exit', (code) => {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(code ?? 0);
});
