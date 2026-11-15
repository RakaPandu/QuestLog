import { useState, useEffect, useMemo } from 'react';
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
      setError('Gagal terhubung ke backend server. Pastikan server aktif di port 3001.');
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
        // Tab filtering
        if (activeTab !== 'all' && game.status !== activeTab) {
          return false;
        }

        // Search filtering
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
        // default: updated
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
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        stats={stats}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
        onRefresh={loadData}
        isLoading={isLoading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition-colors"
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

        {/* Game Cards Grid */}
        {isLoading && games.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Gamepad2 className="w-12 h-12 text-purple-500/40 animate-bounce mb-3" />
            <p className="text-sm font-medium">Memuat katalog game Anda...</p>
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
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
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-3xl border border-dashed border-white/10 bg-slate-900/30 my-6">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-500/10">
              <Gamepad2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {searchQuery ? 'Tidak Ada Game yang Cocok' : 'Belum Ada Game di Kategori Ini'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              {searchQuery
                ? `Tidak ditemukan game dengan kata kunci "${searchQuery}". Coba ubah pencarian.`
                : 'Mulai catat game favoritmu, game yang ingin kamu mainkan, atau game yang sudah kamu drop.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
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
