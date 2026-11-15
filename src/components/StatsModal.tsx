import React from 'react';
import { X, Trophy, Flame, Bookmark, XCircle, BarChart3, CheckCircle2 } from 'lucide-react';
import type { GameStats, Game } from '../types/game';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: GameStats | null;
  games: Game[];
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose, stats, games }) => {
  if (!isOpen || !stats) return null;

  // Calculate average rating
  const ratedGames = games.filter(g => g.rating > 0);
  const avgRating = ratedGames.length > 0
    ? (ratedGames.reduce((acc, g) => acc + g.rating, 0) / ratedGames.length).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Statistik Perpustakaan Game</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Key Numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold text-white tracking-tight">{stats.total}</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Total Game Dicatat</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold text-purple-400 tracking-tight">{stats.totalPlaytime}h</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Total Jam Bermain</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{stats.completionRate}%</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Tingkat Kelulusan (Completion)</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold text-amber-300 tracking-tight">{avgRating} / 10</span>
            <span className="text-xs text-slate-400 mt-1 font-medium">Rata-Rata Rating Game</span>
          </div>
        </div>

        {/* Breakdown by status */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Distribusi Status</h3>
          
          <div className="space-y-2">
            {[
              { label: 'Sedang Dimainkan (Playing)', count: stats.byStatus.playing, color: 'bg-emerald-500', text: 'text-emerald-400', icon: <Flame className="w-3.5 h-3.5" /> },
              { label: 'Rencana Main (Backlog)', count: stats.byStatus.plan_to_play, color: 'bg-indigo-500', text: 'text-indigo-400', icon: <Bookmark className="w-3.5 h-3.5" /> },
              { label: 'Tamat (Completed)', count: stats.byStatus.completed, color: 'bg-amber-500', text: 'text-amber-400', icon: <Trophy className="w-3.5 h-3.5" /> },
              { label: 'Ditinggalkan (Dropped)', count: stats.byStatus.dropped, color: 'bg-rose-500', text: 'text-rose-400', icon: <XCircle className="w-3.5 h-3.5" /> },
              { label: 'Ditunda (On Hold)', count: stats.byStatus.on_hold, color: 'bg-slate-500', text: 'text-slate-400', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            ].map((item, idx) => {
              const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className={`flex items-center gap-1.5 ${item.text}`}>
                      {item.icon}
                      {item.label}
                    </span>
                    <span className="text-slate-300 font-bold">
                      {item.count} <span className="text-slate-500 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
