import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Trash2, Clock, Star, Trophy, Bookmark, Flame, XCircle, PauseCircle, Save, Plus, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Game, GameStatus } from '../types/game';
import { api } from '../services/api';

interface GameDetailModalProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  onGameUpdated: (game: Game) => void;
  onGameDeleted: (id: string) => void;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  isOpen,
  onClose,
  onGameUpdated,
  onGameDeleted,
}) => {
  if (!isOpen || !game) return null;

  const [status, setStatus] = useState<GameStatus>(game.status);
  const [playtimeHours, setPlaytimeHours] = useState<number>(game.playtimeHours);
  const [currentProgress, setCurrentProgress] = useState<string>(game.currentProgress || '');
  const [dropReason, setDropReason] = useState<string>(game.dropReason || '');
  const [rating, setRating] = useState<number>(game.rating);
  const [notes, setNotes] = useState<string>(game.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setStatus(game.status);
    setPlaytimeHours(game.playtimeHours);
    setCurrentProgress(game.currentProgress || '');
    setDropReason(game.dropReason || '');
    setRating(game.rating);
    setNotes(game.notes || '');
  }, [game]);

  const handleStatusChange = (newStatus: GameStatus) => {
    setStatus(newStatus);
    if (newStatus === 'completed' && game.status !== 'completed') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const handleAddPlaytime = (hours: number) => {
    setPlaytimeHours(prev => Math.max(0, Number((prev + hours).toFixed(1))));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await api.updateGame(game.id, {
        status,
        playtimeHours: Number(playtimeHours) || 0,
        currentProgress: currentProgress.trim(),
        dropReason: status === 'dropped' ? dropReason.trim() : '',
        rating: Number(rating) || 0,
        notes: notes.trim(),
      });
      onGameUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update game:', err);
      alert('Gagal menyimpan perubahan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Yakin ingin menghapus game "${game.title}" dari tracker?`)) return;
    setIsDeleting(true);
    try {
      await api.deleteGame(game.id);
      onGameDeleted(game.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete game:', err);
      alert('Gagal menghapus game.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Header Image with overlay */}
        <div className="relative h-56 sm:h-64 w-full bg-slate-950 overflow-hidden">
          {game.bannerUrl ? (
            <img
              src={game.bannerUrl}
              alt="Game Banner"
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent" />

          {/* Close button top right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-slate-300 hover:text-white hover:bg-black/80 backdrop-blur-md border border-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title & Developer in Banner */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {game.genres && game.genres.map((g, i) => (
                  <span key={i} className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                    {g}
                  </span>
                ))}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {game.title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {game.developer || 'Unknown Developer'} {game.releaseDate ? `• ${game.releaseDate}` : ''}
              </p>
            </div>

            {/* Steam Store Link if steamAppId exists */}
            {game.steamAppId && (
              <a
                href={`https://store.steampowered.com/app/${game.steamAppId}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 border border-white/10 backdrop-blur-md transition-colors"
              >
                <span>Buka di Steam</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Status Bar */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Status Permainan
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'plan_to_play', label: 'Plan to Play', icon: <Bookmark className="w-4 h-4 text-indigo-400" />, activeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' },
                { id: 'playing', label: 'Playing', icon: <Flame className="w-4 h-4 text-emerald-400" />, activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
                { id: 'completed', label: 'Completed', icon: <Trophy className="w-4 h-4 text-amber-400" />, activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50' },
                { id: 'dropped', label: 'Dropped', icon: <XCircle className="w-4 h-4 text-rose-400" />, activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50' },
                { id: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-4 h-4 text-slate-400" />, activeClass: 'bg-slate-700/40 text-slate-300 border-slate-600/50' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStatusChange(s.id as GameStatus)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    status === s.id
                      ? `${s.activeClass} shadow-md`
                      : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Playtime & Rating Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Playtime Tracker */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  Jam Bermain (Hours)
                </span>
                <span className="text-lg font-extrabold text-white">{playtimeHours} jam</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={playtimeHours}
                  onChange={e => setPlaytimeHours(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/60"
                />
                <button
                  type="button"
                  onClick={() => handleAddPlaytime(1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-purple-300 border border-white/5 transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> 1h
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPlaytime(5)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-purple-300 border border-white/5 transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> 5h
                </button>
              </div>
            </div>

            {/* Rating Selector */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  Rating Pribadi (Skala 0 - 10)
                </span>
                <span className="text-lg font-extrabold text-amber-400">
                  {rating > 0 ? `${rating} / 10` : 'Belum dinilai'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={rating}
                onChange={e => setRating(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Progress Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Catatan Progress (Bab / Chapter / Boss / Milestone Saat Ini)
            </label>
            <input
              type="text"
              placeholder="Contoh: Chapter 6, Selesai side quest festival, Level 45..."
              value={currentProgress}
              onChange={e => setCurrentProgress(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {/* Dropped Reason (Prominent if dropped) */}
          {status === 'dropped' && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Alasan Game Di-drop (Kenapa Ditinggalkan?)
              </div>
              <textarea
                rows={3}
                placeholder="Tulis alasan kenapa kamu gak lanjutin game ini biar kamu inget nanti..."
                value={dropReason}
                onChange={e => setDropReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-rose-500/30 rounded-xl text-sm text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {/* Notes / Personal Review */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Review Pribadi / Catatan
            </label>
            <textarea
              rows={3}
              placeholder="Ceritakan impresi, build karakter, hal yang kamu suka atau kurang suka..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Game</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
