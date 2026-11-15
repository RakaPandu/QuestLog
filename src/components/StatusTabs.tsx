import React from 'react';
import { Search, Flame, Bookmark, CheckCircle2, XCircle, PauseCircle, Layers, ArrowUpDown } from 'lucide-react';
import type { GameStatus } from '../types/game';

export type FilterTab = 'all' | GameStatus;
export type SortOption = 'updated' | 'rating' | 'playtime' | 'title';

interface StatusTabsProps {
  currentTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const StatusTabs: React.FC<StatusTabsProps> = ({
  currentTab,
  onTabChange,
  counts,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}) => {
  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'playing', label: 'Playing', icon: <Flame className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'plan_to_play', label: 'Backlog', icon: <Bookmark className="w-3.5 h-3.5 text-indigo-400" /> },
    { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> },
    { key: 'dropped', label: 'Dropped', icon: <XCircle className="w-3.5 h-3.5 text-rose-400" /> },
    { key: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-3.5 h-3.5 text-slate-400" /> },
  ];

  return (
    <div className="space-y-3 mb-5">
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full">
        {tabs.map(tab => {
          const isActive = currentTab === tab.key;
          const count = counts[tab.key] || 0;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-purple-600/25 text-white border border-purple-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isActive
                    ? 'bg-purple-500/30 text-purple-200'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul atau genre..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/70 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as SortOption)}
            className="bg-slate-900/80 border border-white/10 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-purple-500/50 cursor-pointer"
          >
            <option value="updated">Baru Diupdate</option>
            <option value="rating">Rating Tertinggi</option>
            <option value="playtime">Jam Main Terbanyak</option>
            <option value="title">Judul (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
