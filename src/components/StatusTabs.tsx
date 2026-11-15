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
    { key: 'all', label: 'Semua', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'playing', label: 'Playing', icon: <Flame className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'plan_to_play', label: 'Backlog', icon: <Bookmark className="w-3.5 h-3.5 text-slate-300" /> },
    { key: 'completed', label: 'Tamat', icon: <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> },
    { key: 'dropped', label: 'Dropped', icon: <XCircle className="w-3.5 h-3.5 text-rose-400" /> },
    { key: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-3.5 h-3.5 text-slate-400" /> },
  ];

  return (
    <div className="space-y-3 mb-4">
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full">
        {tabs.map(tab => {
          const isActive = currentTab === tab.key;
          const count = counts[tab.key] || 0;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#1e2435] text-white border border-[#374463] shadow-sm'
                  : 'bg-[#12151f] text-slate-400 hover:bg-[#1a1f2e] hover:text-slate-200 border border-[#1f2638]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  isActive
                    ? 'bg-[#28324a] text-slate-200'
                    : 'bg-[#181c28] text-slate-500'
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
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari judul atau genre game..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#12151f] border border-[#202738] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#3d4b6c] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            Urutan:
          </span>
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as SortOption)}
            className="bg-[#12151f] border border-[#202738] rounded-md text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-[#3d4b6c] cursor-pointer"
          >
            <option value="updated">Terakhir Diperbarui</option>
            <option value="rating">Rating Tertinggi</option>
            <option value="playtime">Jam Main Terlama</option>
            <option value="title">Abjad (A - Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
