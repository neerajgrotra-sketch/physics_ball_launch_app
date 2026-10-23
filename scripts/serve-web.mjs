// Serves the static web build in dist/ (from `npm run build:web`) for playing locally.
// Unlike the dev server there is no live reload, and unknown paths fall back to index.html,
// so deep links such as /level/02-long-way-back work.
// Run with: node scripts/serve-web.mjs [port]   (default 8090)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.argv[2] ?? 8090);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.wav': 'audio/wav',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('No web build found. Run `npm run build:web` first.');
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    // Hashed bundles can be cached; the page itself must always be fresh.
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Bank Shot: http://localhost:${PORT}`));
