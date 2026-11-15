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
  const tabs: { key: FilterTab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'all', label: 'All Games', icon: <Layers className="w-4 h-4" />, color: 'hover:text-purple-400' },
    { key: 'playing', label: 'Playing', icon: <Flame className="w-4 h-4 text-emerald-400" />, color: 'hover:text-emerald-400' },
    { key: 'plan_to_play', label: 'Plan to Play', icon: <Bookmark className="w-4 h-4 text-indigo-400" />, color: 'hover:text-indigo-400' },
    { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4 text-amber-400" />, color: 'hover:text-amber-400' },
    { key: 'dropped', label: 'Dropped', icon: <XCircle className="w-4 h-4 text-rose-400" />, color: 'hover:text-rose-400' },
    { key: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-4 h-4 text-slate-400" />, color: 'hover:text-slate-400' },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(tab => {
          const isActive = currentTab === tab.key;
          const count = counts[tab.key] || 0;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-purple-600/20 text-white border border-purple-500/50 shadow-md shadow-purple-600/10'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title or genre..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/70 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as SortOption)}
            className="bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-purple-500/50 cursor-pointer"
          >
            <option value="updated">Recently Updated</option>
            <option value="rating">Highest Rating</option>
            <option value="playtime">Most Playtime</option>
            <option value="title">Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
