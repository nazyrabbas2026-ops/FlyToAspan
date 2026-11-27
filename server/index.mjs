import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { createApi, normalizeEmail, checkPassword } from './api.mjs';
import { createAccount, openDatabase } from './store.mjs';
import { startDailyXmlShowcaseScheduler } from './xml-showcase.mjs';

const buildDirectory = resolve(process.env.FLYTOASPAN_DIST || 'dist');
const db = openDatabase();
const api = createApi({ db });
startDailyXmlShowcaseScheduler(db);

// Optional zero-shell initial admin bootstrap for Docker / Render Free Tier
if (process.env.FLYTOASPAN_ADMIN_EMAIL && process.env.FLYTOASPAN_ADMIN_PASSWORD) {
  try {
    const email = normalizeEmail(process.env.FLYTOASPAN_ADMIN_EMAIL);
    const password = checkPassword(process.env.FLYTOASPAN_ADMIN_PASSWORD, 12);
    const created = await createAccount(db, {
      email,
      password,
      role: 'admin',
      firstName: 'FlyToAspan',
      lastName: 'Yönetici',
      phone: '',
      accountType: 'individual',
    });
    if (created) console.log(`FlyToAspan: Initial admin created (${email})`);
  } catch (err) {
    console.error('Admin bootstrap skipped:', err.message);
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = createServer({ requestTimeout: 20_000, headersTimeout: 10_000 }, async (req, res) => {
  try {
    if (await api(req, res)) return;
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const isAsset = (/^\/(?:assets|images)\/[A-Za-z0-9._-]+$/.test(path) || ['/manifest.json', '/robots.txt', '/sitemap.xml'].includes(path)) && !path.endsWith('/..');
    const isPage = /^\/(?:[a-z0-9-]+\/?)*$/.test(path) && !/^\/(api|assets|images)(\/|$)/.test(path);
    if (!isAsset && !isPage) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(buildDirectory, isAsset ? '.' + path : 'index.html');
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; connect-src 'self' https://open.er-api.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    else res.destroy();
  }
});

const port = Number(process.env.PORT || 4178);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
server.listen(port, host, () => {
  console.log(`FlyToAspan: http://${host}:${port}`);
});
