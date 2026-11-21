import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  HardDrive,
  CheckSquare,
  Square,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  Cloud,
} from 'lucide-react';
import { api } from '../services/api';
import type { LocalSteamScanResult, GameStatus } from '../types/game';

interface LocalSteamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

type LibraryFilter = 'all' | 'installed' | 'uninstalled' | 'new';

export const LocalSteamModal: React.FC<LocalSteamModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [scanResult, setScanResult] = useState<LocalSteamScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusOverrides, setStatusOverrides] = useState<Record<string, GameStatus>>({});
  const [filterMode, setFilterMode] = useState<LibraryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleScan();
    }
  }, [isOpen]);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setImportMessage(null);
    try {
      const res = await api.scanLocalSteam();
      setScanResult(res);
      const initialSelected = new Set<string>();
      const initialStatuses: Record<string, GameStatus> = {};
      for (const g of res.games) {
        if (!g.alreadyInLibrary) {
          initialSelected.add(g.steamAppId);
        }
        initialStatuses[g.steamAppId] = g.suggestedStatus;
      }
      setSelectedIds(initialSelected);
      setStatusOverrides(initialStatuses);
    } catch (err: any) {
      setError(err.message || 'Gagal melakukan scan folder Steam lokal');
    } finally {
      setIsScanning(false);
    }
  };

  const filteredGames = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.games.filter(g => {
      if (filterMode === 'installed' && !g.isInstalled) return false;
      if (filterMode === 'uninstalled' && g.isInstalled) return false;
      if (filterMode === 'new' && g.alreadyInLibrary) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!g.title.toLowerCase().includes(q) && !g.steamAppId.includes(q)) return false;
      }
      return true;
    });
  }, [scanResult, filterMode, searchQuery]);

  if (!isOpen) return null;

  const toggleSelect = (appId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    const visibleIds = filteredGames.map(g => g.steamAppId);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!scanResult || selectedIds.size === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const toImport = scanResult.games
        .filter(g => selectedIds.has(g.steamAppId))
        .map(g => ({
          ...g,
          status: statusOverrides[g.steamAppId] || g.suggestedStatus,
        }));

      const res = await api.importLocalSteam(toImport);
      setImportMessage(
        `Berhasil! ${res.addedCount} game baru ditambahkan & ${res.updatedCount} game diperbarui.`
      );
      onImportSuccess();
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err: any) {
      setError(err.message || 'Gagal mengimpor game');
    } finally {
      setIsImporting(false);
    }
  };

  const installedCount = scanResult?.installedCount ?? scanResult?.games.filter(g => g.isInstalled).length ?? 0;
  const uninstalledCount = scanResult?.uninstalledCount ?? ((scanResult?.games.length || 0) - installedCount);
  const newCount = scanResult?.games.filter(g => !g.alreadyInLibrary).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="bg-[#11141d] border border-[#1f2536] rounded-lg w-full max-w-2xl max-h-[86vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0c0e14] border-b border-[#1f2536] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#161c2b] border border-[#26314a] flex items-center justify-center text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Scan Steam Library & Installed Games
              </h2>
              <p className="text-[11px] text-slate-400">
                {scanResult?.steamRoot
                  ? `Direktori: ${scanResult.steamRoot} (Termasuk game Library yang belum di-download)`
                  : 'Mendeteksi semua game di akun & library Steam lokal kamu'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1a2030] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="px-4 py-2.5 bg-[#0e1118] border-b border-[#1f2536] space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'all', label: `Semua Library (${scanResult?.games.length || 0})` },
                { id: 'installed', label: `Terinstall (${installedCount})` },
                { id: 'uninstalled', label: `Belum Download (${uninstalledCount})` },
                { id: 'new', label: `Belum di QuestLog (${newCount})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id as LibraryFilter)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    filterMode === tab.id
                      ? 'bg-[#1b2438] text-white border-sky-500/70'
                      : 'bg-[#141824] text-slate-400 border-[#22293d] hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#141824] hover:bg-[#1c2233] border border-[#22293d] text-slate-300 text-[11px]"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Scan Ulang</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari judul game atau AppID di library Steam..."
                className="w-full pl-8 pr-3 py-1 rounded bg-[#0c0e14] border border-[#202738] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={toggleSelectVisible}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141824] hover:bg-[#1c2233] border border-[#22293d] text-slate-200 text-[11px] shrink-0"
            >
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>Pilih / Batal Tab Ini ({filteredGames.length})</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1.5">
          {isScanning ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs">
                Membaca game terinstall, library stplug-in, appinfo.vdf & localconfig.vdf...
              </span>
            </div>
          ) : error ? (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada game yang cocok dengan filter ini.
            </div>
          ) : (
            filteredGames.map(g => {
              const isSelected = selectedIds.has(g.steamAppId);
              const currentStatus = statusOverrides[g.steamAppId] || g.suggestedStatus;

              return (
                <div
                  key={g.steamAppId}
                  onClick={() => toggleSelect(g.steamAppId)}
                  className={`p-2 rounded-md border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#151a28] border-sky-500/60'
                      : 'bg-[#12151f] border-[#1e2436] opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      className="text-slate-300 shrink-0"
                      onClick={e => {
                        e.stopPropagation();
                        toggleSelect(g.steamAppId);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {g.title}
                        </span>
                        {g.isInstalled ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-[10px]">
                            Terinstall
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#161c2b] text-sky-300 border border-[#26324d] text-[10px]">
                            <Cloud className="w-2.5 h-2.5" />
                            Di Library
                          </span>
                        )}
                        {g.alreadyInLibrary && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                            Sudah di QuestLog
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          {g.playtimeHours} jam
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          AppID: {g.steamAppId}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div onClick={e => e.stopPropagation()} className="shrink-0">
                    <select
                      value={currentStatus}
                      onChange={e =>
                        setStatusOverrides(prev => ({
                          ...prev,
                          [g.steamAppId]: e.target.value as GameStatus,
                        }))
                      }
                      className="bg-[#0c0e14] border border-[#22293d] rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="playing">Playing</option>
                      <option value="plan_to_play">Backlog</option>
                      <option value="completed">Tamat</option>
                      <option value="on_hold">On Hold</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0c0e14] border-t border-[#1f2536] flex items-center justify-between gap-3">
          {importMessage ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>{importMessage}</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              Terpilih <strong className="text-white">{selectedIds.size}</strong> game untuk diimpor ke QuestLog.
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#161a26] hover:bg-[#1f2536] text-slate-300 text-xs font-medium"
            >
              Tutup
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || selectedIds.size === 0}
              className="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengimpor...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Impor {selectedIds.size} Game</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
