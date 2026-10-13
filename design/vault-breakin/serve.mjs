import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4196);
const mime = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !mime[extname(path)]) { res.writeHead(404); res.end('Not found'); return; }
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Vault preview: ${url} (fictional fixtures only)`);
  if (process.argv.includes('--open') && process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', url]);
}).on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already running. Open http://127.0.0.1:${port}/ or choose another PORT.` : error.message); process.exitCode = 1; });
