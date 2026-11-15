import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Sparkles, Check, Bookmark, Flame, Trophy, XCircle, PauseCircle } from 'lucide-react';
import type { Game, GameStatus, SteamSearchResult, SteamGameDetails } from '../types/game';
import { api } from '../services/api';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameAdded: (game: Game) => void;
}

export const AddGameModal: React.FC<AddGameModalProps> = ({ isOpen, onClose, onGameAdded }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SteamSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [selectedSteamGame, setSelectedSteamGame] = useState<SteamGameDetails | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<GameStatus>('plan_to_play');
  const [coverUrl, setCoverUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [developer, setDeveloper] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [playtimeHours, setPlaytimeHours] = useState<number>(0);
  const [currentProgress, setCurrentProgress] = useState('');
  const [dropReason, setDropReason] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);

  // Debounced Steam Search
  useEffect(() => {
    if (!searchQuery.trim() || isManualMode) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchSteam(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Steam search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, isManualMode]);

  // Select Steam Game
  const handleSelectSteamGame = async (item: SteamSearchResult) => {
    setIsLoadingDetails(true);
    setSearchResults([]);
    try {
      const details = await api.getSteamDetails(item.id);
      setSelectedSteamGame(details);
      setTitle(details.title);
      setCoverUrl(details.coverUrl);
      setBannerUrl(details.bannerUrl);
      setGenres(details.genres);
      setDeveloper(details.developer);
      setReleaseDate(details.releaseDate);
    } catch (err) {
      console.error('Error fetching steam details:', err);
      setTitle(item.name);
      setCoverUrl(item.tiny_image);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const resetForm = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSteamGame(null);
    setTitle('');
    setStatus('plan_to_play');
    setCoverUrl('');
    setBannerUrl('');
    setGenres([]);
    setDeveloper('');
    setReleaseDate('');
    setPlaytimeHours(0);
    setCurrentProgress('');
    setDropReason('');
    setRating(0);
    setNotes('');
    setIsManualMode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const newGame = await api.addGame({
        steamAppId: selectedSteamGame?.appId || null,
        title: title.trim(),
        status,
        coverUrl: coverUrl.trim(),
        bannerUrl: bannerUrl.trim(),
        genres,
        developer,
        releaseDate,
        playtimeHours: Number(playtimeHours) || 0,
        currentProgress: currentProgress.trim(),
        dropReason: status === 'dropped' ? dropReason.trim() : '',
        rating: Number(rating) || 0,
        notes: notes.trim(),
        platform: selectedSteamGame ? 'PC (Steam)' : 'PC',
      });

      onGameAdded(newGame);
      resetForm();
      onClose();
    } catch (err) {
      console.error('Error adding game:', err);
      alert('Gagal menambahkan game. Pastikan server aktif.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Tambah Game ke Tracker</h2>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Steam Search Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Cari Game di Steam (Auto-Fetch Cover & Info):
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualMode(!isManualMode);
                  if (!isManualMode) setSearchResults([]);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 underline"
              >
                {isManualMode ? 'Gunakan Steam Search' : 'Atau Input Manual Non-Steam'}
              </button>
            </div>

            {!isManualMode ? (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik judul game (contoh: Elden Ring, Hollow Knight, Monster Hunter)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/60"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />
                )}

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-slate-950 border border-purple-500/30 rounded-xl shadow-2xl z-20 divide-y divide-white/5">
                    {searchResults.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSteamGame(item)}
                        className="flex items-center gap-3 p-3 hover:bg-purple-900/20 cursor-pointer transition-colors"
                      >
                        <img
                          src={item.tiny_image}
                          alt={item.name}
                          className="w-16 h-8 object-cover rounded bg-slate-800 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                          <p className="text-xs text-slate-400">Steam AppID: {item.id}</p>
                        </div>
                        {item.metascore && (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            {item.metascore}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {isLoadingDetails && (
              <div className="flex items-center gap-2 mt-2 text-xs text-purple-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mengambil cover HD dan data Steam...</span>
              </div>
            )}
          </div>

          {/* Selected Game Preview or Form Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-white/5">
            {/* Cover Preview Column */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-32 aspect-[2/3] rounded-xl bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center relative shadow-lg">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      if (bannerUrl) e.currentTarget.src = bannerUrl;
                    }}
                  />
                ) : (
                  <span className="text-xs text-slate-500 text-center px-2">Cover Preview (Steam)</span>
                )}
              </div>
            </div>

            {/* Title & Metadata Inputs */}
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Judul Game *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Game"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/60"
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status Game *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'plan_to_play', label: 'Plan to Play', icon: <Bookmark className="w-3.5 h-3.5 text-indigo-400" /> },
                    { id: 'playing', label: 'Playing', icon: <Flame className="w-3.5 h-3.5 text-emerald-400" /> },
                    { id: 'completed', label: 'Completed', icon: <Trophy className="w-3.5 h-3.5 text-amber-400" /> },
                    { id: 'dropped', label: 'Dropped', icon: <XCircle className="w-3.5 h-3.5 text-rose-400" /> },
                    { id: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-3.5 h-3.5 text-slate-400" /> },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatus(s.id as GameStatus)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        status === s.id
                          ? 'bg-purple-600/30 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.icon}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Playtime & Rating */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Jam Main (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={playtimeHours}
                    onChange={e => setPlaytimeHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rating Pribadi (0 - 10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={rating}
                    onChange={e => setRating(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Progress Tracker Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Catatan Progress Saat Ini (Chapter, Quest, dll.):
            </label>
            <input
              type="text"
              placeholder="Contoh: Chapter 4, Baru kalahkan Boss Radahn, Quest Utama 60%..."
              value={currentProgress}
              onChange={e => setCurrentProgress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {/* Dropped Reason - Highlights when status === 'dropped' */}
          {status === 'dropped' && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-400" />
                Alasan Di-drop (Kenapa gak kamu lanjutin?):
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Gameplay terlalu repetitif, kontrol kaku, story kurang menarik setelah 10 jam..."
                value={dropReason}
                onChange={e => setDropReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-rose-500/30 rounded-lg text-sm text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {/* Personal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan Tambahan / Review Singkat:</label>
            <textarea
              rows={2}
              placeholder="Kesan pertama, build karakter favorit, dll..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Game</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
