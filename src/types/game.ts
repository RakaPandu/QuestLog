export type GameStatus = 'plan_to_play' | 'playing' | 'completed' | 'dropped' | 'on_hold';

export interface Game {
  id: string;
  steamAppId?: string | null;
  title: string;
  status: GameStatus;
  coverUrl: string;
  bannerUrl?: string;
  genres: string[];
  releaseDate?: string;
  developer?: string;
  playtimeHours: number;
  currentProgress?: string;
  dropReason?: string;
  rating: number; // 0 - 10
  notes?: string;
  platform: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SteamSearchResult {
  id: string;
  name: string;
  tiny_image: string;
  metascore?: string;
  price?: string;
}

export interface SteamGameDetails {
  appId: string;
  title: string;
  coverUrl: string;
  bannerUrl: string;
  genres: string[];
  developer: string;
  releaseDate: string;
  description: string;
  metacritic?: number | null;
}

export interface GameStats {
  total: number;
  byStatus: {
    plan_to_play: number;
    playing: number;
    completed: number;
    dropped: number;
    on_hold: number;
  };
  totalPlaytime: number;
  completionRate: number;
}

export interface BackupSnapshot {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  gameCount: number;
}

export interface ExportBackupData {
  app: string;
  version: number;
  exportedAt: string;
  totalGames: number;
  games: Game[];
}
