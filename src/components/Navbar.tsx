import React from 'react';
import { Gamepad2, Plus, BarChart2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import type { GameStats } from '../types/game';

interface NavbarProps {
  stats: GameStats | null;
  onOpenAddModal: () => void;
  onOpenStatsModal: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onOpenAddModal,
  onOpenStatsModal,
  onRefresh,
  isLoading,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => {
  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-white/10 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
            <Gamepad2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                QuestLog
              </h1>
              <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Steam
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Backlog & Progress Tracker</p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        {stats && (
          <div className="hidden lg:flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Playing: <span className="font-bold text-white ml-0.5">{stats.byStatus.playing}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-medium">
              Backlog: <span className="font-bold text-white ml-0.5">{stats.byStatus.plan_to_play}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-medium">
              Dropped: <span className="font-bold text-white ml-0.5">{stats.byStatus.dropped}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
              Completed: <span className="font-bold text-white ml-0.5">{stats.byStatus.completed}</span>
            </div>
          </div>
        )}

        {/* Action Controls & Zoom Switcher */}
        <div className="flex items-center gap-2">
          {/* Zoom Controller */}
          <div className="flex items-center bg-slate-900/80 border border-white/10 rounded-lg p-0.5 text-slate-400" title="Ukuran Tampilan (Ctrl + / Ctrl -)">
            <button
              onClick={onZoomOut}
              className="p-1 rounded hover:text-white hover:bg-white/10 transition-colors"
              title="Perkecil Tampilan (Ctrl -)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onZoomReset}
              className="px-1.5 text-[10px] font-mono text-slate-300 hover:text-purple-300 transition-colors"
              title="Reset Ukuran (Ctrl 0)"
            >
              {zoomScale}%
            </button>
            <button
              onClick={onZoomIn}
              className="p-1 rounded hover:text-white hover:bg-white/10 transition-colors"
              title="Perbesar Tampilan (Ctrl +)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh game list"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenStatsModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all hover:border-purple-500/40"
          >
            <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Stats</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-sm shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Game</span>
          </button>
        </div>
      </div>
    </header>
  );
};
