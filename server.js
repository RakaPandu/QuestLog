import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import net from 'node:net';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

// Force IPv4 first on Windows to avoid 25-30s IPv6 connection stalls to Google APIs
dns.setDefaultResultOrder('ipv4first');
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

// Prevent SDK internal 60-second retry loops on 503 High Demand / 429 Free Tier / Timeout so we can fast-fallback immediately
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const urlStr = String(url);
  if (urlStr.includes('generativelanguage.googleapis.com')) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await nativeFetch(url, {
        ...init,
        signal: init.signal || controller.signal,
      });
      if (res.status === 503 || res.status === 429) {
        const bodyText = await res.text();
        return new Response(bodyText, {
          status: 422, // Non-retryable by Speakeasy so fallback triggers immediately
          statusText: res.statusText,
          headers: res.headers,
        });
      }
      return res;
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: err?.message || 'Request timeout or network error', code: 'timeout' } }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return nativeFetch(url, init);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'games.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const IMG_CACHE_DIR = path.join(DATA_DIR, 'imgcache');
const DIST_DIR = path.join(__dirname, 'dist');

// Ensure data, backup & imgcache directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(IMG_CACHE_DIR)) {
  fs.mkdirSync(IMG_CACHE_DIR, { recursive: true });
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

// Config helpers (stores local settings & Gemini API key, gitignored)
function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { geminiApiKey: '', geminiModel: 'gemini-4-hydrogen', steamPath: '' };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { geminiApiKey: '', geminiModel: 'gemini-4-hydrogen', steamPath: '' };
  }
}

function writeConfig(newCfg) {
  const current = readConfig();
  const merged = { ...current, ...newCfg };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

function resolveGeminiApiKey(overrideKey) {
  if (overrideKey && overrideKey.trim()) return overrideKey.trim();
  const cfg = readConfig();
  if (cfg.geminiApiKey && cfg.geminiApiKey.trim()) return cfg.geminiApiKey.trim();
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

const MODEL_ROTATION_POOL = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-4-hydrogen',
  'gemini-4-neon',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
];

// Tracks quota/rate-limit cooldown per model: modelId -> { cooldownUntil: number, status: string, reason: string }
const modelQuotaState = {};

function resolveGeminiModel(overrideModel) {
  if (overrideModel && MODEL_ROTATION_POOL.includes(overrideModel)) return overrideModel;
  const cfg = readConfig();
  if (cfg.geminiModel && MODEL_ROTATION_POOL.includes(cfg.geminiModel)) return cfg.geminiModel;
  return 'gemini-3.1-flash-lite';
}

function isModelAvailableNow(modelId) {
  const st = modelQuotaState[modelId];
  if (!st) return true;
  if (Date.now() >= st.cooldownUntil) {
    delete modelQuotaState[modelId];
    return true;
  }
  return false;
}

function recordModelQuotaFailure(modelId, errMessage = '') {
  const msg = String(errMessage);
  let cooldownMs = 60 * 1000; // Default 60s cooldown for per-minute RPM/TPM limit
  let status = 'rate_limited';

  if (msg.includes('limit: 0') || msg.includes('not found') || msg.includes('not supported')) {
    cooldownMs = 60 * 60 * 1000; // 1 hour cooldown for models with 0 free-tier quota
    status = 'zero_quota';
  } else if (msg.toLowerCase().includes('perday') || msg.toLowerCase().includes('daily') || msg.toLowerCase().includes('quota exceeded')) {
    cooldownMs = 15 * 60 * 1000; // 15 min cooldown for daily quota
    status = 'quota_exhausted';
  } else if (msg.includes('high demand') || msg.includes('service_unavailable') || msg.includes('timeout')) {
    cooldownMs = 45 * 1000; // 45s cooldown for 503 high demand
    status = 'high_demand';
  }

  modelQuotaState[modelId] = {
    cooldownUntil: Date.now() + cooldownMs,
    status,
    reason: msg.slice(0, 140),
  };
}

// Fast Interaction Runner with automatic quota/rate-limit rotation across available models
async function createInteractionFast(apiKey, preferredModel, baseOptions) {
  const client = new GoogleGenAI({ apiKey });
  const allOrdered = Array.from(new Set([preferredModel, ...MODEL_ROTATION_POOL]));

  // Put currently available (non-cooldown) models first, and cooldown models at the end as last resort
  const healthy = allOrdered.filter(m => isModelAvailableNow(m));
  const onCooldown = allOrdered.filter(m => !isModelAvailableNow(m));
  const candidates = [...healthy, ...onCooldown];

  let lastError = null;
  for (const candidateModel of candidates) {
    try {
      const reqPayload = {
        ...baseOptions,
        model: candidateModel,
      };
      if (!candidateModel.startsWith('gemma-')) {
        const thinkingLevel = candidateModel.includes('flash-lite') ? 'minimal' : 'low';
        reqPayload.generation_config = {
          thinking_level: thinkingLevel,
          ...(baseOptions.generation_config || {}),
        };
      }

      const interaction = await client.interactions.create(reqPayload);
      // Clear any previous cooldown on success
      delete modelQuotaState[candidateModel];

      // If preferredModel was rate-limited/exhausted and another model succeeded, auto-switch active model in config
      if (candidateModel !== preferredModel && !isModelAvailableNow(preferredModel)) {
        writeConfig({ geminiModel: candidateModel });
      }

      return {
        interaction,
        usedModel: candidateModel,
        fellBack: candidateModel !== preferredModel,
      };
    } catch (err) {
      lastError = err;
      recordModelQuotaFailure(candidateModel, err?.message || String(err));
      console.warn(`[Gemini Auto-Rotate] Model ${candidateModel} limit/busy (${err?.message?.slice(0, 90)}), switching to next available model...`);
    }
  }
  throw lastError || new Error('Semua model Gemini sedang mencapai limit kuota. Silakan coba beberapa saat lagi.');
}

// Local Steam Library Scanner
function detectSteamRoot() {
  const cfg = readConfig();
  if (cfg.steamPath && fs.existsSync(cfg.steamPath)) {
    return cfg.steamPath;
  }

  try {
    const out = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/\//g, path.sep);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {}

  const fallbacks = [
    'D:\\#games\\steam',
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'E:\\Steam',
  ];
  for (const fb of fallbacks) {
    if (fs.existsSync(fb)) return fb;
  }
  return null;
}

function readLocalPlaytimes(steamRoot) {
  const playtimes = {}; // appId -> { minutes, lastPlayed }
  if (!steamRoot) return playtimes;
  const userdataDir = path.join(steamRoot, 'userdata');
  if (!fs.existsSync(userdataDir)) return playtimes;

  try {
    const userDirs = fs.readdirSync(userdataDir);
    for (const u of userDirs) {
      const localConfigPath = path.join(userdataDir, u, 'config', 'localconfig.vdf');
      if (!fs.existsSync(localConfigPath)) continue;

      const content = fs.readFileSync(localConfigPath, 'utf-8');
      const appBlockRegex = /"(\d{3,10})"\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      let match;
      while ((match = appBlockRegex.exec(content)) !== null) {
        const appId = match[1];
        const body = match[2];
        const ptMatch = body.match(/"Playtime"\s+"(\d+)"/i);
        const lpMatch = body.match(/"LastPlayed"\s+"(\d+)"/i);
        if (ptMatch || lpMatch) {
          const mins = ptMatch ? Number(ptMatch[1]) : 0;
          const lp = lpMatch ? Number(lpMatch[1]) : 0;
          if (!playtimes[appId] || mins > playtimes[appId].minutes) {
            playtimes[appId] = { minutes: mins, lastPlayed: lp };
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading localconfig.vdf:', err);
  }
  return playtimes;
}

// Automatically syncs playtimeHours and local metadata (genres, developer, releaseDate) from local Steam cache
function syncPlaytimeFromLocalSteam() {
  try {
    const steamRoot = detectSteamRoot();
    if (!steamRoot) return { updatedCount: 0 };

    const playtimes = readLocalPlaytimes(steamRoot);
    const appInfoMap = parseLocalAppInfoVdf(steamRoot);
    const games = readGames();
    let updatedCount = 0;

    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      if (!g.steamAppId) continue;
      let changed = false;

      const pt = playtimes[String(g.steamAppId)];
      if (pt) {
        const steamHours = Math.round((pt.minutes / 60) * 10) / 10;
        if (steamHours > 0 && steamHours !== Number(g.playtimeHours)) {
          g.playtimeHours = steamHours;
          if (!g.currentProgress || g.currentProgress.includes('jam tercatat di Steam')) {
            g.currentProgress = `${steamHours} jam tercatat di Steam`;
          }
          changed = true;
        }
      }

      const info = appInfoMap.get(String(g.steamAppId));
      if (info) {
        const hasPlaceholderGenres =
          !Array.isArray(g.genres) ||
          g.genres.length === 0 ||
          g.genres.every(x => x === 'Steam Library' || x === 'Steam Installed');
        if (hasPlaceholderGenres && info.genres && info.genres.length > 0) {
          g.genres = info.genres;
          changed = true;
        }
        const hasPlaceholderDev =
          !g.developer ||
          g.developer === 'Steam Library (Belum Terinstall)' ||
          g.developer === 'Steam Installed';
        if (hasPlaceholderDev && info.developer) {
          g.developer = info.developer;
          changed = true;
        }
        if (!g.releaseDate && info.releaseDate) {
          g.releaseDate = info.releaseDate;
          changed = true;
        }
      }

      if (changed) updatedCount++;
    }

    if (updatedCount > 0) {
      writeGames(games);
    }
    return { updatedCount, games };
  } catch (err) {
    console.error('Error syncing Steam playtime:', err);
    return { updatedCount: 0, games: readGames() };
  }
}

const STEAM_GENRE_MAP = {
  '1': 'Action',
  '2': 'Strategy',
  '3': 'RPG',
  '4': 'Casual',
  '9': 'Racing',
  '18': 'Sports',
  '23': 'Indie',
  '25': 'Adventure',
  '28': 'Simulation',
  '29': 'MMO',
  '37': 'Free to Play',
  '70': 'Early Access',
};

const STEAM_TAG_MAP = {
  '19': 'Action',
  '21': 'Adventure',
  '122': 'RPG',
  '9': 'Strategy',
  '597': 'Casual',
  '599': 'Simulation',
  '492': 'Indie',
  '699': 'Racing',
  '701': 'Sports',
  '128': 'MMO',
  '1663': 'FPS',
  '1664': 'Puzzle',
  '1667': 'Horror',
  '1695': 'Open World',
  '1716': 'Roguelike',
  '3959': 'Roguelite',
  '29481': 'Souls-like',
  '1742': 'Story Rich',
  '3942': 'Sci-Fi',
  '1684': 'Fantasy',
  '1774': 'Shooter',
  '1625': 'Platformer',
  '1662': 'Survival',
  '1677': 'Turn-Based',
  '1720': 'Dungeon Crawler',
  '1646': 'Hack & Slash',
  '3810': 'Sandbox',
  '1676': 'RTS',
  '1708': 'Tactical',
  '3834': 'Exploration',
  '1685': 'Co-op',
  '3859': 'Multiplayer',
  '4182': 'Singleplayer',
  '113': 'Free to Play',
};

// Fast binary VDF v29 parser for appcache/appinfo.vdf (resolves titles, types, genres, developer & releaseDate in ~15ms)
let cachedAppInfoMap = null;
let cachedAppInfoMtime = 0;

function parseLocalAppInfoVdf(steamRoot) {
  const appInfoPath = path.join(steamRoot, 'appcache', 'appinfo.vdf');
  if (!fs.existsSync(appInfoPath)) return new Map();

  try {
    const stat = fs.statSync(appInfoPath);
    if (cachedAppInfoMap && stat.mtimeMs === cachedAppInfoMtime) {
      return cachedAppInfoMap;
    }

    const buf = fs.readFileSync(appInfoPath);
    const strTableOffset = Number(buf.readBigInt64LE(8));
    if (strTableOffset <= 16 || strTableOffset >= buf.length) return new Map();

    const strCount = buf.readUInt32LE(strTableOffset);
    const strings = [];
    let p = strTableOffset + 4;
    for (let i = 0; i < strCount; i++) {
      let end = p;
      while (end < buf.length && buf[end] !== 0) end++;
      strings.push(buf.toString('utf8', p, end));
      p = end + 1;
    }

    const parseVdfNode = (offset, limit) => {
      const obj = {};
      let cur = offset;
      while (cur < limit) {
        const type = buf[cur++];
        if (type === 0x08) break;
        if (cur + 4 > limit) break;
        const keyIdx = buf.readUInt32LE(cur);
        cur += 4;
        const key = strings[keyIdx] || `key_${keyIdx}`;
        if (type === 0x00) {
          const res = parseVdfNode(cur, limit);
          obj[key] = res.node;
          cur = res.pos;
        } else if (type === 0x01) {
          let end = cur;
          while (end < limit && buf[end] !== 0) end++;
          obj[key] = buf.toString('utf8', cur, end);
          cur = end + 1;
        } else if (type === 0x02) {
          if (cur + 4 > limit) break;
          obj[key] = buf.readInt32LE(cur);
          cur += 4;
        } else if (type === 0x07) {
          if (cur + 8 > limit) break;
          obj[key] = Number(buf.readBigUInt64LE(cur));
          cur += 8;
        } else {
          break;
        }
      }
      return { node: obj, pos: cur };
    };

    const map = new Map();
    let pos = 16;
    while (pos < strTableOffset - 68) {
      const appId = buf.readUInt32LE(pos);
      const size = buf.readUInt32LE(pos + 4);
      if (appId === 0 || size <= 0 || pos + 8 + size > strTableOffset) break;

      const recordStart = pos + 68;
      const recordEnd = pos + 8 + size;
      const { node } = parseVdfNode(recordStart, recordEnd);
      const common = node?.appinfo?.common;
      const extended = node?.appinfo?.extended;

      const title = common?.name ? String(common.name) : '';
      const appType = common?.type ? String(common.type).toLowerCase() : '';

      if (title) {
        const genreSet = new Set();
        let hasFreeToPlay = false;

        const rawGenres = common?.genres ? Object.values(common.genres) : [];
        if (common?.primary_genre && !rawGenres.includes(common.primary_genre)) {
          rawGenres.unshift(common.primary_genre);
        }
        for (const gid of rawGenres) {
          const label = STEAM_GENRE_MAP[String(gid)];
          if (label === 'Free to Play') {
            hasFreeToPlay = true;
          } else if (label) {
            genreSet.add(label);
          }
        }

        const rawTags = common?.store_tags ? Object.values(common.store_tags) : [];
        for (const tid of rawTags) {
          if (genreSet.size >= 4) break;
          const label = STEAM_TAG_MAP[String(tid)];
          if (label === 'Free to Play') {
            hasFreeToPlay = true;
          } else if (label) {
            genreSet.add(label);
          }
        }

        if (hasFreeToPlay && genreSet.size < 4) {
          genreSet.add('Free to Play');
        }

        let developer = extended?.developer ? String(extended.developer).trim() : '';
        if (!developer && common?.associations && typeof common.associations === 'object') {
          for (const assoc of Object.values(common.associations)) {
            if (assoc?.type === 'developer' && assoc?.name) {
              developer = String(assoc.name).trim();
              break;
            }
          }
        }
        if (!developer && extended?.publisher) {
          developer = String(extended.publisher).trim();
        }

        let releaseDate = '';
        const relTs = Number(common?.steam_release_date || common?.original_release_date || 0);
        if (relTs > 31536000) {
          try {
            releaseDate = new Date(relTs * 1000).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
          } catch {}
        }

        map.set(String(appId), {
          title,
          type: appType,
          genres: Array.from(genreSet).slice(0, 4),
          developer,
          releaseDate,
        });
      }
      pos += 8 + size;
    }

    cachedAppInfoMap = map;
    cachedAppInfoMtime = stat.mtimeMs;
    return map;
  } catch {
    return new Map();
  }
}

// Read all Steam library games registered in config/stplug-in/*.lua (includes uninstalled library games)
function readLocalStPluginLibrary(steamRoot) {
  const luaMap = new Map(); // appId -> title
  const stDir = path.join(steamRoot, 'config', 'stplug-in');
  if (!fs.existsSync(stDir)) return luaMap;

  try {
    const files = fs.readdirSync(stDir).filter(f => f.endsWith('.lua'));
    for (const f of files) {
      const mFile = f.match(/^(\d+)_(.+)\.lua$/);
      const raw = fs.readFileSync(path.join(stDir, f), 'utf-8');
      const mHeader = raw.match(/--\s*Game:\s*(.+?)\s*\(AppID:\s*(\d+)\)/i);

      if (mHeader) {
        const id = mHeader[2];
        const name = mHeader[1].trim();
        if (!name.startsWith('App_') && !name.startsWith('App ')) {
          luaMap.set(id, name);
        } else if (!luaMap.has(id)) {
          luaMap.set(id, name);
        }
      } else if (mFile) {
        const id = mFile[1];
        const name = mFile[2].replace(/_/g, ' ');
        if (!luaMap.has(id) || luaMap.get(id).startsWith('App')) {
          luaMap.set(id, name);
        }
      } else {
        const mId = f.match(/^(\d+)\.lua$/);
        if (mId && !luaMap.has(mId[1])) {
          luaMap.set(mId[1], `App ${mId[1]}`);
        }
      }
    }
  } catch {}
  return luaMap;
}

function isNonGameToolTitle(appId, title = '', appType = '') {
  if (appId === '228980' || appId === '7' || appId === '8' || appId === '480') return true;
  if (appType && appType !== 'game' && appType !== '') return true;
  const lower = title.toLowerCase();
  const excludedKeywords = [
    'steamworks common redistributables',
    'dedicated server',
    'source sdk',
    'proton ',
    'steam linux runtime',
    'steamvr',
    'soundtrack',
    'artbook',
    'wallpapers',
    'winui2',
    'steam client',
  ];
  return excludedKeywords.some(k => lower.includes(k));
}

function scanLocalSteamLibrary() {
  const steamRoot = detectSteamRoot();
  if (!steamRoot) {
    return { found: false, steamRoot: null, games: [] };
  }

  const playtimes = readLocalPlaytimes(steamRoot);
  const appInfoMap = parseLocalAppInfoVdf(steamRoot);
  const stPluginMap = readLocalStPluginLibrary(steamRoot);
  const libraryDirs = new Set([path.join(steamRoot, 'steamapps')]);

  const vdfPath = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
  if (fs.existsSync(vdfPath)) {
    try {
      const vdf = fs.readFileSync(vdfPath, 'utf-8');
      const pathMatches = vdf.matchAll(/"path"\s+"([^"]+)"/gi);
      for (const m of pathMatches) {
        const libPath = path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps');
        if (fs.existsSync(libPath)) libraryDirs.add(libPath);
      }
    } catch {}
  }

  const existingGames = readGames();
  const discoveredMap = new Map(); // appId -> game object

  const addDiscoveredGame = (appId, rawTitle, isInstalled, acfLastPlayed = 0) => {
    if (!appId || discoveredMap.has(appId)) return;
    const info = appInfoMap.get(appId);
    let title = rawTitle;
    if ((!title || title.startsWith('App ') || title.startsWith('App_')) && info?.title) {
      title = info.title;
    }
    if (!title) return;
    if (isNonGameToolTitle(appId, title, info?.type || '')) return;

    const ptData = playtimes[appId] || { minutes: 0, lastPlayed: 0 };
    const lastPlayedTs = Math.max(ptData.lastPlayed || 0, acfLastPlayed);
    const playtimeHours = Math.round((ptData.minutes / 60) * 10) / 10;

    const alreadyInLibrary = existingGames.some(
      g => (g.steamAppId && String(g.steamAppId) === String(appId)) || g.title.toLowerCase() === title.toLowerCase()
    );

    let suggestedStatus = 'plan_to_play';
    if (playtimeHours > 0) {
      suggestedStatus = 'playing';
    }

    const localCover = findLocalSteamImageFile(appId, 'cover', steamRoot);
    const localBanner = findLocalSteamImageFile(appId, 'banner', steamRoot);
    const steamCdn = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}`;

    discoveredMap.set(appId, {
      steamAppId: appId,
      title,
      isInstalled,
      playtimeHours,
      lastPlayed: lastPlayedTs > 0 ? new Date(lastPlayedTs * 1000).toISOString() : null,
      coverUrl: localCover ? `/api/steam/local-image/${appId}/cover` : `${steamCdn}/library_600x900.jpg`,
      bannerUrl: localBanner ? `/api/steam/local-image/${appId}/banner` : `${steamCdn}/header.jpg`,
      genres: info?.genres?.length ? info.genres : [],
      developer: info?.developer || '',
      releaseDate: info?.releaseDate || '',
      suggestedStatus,
      alreadyInLibrary,
    });
  };

  // 1. Scan installed games from steamapps/appmanifest_*.acf
  for (const steamappsDir of libraryDirs) {
    if (!fs.existsSync(steamappsDir)) continue;
    const files = fs.readdirSync(steamappsDir).filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(steamappsDir, file), 'utf-8');
        const appIdMatch = raw.match(/"appid"\s+"(\d+)"/i);
        const nameMatch = raw.match(/"name"\s+"([^"]+)"/i);
        const lastPlayedMatch = raw.match(/"LastPlayed"\s+"(\d+)"/i);
        if (!appIdMatch || !nameMatch) continue;
        addDiscoveredGame(
          appIdMatch[1],
          nameMatch[1],
          true,
          lastPlayedMatch ? Number(lastPlayedMatch[1]) : 0
        );
      } catch {}
    }
  }

  // 2. Scan uninstalled Steam Library games from config/stplug-in/*.lua
  for (const [appId, luaTitle] of stPluginMap.entries()) {
    addDiscoveredGame(appId, luaTitle, false, 0);
  }

  // 3. Scan owned/cached Steam Library games from appcache/librarycache + localconfig.vdf that have titles in appinfo.vdf
  const cacheDir = path.join(steamRoot, 'appcache', 'librarycache');
  if (fs.existsSync(cacheDir)) {
    try {
      const dirs = fs.readdirSync(cacheDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory() && /^\d+$/.test(d.name)) {
          const appId = d.name;
          const info = appInfoMap.get(appId);
          // Include if it is a known game in appinfo.vdf with cached library assets
          if (info && info.type === 'game') {
            addDiscoveredGame(appId, info.title, false, 0);
          }
        }
      }
    } catch {}
  }

  // 4. Scan userdata/<userId>/config/librarycache/*.json for owned games with cached metadata
  const userdataDir = path.join(steamRoot, 'userdata');
  if (fs.existsSync(userdataDir)) {
    try {
      for (const u of fs.readdirSync(userdataDir)) {
        const userCacheDir = path.join(userdataDir, u, 'config', 'librarycache');
        if (!fs.existsSync(userCacheDir)) continue;
        for (const f of fs.readdirSync(userCacheDir)) {
          const m = f.match(/^(\d+)\.json$/);
          if (!m || m[1] === '0') continue;
          const appId = m[1];
          const info = appInfoMap.get(appId);
          if (info && info.type === 'game') {
            addDiscoveredGame(appId, info.title, false, 0);
          }
        }
      }
    } catch {}
  }

  // Also check any game with playtime in localconfig.vdf that has a title in appinfo.vdf
  for (const appId of Object.keys(playtimes)) {
    const info = appInfoMap.get(appId);
    if (info && info.type === 'game') {
      addDiscoveredGame(appId, info.title, false, 0);
    }
  }

  const discovered = Array.from(discoveredMap.values());
  discovered.sort((a, b) => {
    if (a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1;
    return b.playtimeHours - a.playtimeHours || a.title.localeCompare(b.title);
  });

  const installedCount = discovered.filter(g => g.isInstalled).length;
  const uninstalledCount = discovered.length - installedCount;

  return {
    found: true,
    steamRoot,
    totalFound: discovered.length,
    installedCount,
    uninstalledCount,
    games: discovered,
  };
}

// Resolve local cached Steam image (supports both legacy library_600x900.jpg and new SHA1-hashed folders)
function findLocalSteamImageFile(appId, type = 'cover', customSteamRoot = null) {
  if (!appId) return null;
  const steamRoot = customSteamRoot || detectSteamRoot();
  if (!steamRoot) return null;

  const subDir = path.join(steamRoot, 'appcache', 'librarycache', String(appId));
  if (!fs.existsSync(subDir)) return null;

  try {
    const entries = fs.readdirSync(subDir, { withFileTypes: true });
    const subDirs = entries.filter(e => e.isDirectory()).map(e => path.join(subDir, e.name));

    if (type === 'cover') {
      const direct600 = path.join(subDir, 'library_600x900.jpg');
      if (fs.existsSync(direct600)) return direct600;
      for (const d of subDirs) {
        if (fs.existsSync(path.join(d, 'library_capsule.jpg'))) return path.join(d, 'library_capsule.jpg');
        if (fs.existsSync(path.join(d, 'library_600x900.jpg'))) return path.join(d, 'library_600x900.jpg');
      }
      const directHeader = path.join(subDir, 'library_header.jpg');
      if (fs.existsSync(directHeader)) return directHeader;
      if (fs.existsSync(path.join(subDir, 'header.jpg'))) return path.join(subDir, 'header.jpg');
      for (const d of subDirs) {
        if (fs.existsSync(path.join(d, 'library_header.jpg'))) return path.join(d, 'library_header.jpg');
        if (fs.existsSync(path.join(d, 'header.jpg'))) return path.join(d, 'header.jpg');
      }
    } else {
      const directHeader = path.join(subDir, 'header.jpg');
      const directLibHeader = path.join(subDir, 'library_header.jpg');
      if (fs.existsSync(directHeader)) return directHeader;
      if (fs.existsSync(directLibHeader)) return directLibHeader;
      for (const d of subDirs) {
        if (fs.existsSync(path.join(d, 'library_header.jpg'))) return path.join(d, 'library_header.jpg');
        if (fs.existsSync(path.join(d, 'header.jpg'))) return path.join(d, 'header.jpg');
      }
      const directHero = path.join(subDir, 'library_hero.jpg');
      if (fs.existsSync(directHero)) return directHero;
      for (const d of subDirs) {
        if (fs.existsSync(path.join(d, 'library_hero.jpg'))) return path.join(d, 'library_hero.jpg');
      }
      const direct600 = path.join(subDir, 'library_600x900.jpg');
      if (fs.existsSync(direct600)) return direct600;
      for (const d of subDirs) {
        if (fs.existsSync(path.join(d, 'library_capsule.jpg'))) return path.join(d, 'library_capsule.jpg');
      }
    }

    const anyImg = entries.find(
      e => e.isFile() && (e.name.endsWith('.jpg') || e.name.endsWith('.png')) && !e.name.includes('blur') && !e.name.includes('logo')
    );
    return anyImg ? path.join(subDir, anyImg.name) : null;
  } catch {
    return null;
  }
}

// Compute smart image positioning & aspect-ratio fit using Sharp visual entropy/attention analysis
async function computeSmartFramingWithSharp(coverPath, bannerPath) {
  let coverFit = 'cover';
  let coverPosition = '50% 35%';
  let bannerPosition = '50% 25%';

  try {
    if (coverPath && fs.existsSync(coverPath)) {
      const meta = await sharp(coverPath).metadata();
      if (meta.width && meta.height) {
        const ratio = meta.width / meta.height;
        if (ratio > 1.15) {
          // Landscape image used as cover (e.g. 460x215 header): use contain-blur so it's never cropped
          coverFit = 'contain-blur';
          coverPosition = '50% 50%';
        } else {
          coverFit = 'cover';
          // Sample 3 vertical bands (top, upper-mid, center) to find highest visual contrast/detail
          const h3 = Math.max(10, Math.floor(meta.height / 3));
          const [topStats, midStats] = await Promise.all([
            sharp(coverPath).extract({ left: 0, top: 0, width: meta.width, height: h3 }).stats(),
            sharp(coverPath).extract({ left: 0, top: h3, width: meta.width, height: h3 }).stats(),
          ]);
          const topEnergy = topStats.entropy || topStats.channels.reduce((s, c) => s + c.stdev, 0);
          const midEnergy = midStats.entropy || midStats.channels.reduce((s, c) => s + c.stdev, 0);
          coverPosition = topEnergy > midEnergy * 1.05 ? '50% 22%' : '50% 38%';
        }
      }
    }
    if (bannerPath && fs.existsSync(bannerPath)) {
      const meta = await sharp(bannerPath).metadata();
      if (meta.width && meta.height) {
        const h3 = Math.max(10, Math.floor(meta.height / 3));
        const [topStats, midStats] = await Promise.all([
          sharp(bannerPath).extract({ left: 0, top: 0, width: meta.width, height: h3 }).stats(),
          sharp(bannerPath).extract({ left: 0, top: h3, width: meta.width, height: h3 }).stats(),
        ]);
        const topEnergy = topStats.entropy || topStats.channels.reduce((s, c) => s + c.stdev, 0);
        const midEnergy = midStats.entropy || midStats.channels.reduce((s, c) => s + c.stdev, 0);
        bannerPosition = topEnergy > midEnergy ? '50% 20%' : '50% 35%';
      }
    }
  } catch {}

  return { coverFit, coverPosition, bannerPosition };
}

// Auto-repair existing games in games.json to use local cached images + smart framing
async function autoRepairLibraryImages() {
  try {
    const games = readGames();
    if (games.length === 0) return { repairedCount: 0, total: 0 };

    const steamRoot = detectSteamRoot();
    let repairedCount = 0;

    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      if (!g.steamAppId) continue;

      const localCover = findLocalSteamImageFile(g.steamAppId, 'cover', steamRoot);
      const localBanner = findLocalSteamImageFile(g.steamAppId, 'banner', steamRoot);
      let changed = false;

      if (localCover && g.coverUrl !== `/api/steam/local-image/${g.steamAppId}/cover`) {
        g.coverUrl = `/api/steam/local-image/${g.steamAppId}/cover`;
        changed = true;
      }
      if (localBanner && g.bannerUrl !== `/api/steam/local-image/${g.steamAppId}/banner`) {
        g.bannerUrl = `/api/steam/local-image/${g.steamAppId}/banner`;
        changed = true;
      }

      if (!g.coverPosition || !g.bannerPosition || !g.coverFit) {
        const framing = await computeSmartFramingWithSharp(localCover, localBanner);
        g.coverFit = g.coverFit || framing.coverFit;
        g.coverPosition = g.coverPosition || framing.coverPosition;
        g.bannerPosition = g.bannerPosition || framing.bannerPosition;
        changed = true;
      }

      if (changed) repairedCount++;
    }

    if (repairedCount > 0) {
      writeGames(games);
      console.log(`[QuestLog] Auto-repaired & smart-framed ${repairedCount}/${games.length} game images from local Steam cache.`);
    }
    return { repairedCount, total: games.length };
  } catch (err) {
    console.error('Error in autoRepairLibraryImages:', err);
    return { repairedCount: 0, total: 0 };
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
    // 1. GET /api/games (Auto-syncs latest Steam playtime on every refresh)
    if (req.method === 'GET' && pathname === '/api/games') {
      const { games } = syncPlaytimeFromLocalSteam();
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
        totalPlaytime: Math.round(totalPlaytime * 10) / 10,
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

    // 12. GET /api/steam/local-scan
    if (req.method === 'GET' && pathname === '/api/steam/local-scan') {
      const scanResult = scanLocalSteamLibrary();
      return sendJson(res, 200, scanResult);
    }

    // 13. POST /api/steam/local-import
    if (req.method === 'POST' && pathname === '/api/steam/local-import') {
      const payload = await parseBody(req);
      const itemsToImport = Array.isArray(payload.games) ? payload.games : [];
      if (itemsToImport.length === 0) {
        return sendJson(res, 400, { error: 'Tidak ada game yang dipilih untuk diimpor.' });
      }

      const currentGames = readGames();
      createSnapshot('before-local-steam-import', currentGames);

      const steamRoot = detectSteamRoot();
      const appInfoMap = steamRoot ? parseLocalAppInfoVdf(steamRoot) : new Map();

      let addedCount = 0;
      let updatedCount = 0;

      for (const item of itemsToImport) {
        const info = item.steamAppId ? appInfoMap.get(String(item.steamAppId)) : null;
        const resolvedGenres =
          Array.isArray(item.genres) && item.genres.length > 0 && !item.genres.every(x => x === 'Steam Library' || x === 'Steam Installed')
            ? item.genres
            : (info?.genres?.length ? info.genres : (item.isInstalled === false ? ['Steam Library'] : ['Steam Installed']));
        const resolvedDev =
          item.developer && item.developer !== 'Steam Library (Belum Terinstall)' && item.developer !== 'Steam Installed'
            ? item.developer
            : (info?.developer || (item.isInstalled === false ? 'Steam Library (Belum Terinstall)' : 'Steam Installed'));
        const resolvedRelease = item.releaseDate || info?.releaseDate || '';

        const existingIdx = currentGames.findIndex(
          g => (g.steamAppId && item.steamAppId && String(g.steamAppId) === String(item.steamAppId)) ||
               (g.title && item.title && g.title.toLowerCase() === item.title.toLowerCase())
        );

        if (existingIdx !== -1) {
          const ex = currentGames[existingIdx];
          const exHasPlaceholderGenres =
            !Array.isArray(ex.genres) ||
            ex.genres.length === 0 ||
            ex.genres.every(x => x === 'Steam Library' || x === 'Steam Installed');
          const exHasPlaceholderDev =
            !ex.developer ||
            ex.developer === 'Steam Library (Belum Terinstall)' ||
            ex.developer === 'Steam Installed';

          currentGames[existingIdx] = {
            ...ex,
            playtimeHours: Math.max(Number(ex.playtimeHours) || 0, Number(item.playtimeHours) || 0),
            coverUrl: ex.coverUrl || item.coverUrl || '',
            bannerUrl: ex.bannerUrl || item.bannerUrl || '',
            genres: exHasPlaceholderGenres ? resolvedGenres : ex.genres,
            developer: exHasPlaceholderDev ? resolvedDev : ex.developer,
            releaseDate: ex.releaseDate || resolvedRelease,
            updatedAt: new Date().toISOString(),
          };
          updatedCount++;
        } else {
          currentGames.unshift({
            id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            steamAppId: String(item.steamAppId || ''),
            title: item.title,
            status: item.status || item.suggestedStatus || 'plan_to_play',
            coverUrl: item.coverUrl || '',
            bannerUrl: item.bannerUrl || '',
            genres: resolvedGenres,
            releaseDate: resolvedRelease,
            developer: resolvedDev,
            playtimeHours: Number(item.playtimeHours) || 0,
            currentProgress: item.playtimeHours > 0 ? `${item.playtimeHours} jam tercatat di Steam` : '',
            dropReason: '',
            rating: 0,
            notes: item.lastPlayed ? `Terakhir dimainkan di PC: ${new Date(item.lastPlayed).toLocaleDateString('id-ID')}` : '',
            platform: 'PC (Steam)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          addedCount++;
        }
      }

      writeGames(currentGames);
      return sendJson(res, 200, {
        success: true,
        addedCount,
        updatedCount,
        totalGames: currentGames.length,
      });
    }

    // 14. GET & POST /api/gemini/config
    if (req.method === 'GET' && pathname === '/api/gemini/config') {
      const apiKey = resolveGeminiApiKey();
      const model = resolveGeminiModel();
      const modelLabels = {
        'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite (Ultra-Fast & Hemat Token - Recommended)',
        'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite (Fast 1M Context)',
        'gemini-3.8-flash': 'Gemini 3.8 Flash (Balanced Multimodal)',
        'gemini-3.7-flash': 'Gemini 3.7 Flash (Fast Reasoning)',
        'gemini-3.6-flash': 'Gemini 3.6 Flash (Stable Flash)',
        'gemini-3.5-flash': 'Gemini 3.5 Flash (General Purpose)',
        'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
        'gemini-4-hydrogen': 'Gemini 4 Hydrogen (Frontier Balanced)',
        'gemini-4-neon': 'Gemini 4 Neon (Frontier Speed)',
        'gemini-4-argon': 'Gemini 4 Argon (Interactive Reasoning)',
        'gemini-4-carbon': 'Gemini 4 Carbon (Deep Frontier Reasoning)',
        'gemma-4-26b-a4b-it': 'Gemma 4 26B MoE (Open Weights Fallback)',
        'gemma-4-31b-it': 'Gemma 4 31B Dense (Open Weights Fallback)',
      };

      const availableModels = MODEL_ROTATION_POOL.map(id => {
        const available = isModelAvailableNow(id);
        const st = modelQuotaState[id];
        const statusTag = available ? 'Ready' : `Limit/Cooldown (${st?.status || 'busy'})`;
        return {
          id,
          label: `${modelLabels[id] || id} [${statusTag}]`,
          available,
          status: available ? 'ready' : (st?.status || 'cooldown'),
        };
      });

      return sendJson(res, 200, {
        hasApiKey: Boolean(apiKey),
        maskedKey: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '',
        model,
        availableModels,
      });
    }

    if (req.method === 'POST' && pathname === '/api/gemini/config') {
      const payload = await parseBody(req);
      const updates = {};
      if (typeof payload.apiKey === 'string') {
        updates.geminiApiKey = payload.apiKey.trim();
      }
      if (typeof payload.model === 'string') {
        updates.geminiModel = resolveGeminiModel(payload.model);
      }
      writeConfig(updates);
      const apiKey = resolveGeminiApiKey();
      return sendJson(res, 200, {
        success: true,
        hasApiKey: Boolean(apiKey),
        maskedKey: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '',
        model: resolveGeminiModel(),
      });
    }

    // 15. POST /api/gemini/recommend (Gemini Quest Advisor - Smart Backlog Picker)
    if (req.method === 'POST' && pathname === '/api/gemini/recommend') {
      const payload = await parseBody(req);
      const apiKey = resolveGeminiApiKey(payload.apiKey);
      const model = resolveGeminiModel(payload.model);
      const mood = payload.mood || 'balanced';
      const timeAvailable = payload.timeAvailable || '1-2 jam';

      if (!apiKey) {
        return sendJson(res, 400, {
          error: 'API Key Gemini belum diatur. Masukkan GEMINI_API_KEY di panel konfigurasi Advisor.',
          needsApiKey: true,
        });
      }

      const games = readGames();
      const librarySummary = games.slice(0, 50).map(g =>
        `${g.id}|${g.title}|${g.status}|${g.playtimeHours}h|★${g.rating || 0}`
      ).join('\n');

      const prompt = `Library (${games.length} game, format id|title|status|hours|rating):
${librarySummary || '(Kosong)'}

Sesi: Mood="${mood}", Waktu="${timeAvailable}".
Pilih 3 game terbaik (utamakan dari library status playing/plan_to_play/on_hold; bila kurang dari 3, tambahkan rekomendasi Steam yang cocok). Berikan alasan ringkas (1 kalimat), target sesi sesuai waktu, matchScore (78-99), dan 1 kalimat backlogInsight dalam Bahasa Indonesia.`;

      const { interaction, usedModel, fellBack } = await createInteractionFast(apiKey, model, {
        input: prompt,
        system_instruction: 'Kurator backlog game PC objektif & ringkas.',
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    gameId: { type: 'string' },
                    title: { type: 'string' },
                    statusInLibrary: { type: 'string' },
                    matchScore: { type: 'number' },
                    sessionGoal: { type: 'string' },
                    reason: { type: 'string' }
                  },
                  required: ['title', 'matchScore', 'sessionGoal', 'reason']
                }
              },
              backlogInsight: { type: 'string' }
            },
            required: ['headline', 'recommendations', 'backlogInsight']
          }
        }
      });

      let parsed = null;
      try {
        parsed = JSON.parse(interaction.output_text || '{}');
      } catch {
        parsed = {
          headline: 'Rekomendasi Sesi Bermain',
          recommendations: [],
          backlogInsight: interaction.output_text || 'Gagal memformat respons JSON.',
        };
      }

      return sendJson(res, 200, {
        interactionId: interaction.id,
        model: fellBack ? `${usedModel} (auto-fallback)` : usedModel,
        ...parsed,
      });
    }

    // 16. POST /api/gemini/chat (Stateful Multi-Turn Quest Companion)
    if (req.method === 'POST' && pathname === '/api/gemini/chat') {
      const payload = await parseBody(req);
      const apiKey = resolveGeminiApiKey(payload.apiKey);
      const model = resolveGeminiModel(payload.model);
      const userMessage = (payload.message || '').trim();
      const previousInteractionId = payload.previousInteractionId || undefined;

      if (!apiKey) {
        return sendJson(res, 400, {
          error: 'API Key Gemini belum diatur. Masukkan GEMINI_API_KEY terlebih dahulu.',
          needsApiKey: true,
        });
      }

      if (!userMessage) {
        return sendJson(res, 400, { error: 'Pesan tidak boleh kosong.' });
      }

      const games = readGames();
      const libraryContext = games.slice(0, 50).map(g =>
        `- ${g.title} [${g.status}] (${g.playtimeHours}h, ★${g.rating}/10${g.currentProgress ? `, ${g.currentProgress}` : ''}${g.dropReason ? `, Drop: ${g.dropReason}` : ''})`
      ).join('\n');

      const systemInstruction = `Kamu adalah Gemini Quest Advisor di aplikasi QuestLog. Jawab ringkas & langsung ke poin dalam Bahasa Indonesia.
Library (${games.length} game):
${libraryContext || '(Kosong)'}`;

      const reqOptions = {
        input: userMessage,
        system_instruction: systemInstruction,
      };
      if (previousInteractionId) {
        reqOptions.previous_interaction_id = previousInteractionId;
      }

      const { interaction, usedModel, fellBack } = await createInteractionFast(apiKey, model, reqOptions);
      return sendJson(res, 200, {
        interactionId: interaction.id,
        reply: interaction.output_text || '',
        model: fellBack ? `${usedModel} (auto-fallback)` : usedModel,
      });
    }

    // 17. POST /api/gemini/polish-notes (AI Progress & Review Note Polisher)
    if (req.method === 'POST' && pathname === '/api/gemini/polish-notes') {
      const payload = await parseBody(req);
      const apiKey = resolveGeminiApiKey(payload.apiKey);
      const model = resolveGeminiModel(payload.model);

      if (!apiKey) {
        return sendJson(res, 400, {
          error: 'API Key Gemini belum diatur. Buka menu Gemini Advisor untuk mengatur API Key.',
          needsApiKey: true,
        });
      }

      const { title, status, playtimeHours, currentProgress, dropReason, notes, rating } = payload;

      const prompt = `Rapikan catatan review/progress game berikut (Bahasa Indonesia, maksimal 3 kalimat padat tanpa klise AI):
Game: ${title} (${status}, ${playtimeHours || 0}h, Rating ${rating || 0}/10, Progress: ${currentProgress || '-'}${status === 'dropped' ? `, Drop: ${dropReason || '-'}` : ''})
Catatan: ${notes || '(Buat ringkasan singkat sesuai status & progress)'}`;

      const { interaction, usedModel } = await createInteractionFast(apiKey, model, {
        input: prompt,
        system_instruction: 'Penulis jurnal game pribadi yang ringkas dan natural.',
      });

      return sendJson(res, 200, {
        interactionId: interaction.id,
        polishedNotes: (interaction.output_text || '').trim(),
        model: usedModel,
      });
    }

    // 18. GET /api/steam/local-image/:appId/:type (Serves lightweight cached WebP thumbnails from local Steam librarycache)
    if (req.method === 'GET' && pathname.startsWith('/api/steam/local-image/')) {
      const parts = pathname.replace('/api/steam/local-image/', '').split('/');
      const appId = parts[0].replace(/[^0-9]/g, '');
      const imgType = parts[1] === 'banner' ? 'banner' : 'cover';

      const etag = `"ql-${appId}-${imgType}-v2"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        return res.end();
      }

      const cachedWebp = path.join(IMG_CACHE_DIR, `${appId}_${imgType}.webp`);
      if (fs.existsSync(cachedWebp)) {
        const buf = fs.readFileSync(cachedWebp);
        res.writeHead(200, {
          'Content-Type': 'image/webp',
          'ETag': etag,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        });
        return res.end(buf);
      }

      const localFile = findLocalSteamImageFile(appId, imgType);
      if (localFile && fs.existsSync(localFile)) {
        try {
          const maxW = imgType === 'banner' ? 640 : 320;
          const maxH = imgType === 'banner' ? 320 : 480;
          const webpBuf = await sharp(localFile)
            .resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          try {
            fs.writeFileSync(cachedWebp, webpBuf);
          } catch {}
          res.writeHead(200, {
            'Content-Type': 'image/webp',
            'ETag': etag,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(webpBuf);
        } catch {
          const ext = path.extname(localFile).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
          const buf = fs.readFileSync(localFile);
          res.writeHead(200, {
            'Content-Type': mime,
            'ETag': etag,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(buf);
        }
      }

      // Online fallback if not cached locally
      try {
        const apiRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}`);
        if (apiRes.ok) {
          const data = await apiRes.json();
          const headerImg = data?.[appId]?.data?.header_image;
          if (headerImg) {
            res.writeHead(302, { Location: headerImg });
            return res.end();
          }
        }
      } catch {}

      res.writeHead(404);
      return res.end('Image not found');
    }

    // 19. POST /api/games/repair-images (Bulk repair broken image URLs & auto-frame via Sharp)
    if (req.method === 'POST' && pathname === '/api/games/repair-images') {
      const result = await autoRepairLibraryImages();
      return sendJson(res, 200, { success: true, ...result });
    }

    // 20. POST /api/gemini/auto-frame/:id (Gemini Multimodal Vision AI Smart Image Framing)
    if (req.method === 'POST' && pathname.startsWith('/api/gemini/auto-frame/')) {
      const gameId = decodeURIComponent(pathname.replace('/api/gemini/auto-frame/', ''));
      const games = readGames();
      const idx = games.findIndex(g => g.id === gameId);
      if (idx === -1) {
        return sendJson(res, 404, { error: 'Game tidak ditemukan' });
      }

      const game = games[idx];
      const apiKey = resolveGeminiApiKey();
      const model = resolveGeminiModel();

      // Load local image or remote image buffer
      let imgBuffer = null;
      if (game.steamAppId) {
        const localFile = findLocalSteamImageFile(game.steamAppId, 'cover');
        if (localFile && fs.existsSync(localFile)) {
          imgBuffer = fs.readFileSync(localFile);
        }
      }
      if (!imgBuffer && game.coverUrl && game.coverUrl.startsWith('http')) {
        try {
          const r = await fetch(game.coverUrl);
          if (r.ok) imgBuffer = Buffer.from(await r.arrayBuffer());
        } catch {}
      }

      if (!imgBuffer) {
        return sendJson(res, 400, { error: 'Gambar game tidak tersedia untuk dianalisis.' });
      }

      // Get image dimensions & create compact 180px thumbnail via Sharp so Vision token usage is tiny (~80 tokens)
      const meta = await sharp(imgBuffer).metadata();
      const isLandscape = meta.width && meta.height && meta.width / meta.height > 1.15;

      if (!apiKey) {
        // Fallback to Sharp attention framing if no Gemini API key
        const localCover = game.steamAppId ? findLocalSteamImageFile(game.steamAppId, 'cover') : null;
        const localBanner = game.steamAppId ? findLocalSteamImageFile(game.steamAppId, 'banner') : null;
        const sharpFraming = await computeSmartFramingWithSharp(localCover, localBanner);
        games[idx] = {
          ...game,
          ...sharpFraming,
          focalNote: 'Disesuaikan otomatis dengan analisis kontras visual lokal (Sharp).',
          updatedAt: new Date().toISOString(),
        };
        writeGames(games);
        return sendJson(res, 200, { game: games[idx], source: 'sharp-local' });
      }

      const thumbBuf = await sharp(imgBuffer)
        .resize({ width: 180, height: 240, fit: 'inside' })
        .jpeg({ quality: 68 })
        .toBuffer();
      const thumbB64 = thumbBuf.toString('base64');

      const { interaction, usedModel } = await createInteractionFast(apiKey, model, {
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: `Gambar artwork game "${game.title}" (resolusi asli ${meta.width}x${meta.height}, ${isLandscape ? 'landscape horizontal' : 'portrait vertikal'}).
Tentukan posisi fokus CSS object-position terbaik (format "X% Y%", misal "50% 20%" bila wajah karakter di atas, atau "50% 50%" bila di tengah) untuk:
1. coverPosition (kartu poster 2:3)
2. bannerPosition (banner lebar 16:6 di modal detail agar kepala karakter/judul tidak terpotong)
3. coverFit: gunakan "contain-blur" jika gambar asli berbentuk landscape horizontal dan akan terpotong buruk bila di-zoom paksa ke 2:3, atau "cover" jika sudah proporsional.
4. focalNote: 1 kalimat pendek Bahasa Indonesia menjelaskan titik fokus yang terdeteksi.`,
              },
              {
                type: 'image',
                data: thumbB64,
                mime_type: 'image/jpeg',
              },
            ],
          },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              coverPosition: { type: 'string' },
              bannerPosition: { type: 'string' },
              coverFit: { type: 'string', enum: ['cover', 'contain-blur'] },
              focalNote: { type: 'string' },
            },
            required: ['coverPosition', 'bannerPosition', 'coverFit', 'focalNote'],
          },
        },
      });

      let parsed = {
        coverPosition: '50% 30%',
        bannerPosition: '50% 25%',
        coverFit: isLandscape ? 'contain-blur' : 'cover',
        focalNote: 'Titik fokus disesuaikan oleh Gemini Vision.',
      };
      try {
        parsed = { ...parsed, ...JSON.parse(interaction.output_text || '{}') };
      } catch {}

      games[idx] = {
        ...game,
        coverPosition: parsed.coverPosition,
        bannerPosition: parsed.bannerPosition,
        coverFit: parsed.coverFit,
        focalNote: `${parsed.focalNote} (${usedModel})`,
        updatedAt: new Date().toISOString(),
      };
      writeGames(games);

      return sendJson(res, 200, {
        game: games[idx],
        model: usedModel,
        ...parsed,
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
  autoRepairLibraryImages();
});
