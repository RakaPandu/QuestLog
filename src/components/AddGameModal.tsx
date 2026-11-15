import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Gamepad2, Check, Bookmark, Flame, Trophy, XCircle, PauseCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#121520] border border-[#242b3d] rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#202636] bg-[#0f121a]">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-slate-300" />
            <h2 className="text-sm font-bold text-white">Tambah Game ke Tracker</h2>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Steam Search Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Cari Game di Steam:
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualMode(!isManualMode);
                  if (!isManualMode) setSearchResults([]);
                }}
                className="text-xs text-sky-400 hover:text-sky-300 underline"
              >
                {isManualMode ? 'Gunakan Steam Search' : 'Input Manual Non-Steam'}
              </button>
            </div>

            {!isManualMode ? (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Ketik judul game (contoh: Elden Ring, Hollow Knight)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#0c0e14] border border-[#22293b] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3d4b6c]"
                />
                {isSearching && (
                  <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                )}

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-[#0f121a] border border-[#262f45] rounded-md shadow-2xl z-20 divide-y divide-[#1e2436]">
                    {searchResults.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSteamGame(item)}
                        className="flex items-center gap-2.5 p-2.5 hover:bg-[#1a2130] cursor-pointer transition-colors"
                      >
                        <img
                          src={item.tiny_image}
                          alt={item.name}
                          className="w-14 h-7 object-cover rounded bg-[#090b10] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500">AppID: {item.id}</p>
                        </div>
                        {item.metascore && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-800/50">
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
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-sky-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Mengambil data cover Steam...</span>
              </div>
            )}
          </div>

          {/* Selected Game Preview or Form Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#0d1017] border border-[#1e2436]">
            {/* Cover Preview Column */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-28 aspect-[2/3] rounded-md bg-[#090a0f] border border-[#202738] overflow-hidden flex items-center justify-center relative">
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
                  <span className="text-[11px] text-slate-600 text-center px-2">Cover Steam</span>
                )}
              </div>
            </div>

            {/* Title & Metadata Inputs */}
            <div className="md:col-span-2 space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Judul Game *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Game"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#141824] border border-[#262e42] rounded-md text-xs text-white focus:outline-none focus:border-[#3d4b6c]"
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Status Game *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {[
                    { id: 'plan_to_play', label: 'Backlog', icon: <Bookmark className="w-3 h-3 text-slate-300" /> },
                    { id: 'playing', label: 'Playing', icon: <Flame className="w-3 h-3 text-emerald-400" /> },
                    { id: 'completed', label: 'Completed', icon: <Trophy className="w-3 h-3 text-amber-400" /> },
                    { id: 'dropped', label: 'Dropped', icon: <XCircle className="w-3 h-3 text-rose-400" /> },
                    { id: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-3 h-3 text-slate-400" /> },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatus(s.id as GameStatus)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        status === s.id
                          ? 'bg-[#1e2638] border-[#384666] text-white'
                          : 'bg-[#11141e] border-[#1f2538] text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.icon}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Playtime & Rating */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Jam Main</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={playtimeHours}
                    onChange={e => setPlaytimeHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-[#141824] border border-[#262e42] rounded-md text-xs text-white focus:outline-none focus:border-[#3d4b6c]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rating (0 - 10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={rating}
                    onChange={e => setRating(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-[#141824] border border-[#262e42] rounded-md text-xs text-white focus:outline-none focus:border-[#3d4b6c]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Progress Tracker Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Catatan Progress (Bab, Quest, dll.):
            </label>
            <input
              type="text"
              placeholder="Contoh: Chapter 4, Baru kalahkan Boss Radahn, Quest Utama 60%..."
              value={currentProgress}
              onChange={e => setCurrentProgress(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#22293b] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3d4b6c]"
            />
          </div>

          {/* Dropped Reason - Shows when status === 'dropped' */}
          {status === 'dropped' && (
            <div className="p-3 rounded-md bg-[#240a0e] border border-[#4d141d] space-y-1">
              <label className="block text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Alasan Di-drop (Kenapa Ditinggalkan?):
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Gameplay repetitif setelah 15 jam, kontrol kaku..."
                value={dropReason}
                onChange={e => setDropReason(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#140608] border border-[#4d141d] rounded text-xs text-white placeholder-rose-400/40 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {/* Personal Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Catatan Tambahan / Review Singkat:</label>
            <textarea
              rows={2}
              placeholder="Kesan pertama, build karakter, hal yang disukai..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#22293b] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3d4b6c]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2436]">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-white bg-[#161a26] hover:bg-[#1f2538] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
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
