import type { Game, SteamSearchResult, SteamGameDetails, GameStats, BackupSnapshot, ExportBackupData } from '../types/game';

const API_BASE = '/api';

export const api = {
  async getGames(): Promise<Game[]> {
    const res = await fetch(`${API_BASE}/games`);
    if (!res.ok) throw new Error('Failed to fetch games');
    return res.json();
  },

  async addGame(game: Partial<Game>): Promise<Game> {
    const res = await fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
    if (!res.ok) throw new Error('Failed to add game');
    return res.json();
  },

  async updateGame(id: string, updates: Partial<Game>): Promise<Game> {
    const res = await fetch(`${API_BASE}/games/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update game');
    return res.json();
  },

  async deleteGame(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/games/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete game');
  },

  async searchSteam(query: string): Promise<SteamSearchResult[]> {
    if (!query.trim()) return [];
    const res = await fetch(`${API_BASE}/steam/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to search Steam');
    const data = await res.json();
    return data.items || [];
  },

  async getSteamDetails(appId: string): Promise<SteamGameDetails> {
    const res = await fetch(`${API_BASE}/steam/details/${encodeURIComponent(appId)}`);
    if (!res.ok) throw new Error('Failed to fetch Steam game details');
    return res.json();
  },

  async getStats(): Promise<GameStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async exportBackup(): Promise<ExportBackupData> {
    const res = await fetch(`${API_BASE}/backup/export`);
    if (!res.ok) throw new Error('Failed to export backup');
    return res.json();
  },

  async importBackup(games: any[], mode: 'replace' | 'merge' = 'replace'): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games, mode }),
    });
    if (!res.ok) throw new Error('Failed to import backup');
    return res.json();
  },

  async getSnapshots(): Promise<BackupSnapshot[]> {
    const res = await fetch(`${API_BASE}/backup/snapshots`);
    if (!res.ok) throw new Error('Failed to fetch backup snapshots');
    const data = await res.json();
    return data.snapshots || [];
  },

  async restoreSnapshot(filename: string): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/backup/restore-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (!res.ok) throw new Error('Failed to restore snapshot');
    return res.json();
  },
};
