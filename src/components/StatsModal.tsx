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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="relative w-full max-w-md bg-[#121520] border border-[#242b3d] rounded-xl shadow-2xl overflow-hidden p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#202738] pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-300" />
            <h2 className="text-sm font-bold text-white">Statistik Perpustakaan Game</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Key Numbers */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Total Game</span>
          </div>

          <div className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-sky-400">{stats.totalPlaytime}h</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Total Jam Bermain</span>
          </div>

          <div className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-amber-400">{stats.completionRate}%</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Tingkat Tamat</span>
          </div>

          <div className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-amber-300">{avgRating} / 10</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Rata-Rata Rating</span>
          </div>
        </div>

        {/* Breakdown by status */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Distribusi Status</h3>
          
          <div className="space-y-1.5">
            {[
              { label: 'Playing', count: stats.byStatus.playing, color: 'bg-emerald-500', text: 'text-emerald-400', icon: <Flame className="w-3 h-3" /> },
              { label: 'Backlog', count: stats.byStatus.plan_to_play, color: 'bg-slate-400', text: 'text-slate-300', icon: <Bookmark className="w-3 h-3" /> },
              { label: 'Tamat (Completed)', count: stats.byStatus.completed, color: 'bg-amber-500', text: 'text-amber-400', icon: <Trophy className="w-3 h-3" /> },
              { label: 'Dropped', count: stats.byStatus.dropped, color: 'bg-rose-500', text: 'text-rose-400', icon: <XCircle className="w-3 h-3" /> },
              { label: 'On Hold', count: stats.byStatus.on_hold, color: 'bg-slate-500', text: 'text-slate-400', icon: <CheckCircle2 className="w-3 h-3" /> },
            ].map((item, idx) => {
              const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className={`flex items-center gap-1 ${item.text}`}>
                      {item.icon}
                      {item.label}
                    </span>
                    <span className="text-slate-300 font-semibold">
                      {item.count} <span className="text-slate-500 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[#181c28] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-md text-xs font-semibold text-slate-300 hover:text-white bg-[#161a26] hover:bg-[#1f2538] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
