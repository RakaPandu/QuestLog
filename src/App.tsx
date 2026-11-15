import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatusTabs } from './components/StatusTabs';
import type { FilterTab, SortOption } from './components/StatusTabs';
import { GameCard } from './components/GameCard';
import { AddGameModal } from './components/AddGameModal';
import { GameDetailModal } from './components/GameDetailModal';
import { StatsModal } from './components/StatsModal';
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

  // Zoom Scale state (default 100%, clamp between 75% and 130%)
  const [zoomScale, setZoomScale] = useState<number>(() => {
    const saved = localStorage.getItem('questlog_zoom');
    return saved ? Number(saved) : 100;
  });

  const handleZoomIn = useCallback(() => {
    setZoomScale(prev => {
      const next = Math.min(130, prev + 5);
      localStorage.setItem('questlog_zoom', String(next));
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale(prev => {
      const next = Math.max(75, prev - 5);
      localStorage.setItem('questlog_zoom', String(next));
      return next;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomScale(100);
    localStorage.setItem('questlog_zoom', '100');
  }, []);

  // Keyboard shortcut listener for Ctrl + and Ctrl - and Ctrl 0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  // Apply zoom scale style
  useEffect(() => {
    // In Chromium / Edge, style.zoom provides seamless, crisp proportional scaling
    // without clipping or broken fixed positioning
    (document.documentElement.style as any).zoom = `${zoomScale}%`;
  }, [zoomScale]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
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
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col w-full overflow-x-hidden selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        stats={stats}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
        onRefresh={loadData}
        isLoading={isLoading}
        zoomScale={zoomScale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 overflow-x-hidden">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-bold transition-colors"
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
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Gamepad2 className="w-10 h-10 text-purple-500/40 animate-bounce mb-2" />
            <p className="text-xs font-medium">Memuat katalog game Anda...</p>
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
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
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 my-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 shadow-md shadow-purple-500/10">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {searchQuery ? 'Tidak Ada Game yang Cocok' : 'Belum Ada Game di Kategori Ini'}
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs mb-4">
              {searchQuery
                ? `Tidak ditemukan game dengan kata kunci "${searchQuery}". Coba ubah pencarian.`
                : 'Mulai catat game favoritmu, game yang ingin kamu mainkan, atau game yang sudah kamu drop.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-sm shadow-purple-600/30 transition-all hover:scale-[1.02]"
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
    </div>
  );
}

export default App;
