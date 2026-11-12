// Serves the built site in dist/ (honours DEMO_BASE and DEMO_PORT).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { demoBase } from './demo-base.mjs';
import { DEMO_CSP } from '../evals/demo-csp.mjs';
const root = path.resolve('dist');
const port = Number(process.env.DEMO_PORT || 4510);
const base = demoBase(process.env.DEMO_BASE);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.map': 'application/json' };
http.createServer((req, res) => {
  res.setHeader('content-security-policy', DEMO_CSP);
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base && pathname === base) { res.writeHead(301, { location: base + '/' }).end(); return; }
    if (base && !pathname.startsWith(base + '/')) { res.writeHead(404).end(); return; }
    file = path.resolve(root, '.' + pathname.slice(base.length));
  }
  catch { res.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Serving dist/ at http://127.0.0.1:${port}${base}/en/`));
