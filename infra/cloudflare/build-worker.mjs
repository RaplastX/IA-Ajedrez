#!/usr/bin/env node
/**
 * Genera infra/cloudflare/dist/worker.js: un Worker de Cloudflare que sirve la web compilada
 * (apps/web/dist) con los archivos incrustados. Útil cuando no se puede usar la subida de assets
 * de wrangler (p. ej. detrás de un proxy que reescribe la autorización).
 *
 *   npm run build -w @ia-ajedrez/web
 *   node infra/cloudflare/build-worker.mjs
 *   cd infra/cloudflare/dist && CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
 *
 * Con `wrangler deploy` normal y "assets" (ver docs/DESPLIEGUE.md) no hace falta este script.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('../../apps/web/dist', import.meta.url).pathname;
const out = new URL('./dist/', import.meta.url).pathname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
};
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!name.endsWith('.map') && !name.startsWith('_')) {
      files['/' + relative(root, p)] = [
        TYPES[extname(name)] ?? 'application/octet-stream',
        readFileSync(p).toString('base64'),
      ];
    }
  }
};
walk(root);
const worker = `const FILES = ${JSON.stringify(files)};
const cache = new Map();
function body(path) {
  let b = cache.get(path);
  if (!b) { const bin = atob(FILES[path][1]); b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); cache.set(path, b); }
  return b;
}
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://tablebase.lichess.ovh; frame-ancestors 'none'";
export default {
  fetch(req) {
    let path = new URL(req.url).pathname;
    if (!FILES[path]) path = path.startsWith('/assets/') || path.startsWith('/engine/') ? null : '/index.html';
    if (!path) return new Response('Not found', { status: 404 });
    const immutable = path.startsWith('/assets/');
    return new Response(req.method === 'HEAD' ? null : body(path), { headers: {
      'Content-Type': FILES[path][0],
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : path === '/sw.js' || path === '/index.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': CSP,
    } });
  },
};
`;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'worker.js'), worker);
writeFileSync(
  join(out, 'wrangler.jsonc'),
  JSON.stringify(
    { name: 'ia-ajedrez', main: 'worker.js', compatibility_date: '2026-11-01', workers_dev: true },
    null,
    2,
  ),
);
console.log(`Worker generado en ${out} (${Object.keys(files).length} archivos)`);
