const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const port = Number(process.env.PORT || 5173);
http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/') pathname = '/index.html';
  const full = path.resolve(base, '.' + pathname);
  if (!full.startsWith(base + path.sep) && full !== path.join(base, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`BREACH / INTEL demo: http://localhost:${port}`));
