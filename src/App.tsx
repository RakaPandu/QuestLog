import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatusTabs } from './components/StatusTabs';
import type { FilterTab, SortOption } from './components/StatusTabs';
import { GameCard } from './components/GameCard';
import { AddGameModal } from './components/AddGameModal';
import { GameDetailModal } from './components/GameDetailModal';
import { StatsModal } from './components/StatsModal';
import { BackupModal } from './components/BackupModal';
import type { Game, GameStats, GameStatus } from './types/game';
import { api } from './services/api';
import { Gamepad2, Plus, AlertCircle } from 'lucide-react';

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Zoom Scale state (Strict range: 100% min to 125% max)
  const [zoomScale, setZoomScale] = useState<number>(() => {
    const saved = localStorage.getItem('questlog_zoom');
    const val = saved ? Number(saved) : 100;
    return Math.max(100, Math.min(125, val));
  });

  const handleZoomIn = useCallback(() => {
    setZoomScale(prev => {
      const next = Math.min(125, prev + 5);
      localStorage.setItem('questlog_zoom', String(next));
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale(prev => {
      // Mentok minimal di 100% (tidak bisa diperkecil di bawah 100%)
      const next = Math.max(100, prev - 5);
      localStorage.setItem('questlog_zoom', String(next));
      return next;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomScale(100);
    localStorage.setItem('questlog_zoom', '100');
  }, []);

  // Keyboard shortcut listener: Ctrl + and Ctrl - (Mentok min 100%, max 125%)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Prevent all browser default zoom behaviors
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          handleZoomReset();
        }
      }
    };

    // Block native Ctrl + Mouse Wheel zoom so the browser doesn't stretch or distort
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else if (e.deltaY > 0) {
          handleZoomOut();
        }
      }
    };

    // Block gesture zoom on touchpads
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('gesturestart', handleGesture);
    document.addEventListener('gesturechange', handleGesture);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
    };
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  // Apply zoom scale style to document root
  useEffect(() => {
    (document.documentElement.style as any).zoom = `${zoomScale}%`;
  }, [zoomScale]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Fetch games and stats
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [gamesData, statsData] = await Promise.all([
        api.getGames(),
        api.getStats(),
      ]);
      setGames(gamesData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('Gagal terhubung ke server backend lokal.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Dynamic counts for each status tab
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: games.length,
      playing: 0,
      plan_to_play: 0,
      completed: 0,
      dropped: 0,
      on_hold: 0,
    };
    games.forEach(g => {
      if (counts[g.status] !== undefined) {
        counts[g.status]++;
      }
    });
    return counts;
  }, [games]);

  // Filtered & Sorted Games List
  const filteredGames = useMemo(() => {
    return games
      .filter(game => {
        if (activeTab !== 'all' && game.status !== activeTab) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = game.title.toLowerCase().includes(q);
          const matchGenre = game.genres?.some(g => g.toLowerCase().includes(q));
          const matchDev = game.developer?.toLowerCase().includes(q);
          if (!matchTitle && !matchGenre && !matchDev) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'playtime') return (b.playtimeHours || 0) - (a.playtimeHours || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
  }, [games, activeTab, searchQuery, sortBy]);

  // Handlers
  const handleGameAdded = (newGame: Game) => {
    setGames(prev => [newGame, ...prev]);
    loadData();
  };

  const handleGameUpdated = (updatedGame: Game) => {
    setGames(prev => prev.map(g => (g.id === updatedGame.id ? updatedGame : g)));
    if (selectedGame && selectedGame.id === updatedGame.id) {
      setSelectedGame(updatedGame);
    }
    loadData();
  };

  const handleGameDeleted = (id: string) => {
    setGames(prev => prev.filter(g => g.id !== id));
    loadData();
  };

  const handleCardClick = (game: Game) => {
    setSelectedGame(game);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0c0e14] text-slate-100 flex flex-col w-full overflow-x-hidden selection:bg-slate-700 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        stats={stats}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onRefresh={loadData}
        isLoading={isLoading}
        zoomScale={zoomScale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-3.5 overflow-x-hidden">
        {/* Error Banner */}
        {error && (
          <div className="mb-3.5 p-2.5 rounded-md bg-[#240a0e] border border-[#4d141d] flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 text-[11px] font-medium transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Status Category Tabs & Search/Sort */}
        <StatusTabs
          currentTab={activeTab}
          onTabChange={setActiveTab}
          counts={tabCounts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Game Cards Grid - Compact & Responsive */}
        {isLoading && games.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Gamepad2 className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium">Memuat katalog game...</p>
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {filteredGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                onClick={() => handleCardClick(game)}
                onQuickStatusChange={async (newStatus: GameStatus) => {
                  try {
                    const updated = await api.updateGame(game.id, { status: newStatus });
                    handleGameUpdated(updated);
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-lg border border-dashed border-[#1f2638] bg-[#11141e]/50 my-3">
            <div className="w-10 h-10 rounded-lg bg-[#161b26] border border-[#232c40] flex items-center justify-center text-slate-400 mb-2.5">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-white mb-0.5">
              {searchQuery ? 'Tidak Ada Game yang Cocok' : 'Belum Ada Game di Kategori Ini'}
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs mb-3">
              {searchQuery
                ? `Tidak ditemukan game dengan kata kunci "${searchQuery}". Coba ubah pencarian.`
                : 'Mulai catat game favoritmu, game yang ingin kamu mainkan, atau game yang sudah kamu drop.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Game Baru</span>
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <AddGameModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onGameAdded={handleGameAdded}
      />

      <GameDetailModal
        game={selectedGame}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onGameUpdated={handleGameUpdated}
        onGameDeleted={handleGameDeleted}
      />

      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        stats={stats}
        games={games}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={loadData}
        totalGames={games.length}
      />
    </div>
  );
}

export default App;
