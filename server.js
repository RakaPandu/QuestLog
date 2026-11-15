import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'games.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DIST_DIR = path.join(__dirname, 'dist');

// Ensure data & backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Ensure initial baseline snapshot exists
try {
  const initialData = readGames();
  const snaps = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  if (snaps.length === 0 && initialData.length > 0) {
    createSnapshot('baseline', initialData);
  }
} catch {}

// Initial seed data (empty by default for user's personal tracking)
const INITIAL_GAMES = [];

// Helper to create automated snapshots
function createSnapshot(reason = 'auto', data = null) {
  try {
    const games = data || readGames();
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const filename = `snapshot_${ts}_${reason}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(games, null, 2), 'utf-8');

    // Clean up older snapshots (keep maximum 20 latest snapshots)
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    if (files.length > 20) {
      files.sort();
      const toRemove = files.slice(0, files.length - 20);
      for (const rem of toRemove) {
        fs.unlinkSync(path.join(BACKUP_DIR, rem));
      }
    }
  } catch (err) {
    console.error('Error creating snapshot:', err);
  }
}

// Helper to read database
function readGames() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_GAMES, null, 2), 'utf-8');
    createSnapshot('initial', INITIAL_GAMES);
    return INITIAL_GAMES;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading games.json, returning empty list:', err);
    return [];
  }
}

let lastSnapshotTime = 0;
// Helper to write database with automatic snapshot protection
function writeGames(games) {
  fs.writeFileSync(DB_FILE, JSON.stringify(games, null, 2), 'utf-8');

  // Throttle auto snapshot to at most once every 30 seconds
  const now = Date.now();
  if (now - lastSnapshotTime > 30000) {
    createSnapshot('auto', games);
    lastSnapshotTime = now;
  }
}

// Check valid image on Steam CDN
async function findValidImage(candidates, fallback) {
  for (const url of candidates) {
    if (!url) continue;
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      if (resp.ok) return url;
    } catch {
      // Continue to next candidate
    }
  }
  return fallback || '';
}

// Send JSON response
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Serve static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  if (!fs.existsSync(DIST_DIR)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Static dist directory not found. Please build or use Vite dev server.');
    return;
  }

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(DIST_DIR, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading file');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. GET /api/games
    if (req.method === 'GET' && pathname === '/api/games') {
      const games = readGames();
      return sendJson(res, 200, games);
    }

    // 2. POST /api/games
    if (req.method === 'POST' && pathname === '/api/games') {
      const payload = await parseBody(req);
      if (!payload.title) {
        return sendJson(res, 400, { error: 'Game title is required' });
      }

      const games = readGames();
      const newGame = {
        id: payload.id || `game_${Date.now()}`,
        steamAppId: payload.steamAppId || null,
        title: payload.title,
        status: payload.status || 'plan_to_play',
        coverUrl: payload.coverUrl || '',
        bannerUrl: payload.bannerUrl || '',
        genres: payload.genres || [],
        releaseDate: payload.releaseDate || '',
        developer: payload.developer || '',
        playtimeHours: Number(payload.playtimeHours) || 0,
        currentProgress: payload.currentProgress || '',
        dropReason: payload.dropReason || '',
        rating: Number(payload.rating) || 0,
        notes: payload.notes || '',
        platform: payload.platform || 'PC (Steam)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      games.unshift(newGame);
      writeGames(games);
      return sendJson(res, 201, newGame);
    }

    // 3. PUT /api/games/:id
    if (req.method === 'PUT' && pathname.startsWith('/api/games/')) {
      const id = decodeURIComponent(pathname.replace('/api/games/', ''));
      const payload = await parseBody(req);
      const games = readGames();
      const idx = games.findIndex(g => g.id === id);

      if (idx === -1) {
        return sendJson(res, 404, { error: 'Game not found' });
      }

      games[idx] = {
        ...games[idx],
        ...payload,
        updatedAt: new Date().toISOString(),
      };

      writeGames(games);
      return sendJson(res, 200, games[idx]);
    }

    // 4. DELETE /api/games/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/games/')) {
      const id = decodeURIComponent(pathname.replace('/api/games/', ''));
      let games = readGames();
      const initialLength = games.length;
      games = games.filter(g => g.id !== id);

      if (games.length === initialLength) {
        return sendJson(res, 404, { error: 'Game not found' });
      }

      writeGames(games);
      return sendJson(res, 200, { success: true, id });
    }

    // 5. GET /api/steam/search?q=...
    if (req.method === 'GET' && pathname === '/api/steam/search') {
      const query = parsedUrl.searchParams.get('q');
      if (!query || query.trim().length === 0) {
        return sendJson(res, 200, { items: [] });
      }

      const steamUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
      const response = await fetch(steamUrl);
      if (!response.ok) {
        return sendJson(res, 502, { error: `Steam API responded with HTTP ${response.status}` });
      }

      const data = await response.json();
      const items = (data.items || []).map(item => ({
        id: String(item.id),
        name: item.name,
        tiny_image: item.tiny_image,
        metascore: item.metascore,
        price: item.price ? (item.price.final / 100).toFixed(2) : 'Free',
      }));

      return sendJson(res, 200, { items });
    }

    // 6. GET /api/steam/details/:appId
    if (req.method === 'GET' && pathname.startsWith('/api/steam/details/')) {
      const appId = pathname.replace('/api/steam/details/', '');
      const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
      const response = await fetch(steamUrl);

      if (!response.ok) {
        return sendJson(res, 502, { error: `Steam API responded with HTTP ${response.status}` });
      }

      const data = await response.json();
      const appEntry = data[appId];

      if (!appEntry || !appEntry.success) {
        return sendJson(res, 404, { error: 'Steam game details not found' });
      }

      const details = appEntry.data;
      const steamCdn = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}`;

      const coverCandidates = [
        `${steamCdn}/library_600x900.jpg`,
        `${steamCdn}/library_600x900_2x.jpg`,
        `${steamCdn}/capsule_616x353.jpg`,
        details.header_image,
      ];

      const bannerCandidates = [
        `${steamCdn}/header.jpg`,
        details.header_image,
      ];

      const [coverUrl, bannerUrl] = await Promise.all([
        findValidImage(coverCandidates, details.header_image || ''),
        findValidImage(bannerCandidates, details.header_image || ''),
      ]);

      const genres = Array.isArray(details.genres)
        ? details.genres.map(g => g.description)
        : [];

      const developers = Array.isArray(details.developers)
        ? details.developers.join(', ')
        : (details.publishers ? details.publishers.join(', ') : 'Unknown');

      return sendJson(res, 200, {
        appId: String(details.steam_appid),
        title: details.name,
        coverUrl,
        bannerUrl,
        genres,
        developer: developers,
        releaseDate: details.release_date?.date || 'Unknown',
        description: details.short_description || '',
        metacritic: details.metacritic?.score || null,
      });
    }

    // 7. GET /api/stats
    if (req.method === 'GET' && pathname === '/api/stats') {
      const games = readGames();
      const total = games.length;
      const byStatus = {
        plan_to_play: 0,
        playing: 0,
        completed: 0,
        dropped: 0,
        on_hold: 0,
      };
      let totalPlaytime = 0;

      games.forEach(g => {
        if (byStatus[g.status] !== undefined) {
          byStatus[g.status]++;
        }
        totalPlaytime += (Number(g.playtimeHours) || 0);
      });

      const finished = byStatus.completed;
      const completionRate = total > 0 ? Math.round((finished / total) * 100) : 0;

      return sendJson(res, 200, {
        total,
        byStatus,
        totalPlaytime,
        completionRate,
      });
    }

    // 8. GET /api/backup/export
    if (req.method === 'GET' && pathname === '/api/backup/export') {
      const games = readGames();
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const backupData = {
        app: 'QuestLog',
        version: 1,
        exportedAt: d.toISOString(),
        totalGames: games.length,
        games,
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="questlog-backup-${dateStr}.json"`,
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(JSON.stringify(backupData, null, 2));
    }

    // 9. POST /api/backup/import
    if (req.method === 'POST' && pathname === '/api/backup/import') {
      const payload = await parseBody(req);
      const incomingGames = Array.isArray(payload.games) ? payload.games : (Array.isArray(payload) ? payload : null);

      if (!incomingGames) {
        return sendJson(res, 400, { error: 'Invalid backup format. Expected array of games.' });
      }

      const mode = payload.mode || 'replace'; // 'replace' or 'merge'
      const currentGames = readGames();

      // Create safety snapshot before altering data
      createSnapshot('before-import', currentGames);

      let finalGames = [];
      if (mode === 'replace') {
        finalGames = incomingGames.map((g, idx) => ({
          id: g.id || `game_${Date.now()}_${idx}`,
          steamAppId: g.steamAppId || null,
          title: g.title || 'Untitled Game',
          status: g.status || 'plan_to_play',
          coverUrl: g.coverUrl || '',
          bannerUrl: g.bannerUrl || '',
          genres: g.genres || [],
          releaseDate: g.releaseDate || '',
          developer: g.developer || '',
          playtimeHours: Number(g.playtimeHours) || 0,
          currentProgress: g.currentProgress || '',
          dropReason: g.dropReason || '',
          rating: Number(g.rating) || 0,
          notes: g.notes || '',
          platform: g.platform || 'PC',
          createdAt: g.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      } else {
        // Merge mode
        finalGames = [...currentGames];
        for (const item of incomingGames) {
          const existingIdx = finalGames.findIndex(g => 
            (g.steamAppId && item.steamAppId && String(g.steamAppId) === String(item.steamAppId)) ||
            (g.title && item.title && g.title.toLowerCase() === item.title.toLowerCase())
          );
          if (existingIdx !== -1) {
            finalGames[existingIdx] = {
              ...finalGames[existingIdx],
              ...item,
              updatedAt: new Date().toISOString(),
            };
          } else {
            finalGames.push({
              id: item.id || `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              steamAppId: item.steamAppId || null,
              title: item.title,
              status: item.status || 'plan_to_play',
              coverUrl: item.coverUrl || '',
              bannerUrl: item.bannerUrl || '',
              genres: item.genres || [],
              releaseDate: item.releaseDate || '',
              developer: item.developer || '',
              playtimeHours: Number(item.playtimeHours) || 0,
              currentProgress: item.currentProgress || '',
              dropReason: item.dropReason || '',
              rating: Number(item.rating) || 0,
              notes: item.notes || '',
              platform: item.platform || 'PC',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      writeGames(finalGames);
      return sendJson(res, 200, { success: true, count: finalGames.length, mode });
    }

    // 10. GET /api/backup/snapshots
    if (req.method === 'GET' && pathname === '/api/backup/snapshots') {
      if (!fs.existsSync(BACKUP_DIR)) {
        return sendJson(res, 200, { snapshots: [] });
      }

      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      const snapshots = files.map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        let count = 0;
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          count = Array.isArray(content) ? content.length : (content.games ? content.games.length : 0);
        } catch {}

        return {
          filename: file,
          createdAt: stats.mtime.toISOString(),
          sizeBytes: stats.size,
          gameCount: count,
        };
      });

      // Sort newest first
      snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sendJson(res, 200, { snapshots });
    }

    // 11. POST /api/backup/restore-snapshot
    if (req.method === 'POST' && pathname === '/api/backup/restore-snapshot') {
      const payload = await parseBody(req);
      const filename = payload.filename;

      if (!filename || filename.includes('..') || !filename.endsWith('.json')) {
        return sendJson(res, 400, { error: 'Invalid snapshot filename' });
      }

      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, { error: 'Snapshot not found' });
      }

      const currentGames = readGames();
      createSnapshot('before-restore', currentGames);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const restored = Array.isArray(content) ? content : (content.games ? content.games : []);

      writeGames(restored);
      return sendJson(res, 200, { success: true, count: restored.length, filename });
    }

    // Fallback: static files
    return serveStatic(req, res);
  } catch (err) {
    console.error('Server error handling request:', err);
    return sendJson(res, 500, { error: 'Internal server error', details: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`QuestLog Server running on http://localhost:${PORT}`);
});
