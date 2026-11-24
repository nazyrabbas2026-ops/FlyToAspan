import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { createApi } from './api.mjs';

const buildDirectory = resolve(process.env.FLYTOASPAN_DIST || 'dist');
const api = createApi();
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
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
    const isAsset = /^\/(?:assets|images)\/[A-Za-z0-9._-]+$/.test(path) && !path.endsWith('/..');
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
server.listen(port, '127.0.0.1', () => {
  console.log(`FlyToAspan: http://127.0.0.1:${port}`);
});
