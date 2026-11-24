/**
 * BETA PLAYER v2.0 — Server
 * Developer: Surendhar S | B.E. CSE | 2025-2029 | Bannari Amman Institute of Technology
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');
const { EventEmitter } = require('events');

const PORT        = 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PLAYLIST_F  = path.join(__dirname, 'playlist.json');

// Create uploads dir
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── MULTER ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 * 1024 } }); // 20 GB limit

// ── MIME TYPES ────────────────────────────────────────────────────────────────
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml; charset=utf-8', '.ico':'image/x-icon',
  '.mp4':'video/mp4', '.mkv':'video/x-matroska', '.webm':'video/webm',
  '.avi':'video/x-msvideo', '.mov':'video/quicktime',
  '.mp3':'audio/mpeg', '.flac':'audio/flac', '.wav':'audio/wav',
  '.aac':'audio/aac', '.ogg':'audio/ogg', '.m4a':'audio/mp4',
  '.srt':'text/plain; charset=utf-8', '.vtt':'text/vtt; charset=utf-8'
};

// ── PLAYLIST HELPERS ──────────────────────────────────────────────────────────
function readPlaylist() {
  try { return JSON.parse(fs.readFileSync(PLAYLIST_F, 'utf8')); } catch { return []; }
}
function writePlaylist(data) {
  fs.writeFileSync(PLAYLIST_F, JSON.stringify(data, null, 2));
}

// ── FAKE REQ/RES ADAPTER (multer needs express-like API) ─────────────────────
function parseMultipart(req, res, cb) {
  // Build a minimal express-compatible layer for multer
  req.headers = req.headers || {};
  res.status = code => { res._code = code; return res; };
  res.json   = data => {
    const body = JSON.stringify(data);
    res.writeHead(res._code || 200, { 'Content-Type': 'application/json' });
    res.end(body);
  };
  upload.single('media')(req, res, cb);
}

// ── HTTP SERVER ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API: upload file ──────────────────────────────────────────────────────
  if (url === '/api/upload' && method === 'POST') {
    parseMultipart(req, res, (err) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      if (!req.file) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No file uploaded' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype
      }));
    });
    return;
  }

  // ── API: get playlist ─────────────────────────────────────────────────────
  if (url === '/api/playlist' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readPlaylist()));
    return;
  }

  // ── API: save playlist ────────────────────────────────────────────────────
  if (url === '/api/playlist' && method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try { writePlaylist(JSON.parse(body)); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }
      catch(e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(`{"error":"${e.message}"}`); }
    });
    return;
  }

  // ── API: delete file ──────────────────────────────────────────────────────
  if (url.startsWith('/api/delete/') && method === 'DELETE') {
    const fname = path.basename(url.replace('/api/delete/', ''));
    const fpath = path.join(UPLOADS_DIR, fname);
    try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }

  // ── Serve uploaded files with range support (for video seeking) ───────────
  if (url.startsWith('/uploads/')) {
    const fname = path.basename(decodeURIComponent(url));
    const fpath = path.join(UPLOADS_DIR, fname);
    if (!fs.existsSync(fpath)) { res.writeHead(404); res.end('Not found'); return; }
    const stat = fs.statSync(fpath);
    const ext  = path.extname(fname).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const parts  = range.replace(/bytes=/, '').split('-');
      const start  = parseInt(parts[0], 10);
      const end    = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime
      });
      fs.createReadStream(fpath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(fpath).pipe(res);
    }
    return;
  }

  // ── Static file server ────────────────────────────────────────────────────
  const filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  const ext      = path.extname(filePath).toLowerCase();
  const mime     = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end(err.code); return; }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🎬  BETA PLAYER v2.0 — by Surendhar S    ║');
  console.log(`║   👉  http://localhost:${PORT}                   ║`);
  console.log('║   📁  Files saved to: ./uploads/            ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
