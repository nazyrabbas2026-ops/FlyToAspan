import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createApi } from './server/api.mjs';

function siteApi(): Plugin {
  const register = (middlewares: Connect.Server) => {
    const api = createApi();
    middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      void api(req, res).catch(next);
    });
  };
  return {
    name: 'flytoaspan-api',
    configureServer: (server) => register(server.middlewares),
    configurePreviewServer: (server) => register(server.middlewares),
  };
}

export default defineConfig({
  plugins: [react(), siteApi()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/*.sqlite*', '**/server/**'] },
  },
});
