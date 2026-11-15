import React from 'react';
import { Gamepad2, Plus, BarChart2, RefreshCw, ZoomIn, ZoomOut, Database } from 'lucide-react';
import type { GameStats } from '../types/game';

interface NavbarProps {
  stats: GameStats | null;
  onOpenAddModal: () => void;
  onOpenStatsModal: () => void;
  onOpenBackupModal: () => void;
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
  onOpenBackupModal,
  onRefresh,
  isLoading,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => {
  return (
    <header className="sticky top-0 z-30 surface-panel border-b border-[#1f2536] px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1c2233] border border-[#2c354d] flex items-center justify-center">
            <Gamepad2 className="w-4.5 h-4.5 text-slate-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white">
                QuestLog
              </h1>
              <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.2 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                Steam
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Backlog & Progress Tracker</p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        {stats && (
          <div className="hidden lg:flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Playing: <span className="font-bold text-white ml-0.5">{stats.byStatus.playing}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-300 text-[11px] font-medium">
              Backlog: <span className="font-bold text-white ml-0.5">{stats.byStatus.plan_to_play}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/40 border border-rose-800/50 text-rose-300 text-[11px] font-medium">
              Dropped: <span className="font-bold text-white ml-0.5">{stats.byStatus.dropped}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[11px] font-medium">
              Completed: <span className="font-bold text-white ml-0.5">{stats.byStatus.completed}</span>
            </div>
          </div>
        )}

        {/* Action Controls & Zoom Switcher */}
        <div className="flex items-center gap-2">
          {/* Zoom Controller (100% min, 125% max) */}
          <div className="flex items-center bg-[#161a26] border border-[#262e42] rounded-md p-0.5 text-slate-400" title="Skala Tampilan (Ctrl + / Ctrl -)">
            <button
              onClick={onZoomOut}
              disabled={zoomScale <= 100}
              className={`p-1 rounded transition-colors ${
                zoomScale <= 100
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:text-white hover:bg-slate-700/50'
              }`}
              title="Perkecil (Minimal 100%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onZoomReset}
              className="px-1.5 text-[10px] font-mono text-slate-300 hover:text-white transition-colors"
              title="Reset ke 100%"
            >
              {zoomScale}%
            </button>
            <button
              onClick={onZoomIn}
              disabled={zoomScale >= 125}
              className={`p-1 rounded transition-colors ${
                zoomScale >= 125
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:text-white hover:bg-slate-700/50'
              }`}
              title="Perbesar (Maksimal 125%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Muat ulang data"
            className="p-1.5 rounded-md text-slate-400 hover:text-white bg-[#161a26] hover:bg-[#1f2538] border border-[#262e42] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenStatsModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-[#161a26] hover:bg-[#1f2538] border border-[#262e42] transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Stats</span>
          </button>

          <button
            onClick={onOpenBackupModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-[#161a26] hover:bg-[#1f2538] border border-[#262e42] transition-colors"
            title="Cadangan & Pemulihan Data"
          >
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Backup</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 shadow-sm transition-colors active:translate-y-px"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Game</span>
          </button>
        </div>
      </div>
    </header>
  );
};
