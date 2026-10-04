'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = process.argv.includes('--dist') ? path.join(__dirname, 'dist') : __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); if (p === '/') p = '/index.html';
    if (p === '/admin') { res.writeHead(302, { Location: '/admin/' }).end(); return; }
    if (p === '/admin/') p = '/admin/index.html';
    const file = path.resolve(root, '.' + p);
    const topLevel = p.slice(1).indexOf('/') === -1;
    const adminFiles = ['index.html','login.html','style.css','editor.js','login.js','supabase-client.js'].map(name => '/admin/' + name);
    const allowed = topLevel ? /\.(html|js|css)$/.test(p) || ['/ontology.json', '/ontology-config.json', '/supabase-config.json', '/i18n-en.json', '/seo.json', '/robots.txt', '/sitemap.xml'].includes(p) : adminFiles.includes(p) || p === '/node_modules/@supabase/supabase-js/dist/umd/supabase.js' || ['/assets/', '/node_modules/cesium/Build/Cesium/', '/vendor/cesium/', '/vendor/supabase/'].some(prefix => p.startsWith(prefix));
    if (!file.startsWith(root + path.sep) || p.includes('\\') || p.split('/').some(s => s.startsWith('.')) || !allowed) { res.writeHead(403).end(); return; }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); fs.createReadStream(file).pipe(res);
    });
  } catch { res.writeHead(400).end(); }
}).listen(Number(process.env.PORT) || 4175, '127.0.0.1', () => console.log('AI RISK: http://localhost:' + (Number(process.env.PORT) || 4175)));
