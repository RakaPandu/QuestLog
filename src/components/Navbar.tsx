import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  BarChart2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Database,
  Search,
  ChevronRight,
  ChevronLeft,
  Minus,
  Square,
  X,
  Layers,
  Flame,
  Bookmark,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Maximize2
} from 'lucide-react';
import type { GameStats } from '../types/game';
import type { FilterTab } from './StatusTabs';

interface NavbarProps {
  stats: GameStats | null;
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenAddModal: () => void;
  onOpenStatsModal: () => void;
  onOpenBackupModal: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFocusSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  activeTab,
  onTabChange,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onOpenAddModal,
  onOpenStatsModal,
  onOpenBackupModal,
  onRefresh,
  isLoading,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFocusSearch,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState<boolean>(false);
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Monitor fullscreen and Electron window states
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    const api = (window as any).electronAPI;
    if (api) {
      api.isMaximized().then((max: boolean) => setIsWindowMaximized(max)).catch(() => {});
      api.onWindowStateChange((max: boolean) => setIsWindowMaximized(max));
    }

    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleMaximizeToggle = () => {
    const api = (window as any).electronAPI;
    if (api) {
      api.maximize();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleMinimize = () => {
    const api = (window as any).electronAPI;
    if (api) {
      api.minimize();
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    const api = (window as any).electronAPI;
    if (api) {
      api.close();
    } else if (window.confirm('Tutup QuestLog?')) {
      window.close();
    }
  };

  const tabLabels: Record<FilterTab, string> = {
    all: 'Semua Koleksi',
    playing: 'Sedang Dimainkan',
    plan_to_play: 'Backlog Game',
    completed: 'Tamat / Selesai',
    dropped: 'Game Dropped',
    on_hold: 'On Hold'
  };

  return (
    <header
      ref={navContainerRef}
      className="w-full select-none sticky top-0 z-40 bg-[#090b10] border-b border-[#161a24] text-slate-300"
    >
      {/* ROW 1: Antigravity IDE Title Bar (Menus & Window Controls) */}
      <div className="titlebar-drag-region h-7 px-2.5 flex items-center justify-between text-xs border-b border-[#141722] bg-[#07090e]">
        {/* Left: Native IDE Menus */}
        <div className="flex items-center gap-0.5">
          {/* Menu: QuestLog */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'questlog' ? null : 'questlog')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                openMenu === 'questlog'
                  ? 'bg-[#1b2131] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-[#141824]'
              }`}
            >
              QuestLog
            </button>
            {openMenu === 'questlog' && (
              <div className="absolute left-0 top-full mt-1 w-56 rounded-md bg-[#11141e] border border-[#222a3d] shadow-2xl py-1 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-[#1e2538] flex items-center gap-2">
                  <img src="/app.png" alt="QuestLog" className="w-4 h-4 object-contain" />
                  <div>
                    <div className="font-semibold text-white">QuestLog v1.0</div>
                    <div className="text-[10px] text-slate-400">Steam Game Tracker</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onOpenAddModal();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center justify-between text-slate-300"
                >
                  <span>Tambah Game Baru</span>
                  <span className="text-[10px] text-slate-500 font-mono">+</span>
                </button>
                <button
                  onClick={() => {
                    onRefresh();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center justify-between text-slate-300"
                >
                  <span>Muat Ulang Database</span>
                  <span className="text-[10px] text-slate-500 font-mono">F5</span>
                </button>
                <div className="my-1 border-t border-[#1e2538]" />
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    handleClose();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 hover:text-rose-200 text-rose-300 flex items-center justify-between"
                >
                  <span>Tutup Aplikasi</span>
                  <span className="text-[10px] text-rose-400 font-mono">Alt+F4</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu: Library */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'library' ? null : 'library')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                openMenu === 'library'
                  ? 'bg-[#1b2131] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-[#141824]'
              }`}
            >
              Library
            </button>
            {openMenu === 'library' && (
              <div className="absolute left-0 top-full mt-1 w-52 rounded-md bg-[#11141e] border border-[#222a3d] shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    onTabChange('all');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-slate-300"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Semua Game</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('playing');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-emerald-300"
                >
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sedang Dimainkan</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('plan_to_play');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-slate-300"
                >
                  <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                  <span>Backlog (Rencana Main)</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('completed');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-amber-300"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tamat / Selesai</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('dropped');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-rose-300"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Game Dropped</span>
                </button>
                <button
                  onClick={() => {
                    onTabChange('on_hold');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-slate-400"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>On Hold</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu: View */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                openMenu === 'view'
                  ? 'bg-[#1b2131] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-[#141824]'
              }`}
            >
              View
            </button>
            {openMenu === 'view' && (
              <div className="absolute left-0 top-full mt-1 w-52 rounded-md bg-[#11141e] border border-[#222a3d] shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    onZoomIn();
                    setOpenMenu(null);
                  }}
                  disabled={zoomScale >= 125}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center justify-between text-slate-300 disabled:opacity-40"
                >
                  <span>Perbesar (Ctrl +)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Max 125%</span>
                </button>
                <button
                  onClick={() => {
                    onZoomOut();
                    setOpenMenu(null);
                  }}
                  disabled={zoomScale <= 100}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center justify-between text-slate-300 disabled:opacity-40"
                >
                  <span>Perkecil (Ctrl -)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Min 100%</span>
                </button>
                <button
                  onClick={() => {
                    onZoomReset();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center justify-between text-slate-300"
                >
                  <span>Reset Skala (100%)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Ctrl 0</span>
                </button>
                <div className="my-1 border-t border-[#1e2538]" />
                <button
                  onClick={() => {
                    handleMaximizeToggle();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center justify-between text-slate-300"
                >
                  <span>{isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh (Fullscreen)'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">F11</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu: Data */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'data' ? null : 'data')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                openMenu === 'data'
                  ? 'bg-[#1b2131] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-[#141824]'
              }`}
            >
              Data
            </button>
            {openMenu === 'data' && (
              <div className="absolute left-0 top-full mt-1 w-56 rounded-md bg-[#11141e] border border-[#222a3d] shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    onOpenBackupModal();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-slate-300"
                >
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  <span>Cadangan & Pemulihan (JSON)</span>
                </button>
                <button
                  onClick={() => {
                    onOpenStatsModal();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#1b2234] hover:text-white flex items-center gap-2 text-slate-300"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Statistik & Ringkasan Jam Main</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Command Center / Window Title */}
        <div
          onClick={onFocusSearch}
          className="hidden md:flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#10131d] hover:bg-[#161a27] border border-[#1b2233] text-[11px] text-slate-400 cursor-pointer transition-colors max-w-sm truncate"
          title="Klik untuk mencari game (Ctrl + F)"
        >
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate">QuestLog — Steam Tracker & Library</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60 ml-auto">
            Ctrl+F
          </span>
        </div>

        {/* Right: Steam Status & Antigravity Window Controls */}
        <div className="flex items-center h-full">
          {/* Subtle Steam Online status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 text-[10px] text-slate-400 border-r border-[#151924] mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium tracking-wide text-slate-300">Steam Ready</span>
          </div>

          {/* Minimal Antigravity Window Controls */}
          <button
            onClick={handleMinimize}
            className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1b2131] transition-colors titlebar-no-drag"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={handleMaximizeToggle}
            className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1b2131] transition-colors titlebar-no-drag"
            title={isWindowMaximized || isFullscreen ? 'Restore Down' : 'Maximize'}
          >
            {isWindowMaximized || isFullscreen ? (
              <Maximize2 className="w-2.5 h-2.5" />
            ) : (
              <Square className="w-2.5 h-2.5" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 transition-colors titlebar-no-drag"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ROW 2: Antigravity Sub-Toolbar & Breadcrumbs */}
      <div className="h-8 px-2.5 sm:px-3 flex items-center justify-between gap-2 bg-[#0c0e14]">
        {/* Left: App Logo, Navigation (<, >), Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          {/* App Logo */}
          <div
            onClick={() => onTabChange('all')}
            className="flex items-center justify-center w-5.5 h-5.5 rounded bg-[#141824] border border-[#212739] cursor-pointer hover:border-slate-400 transition-colors shrink-0"
            title="QuestLog Home"
          >
            <img src="/app.png" alt="QuestLog Logo" className="w-3.5 h-3.5 object-contain" />
          </div>

          {/* Quick Nav Arrows */}
          <div className="flex items-center text-slate-500 shrink-0">
            <button
              onClick={onGoBack}
              disabled={!canGoBack}
              className="p-1 rounded hover:text-slate-200 hover:bg-[#161a26] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              title="Kembali ke tab sebelumnya"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={onGoForward}
              disabled={!canGoForward}
              className="p-1 rounded hover:text-slate-200 hover:bg-[#161a26] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              title="Maju ke tab berikutnya"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Search trigger icon */}
          <button
            onClick={onFocusSearch}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#161a26] transition-colors shrink-0"
            title="Cari game (Ctrl+F)"
          >
            <Search className="w-3 h-3" />
          </button>

          {/* Breadcrumb Display */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
            <span
              onClick={() => onTabChange('all')}
              className="hover:text-slate-200 cursor-pointer transition-colors"
            >
              QuestLog
            </span>
            <span className="text-slate-600 font-mono text-[10px]">/</span>
            <span className="text-slate-200 font-medium">
              {tabLabels[activeTab]}
            </span>
            {stats && (
              <span className="text-[10px] text-slate-500 hidden sm:inline ml-0.5">
                ({stats.total})
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Zoom, Refresh, Backup, Stats, Add Game */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom Controls (100% - 125%) */}
          <div
            className="flex items-center bg-[#11141e] border border-[#1f2638] rounded p-0.5 text-slate-400"
            title="Skala Tampilan (Ctrl + / Ctrl -)"
          >
            <button
              onClick={onZoomOut}
              disabled={zoomScale <= 100}
              className={`p-0.5 rounded transition-colors ${
                zoomScale <= 100
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:text-white hover:bg-slate-700/50'
              }`}
              title="Perkecil (Minimal 100%)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              onClick={onZoomReset}
              className="px-1 text-[10px] font-mono text-slate-300 hover:text-white transition-colors"
              title="Reset ke 100%"
            >
              {zoomScale}%
            </button>
            <button
              onClick={onZoomIn}
              disabled={zoomScale >= 125}
              className={`p-0.5 rounded transition-colors ${
                zoomScale >= 125
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:text-white hover:bg-slate-700/50'
              }`}
              title="Perbesar (Maksimal 125%)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Refresh Database */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Muat ulang data (F5)"
            className="p-1 rounded text-slate-400 hover:text-white bg-[#11141e] hover:bg-[#1a2030] border border-[#1f2638] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Stats Modal Trigger */}
          <button
            onClick={onOpenStatsModal}
            title="Lihat Statistik & Analytics"
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-300 hover:text-white bg-[#11141e] hover:bg-[#1a2030] border border-[#1f2638] transition-colors"
          >
            <BarChart2 className="w-3 h-3 text-slate-400" />
            <span>Stats</span>
          </button>

          {/* Backup Modal Trigger */}
          <button
            onClick={onOpenBackupModal}
            title="Cadangan & Pemulihan Database"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-300 hover:text-white bg-[#11141e] hover:bg-[#1a2030] border border-[#1f2638] transition-colors"
          >
            <Database className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Backup</span>
          </button>

          {/* Add Game Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 shadow-sm transition-colors active:translate-y-px"
          >
            <Plus className="w-3 h-3" />
            <span>Tambah</span>
          </button>
        </div>
      </div>
    </header>
  );
};
