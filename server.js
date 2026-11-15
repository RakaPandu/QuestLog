import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'games.json');
const DIST_DIR = path.join(__dirname, 'dist');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data if database file does not exist
const INITIAL_GAMES = [
  {
    id: "steam_1245620",
    steamAppId: "1245620",
    title: "ELDEN RING",
    status: "playing",
    coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg",
    bannerUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg",
    genres: ["Action", "RPG", "Open World"],
    releaseDate: "24 Feb, 2022",
    developer: "FromSoftware Inc.",
    playtimeHours: 64,
    currentProgress: "Exploring Altus Plateau & Volcano Manor",
    dropReason: "",
    rating: 9.5,
    notes: "Build: Dex/Arcane with Rivers of Blood & Bloodhound's Step. Bosses defeated: Margit, Godrick, Renalla, Radahn.",
    platform: "PC (Steam)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "steam_1091500",
    steamAppId: "1091500",
    title: "Cyberpunk 2077",
    status: "completed",
    coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900.jpg",
    bannerUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg",
    genres: ["RPG", "Open World", "Sci-Fi"],
    releaseDate: "9 Dec, 2020",
    developer: "CD PROJEKT RED",
    playtimeHours: 85,
    currentProgress: "Story completed + Phantom Liberty DLC finished (The Sun ending)",
    dropReason: "",
    rating: 9.0,
    notes: "Incredible story and night city atmosphere. Phantom Liberty ending was heartbreaking.",
    platform: "PC (Steam)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "steam_2358720",
    steamAppId: "2358720",
    title: "Black Myth: Wukong",
    status: "plan_to_play",
    coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/library_600x900.jpg",
    bannerUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg",
    genres: ["Action", "RPG", "Souls-like"],
    releaseDate: "19 Aug, 2024",
    developer: "Game Science",
    playtimeHours: 0,
    currentProgress: "In Backlog - waiting for weekend marathon session",
    dropReason: "",
    rating: 0,
    notes: "Heard the combat and visual animations are mindblowing.",
    platform: "PC (Steam)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "steam_1145360",
    steamAppId: "1145360",
    title: "Hades",
    status: "dropped",
    coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900.jpg",
    bannerUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg",
    genres: ["Roguelike", "Action", "Indie"],
    releaseDate: "17 Sep, 2020",
    developer: "Supergiant Games",
    playtimeHours: 12,
    currentProgress: "Elysium - Stygian Blade runs",
    dropReason: "Format roguelike kurang cocok dengan selera saat ini, frustasi mengulang dari awal setiap mati.",
    rating: 7.5,
    notes: "Artwork dan soundtrack juara, tapi gameplay repetitif membuat bosan setelah 10 jam.",
    platform: "PC (Steam)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper to read database
function readGames() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_GAMES, null, 2), 'utf-8');
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

// Helper to write database
function writeGames(games) {
  fs.writeFileSync(DB_FILE, JSON.stringify(games, null, 2), 'utf-8');
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
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
