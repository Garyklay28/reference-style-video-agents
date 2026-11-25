import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.json': 'application/json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.css': 'text/css', '.png': 'image/png' };
const safe = p => { const f = path.normalize(path.join(root, decodeURIComponent(p))); if (!f.startsWith(root)) throw new Error('bad'); return f; };
http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/__save') {
      const f = safe(u.searchParams.get('path')); const chunks = []; req.on('data', c => chunks.push(c));
      req.on('end', () => { const b = Buffer.concat(chunks); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); res.end('saved ' + b.length); });
      return;
    }
    let f = safe(u.pathname); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.statusCode = 404; res.end('nf'); return; }
    const st = fs.statSync(f); res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.setHeader('cache-control', 'no-store'); res.setHeader('accept-ranges', 'bytes');
    const r = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    if (r) { const s = +r[1], e = r[2] ? +r[2] : st.size - 1; res.statusCode = 206; res.setHeader('content-range', `bytes ${s}-${e}/${st.size}`); res.setHeader('content-length', e - s + 1); fs.createReadStream(f, { start: s, end: e }).pipe(res); }
    else { res.setHeader('content-length', st.size); fs.createReadStream(f).pipe(res); }
  } catch (e) { res.statusCode = 500; res.end(String(e)); }
}).listen(+(process.argv[3] || 4801), '127.0.0.1', () => console.log('listening', process.argv[3] || 4801, root));
