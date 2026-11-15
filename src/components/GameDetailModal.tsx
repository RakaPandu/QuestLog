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
        particleCount: 80,
        spread: 60,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#121520] border border-[#242b3d] rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Banner Header Image with overlay */}
        <div className="relative h-48 sm:h-52 w-full bg-[#090b10] overflow-hidden">
          {game.bannerUrl ? (
            <img
              src={game.bannerUrl}
              alt="Game Banner"
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-[#161a26]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#121520] via-[#121520]/75 to-transparent" />

          {/* Close button top right */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-md bg-black/60 text-slate-300 hover:text-white border border-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title & Developer in Banner */}
          <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {game.genres && game.genres.map((g, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    {g}
                  </span>
                ))}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
                {game.title}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {game.developer || 'Unknown Developer'} {game.releaseDate ? `• ${game.releaseDate}` : ''}
              </p>
            </div>

            {/* Steam Store Link if steamAppId exists */}
            {game.steamAppId && (
              <a
                href={`https://store.steampowered.com/app/${game.steamAppId}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c2233] hover:bg-[#252d44] text-xs font-medium text-slate-200 border border-[#2c3752] transition-colors"
              >
                <span>Halaman Steam</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Status Bar */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Status Game
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {[
                { id: 'plan_to_play', label: 'Backlog', icon: <Bookmark className="w-3.5 h-3.5 text-slate-300" />, activeClass: 'bg-[#181d2b] text-slate-200 border-[#384666]' },
                { id: 'playing', label: 'Playing', icon: <Flame className="w-3.5 h-3.5 text-emerald-400" />, activeClass: 'bg-[#06281e] text-emerald-300 border-[#0b4d3a]' },
                { id: 'completed', label: 'Completed', icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />, activeClass: 'bg-[#291804] text-amber-300 border-[#5e370a]' },
                { id: 'dropped', label: 'Dropped', icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />, activeClass: 'bg-[#2b0c10] text-rose-300 border-[#5e1923]' },
                { id: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-3.5 h-3.5 text-slate-400" />, activeClass: 'bg-[#181d26] text-slate-200 border-[#2c3445]' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStatusChange(s.id as GameStatus)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                    status === s.id
                      ? `${s.activeClass} shadow-sm`
                      : 'bg-[#0e111a] border-[#1e2436] text-slate-400 hover:text-white'
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Playtime & Rating Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Playtime Tracker */}
            <div className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Jam Bermain
                </span>
                <span className="text-sm font-bold text-white">{playtimeHours} jam</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={playtimeHours}
                  onChange={e => setPlaytimeHours(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-[#141824] border border-[#242b3d] rounded text-xs text-white focus:outline-none focus:border-[#3d4b6c]"
                />
                <button
                  type="button"
                  onClick={() => handleAddPlaytime(1)}
                  className="px-2 py-1 rounded bg-[#1c2233] hover:bg-[#252e45] text-xs font-semibold text-slate-300 border border-[#28324a] transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> 1h
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPlaytime(5)}
                  className="px-2 py-1 rounded bg-[#1c2233] hover:bg-[#252e45] text-xs font-semibold text-slate-300 border border-[#28324a] transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> 5h
                </button>
              </div>
            </div>

            {/* Rating Selector */}
            <div className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  Rating Pribadi
                </span>
                <span className="text-sm font-bold text-amber-400">
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
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Progress Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Catatan Progress (Bab / Quest / Milestone):
            </label>
            <input
              type="text"
              placeholder="Contoh: Chapter 6, Selesai side quest festival, Level 45..."
              value={currentProgress}
              onChange={e => setCurrentProgress(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0e111a] border border-[#202738] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3d4b6c]"
            />
          </div>

          {/* Dropped Reason */}
          {status === 'dropped' && (
            <div className="p-3 rounded-md bg-[#240a0e] border border-[#4d141d] space-y-1">
              <div className="flex items-center gap-1.5 text-rose-300 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Alasan Game Di-drop:
              </div>
              <textarea
                rows={2}
                placeholder="Tulis alasan kenapa game ini di-drop agar kamu ingat..."
                value={dropReason}
                onChange={e => setDropReason(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#140608] border border-[#4d141d] rounded text-xs text-white placeholder-rose-400/40 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {/* Notes / Personal Review */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Review Pribadi / Catatan:
            </label>
            <textarea
              rows={2}
              placeholder="Impresi, build karakter, gameplay..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0e111a] border border-[#202738] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3d4b6c]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#1e2436]">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white bg-[#161a26] hover:bg-[#1f2538] transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
