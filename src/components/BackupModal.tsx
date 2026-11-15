import React, { useState, useEffect } from 'react';
import { X, Download, Upload, RotateCcw, Database, Check, AlertCircle, FileText, Clock, ShieldCheck } from 'lucide-react';
import type { BackupSnapshot } from '../types/game';
import { api } from '../services/api';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
  totalGames: number;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  totalGames,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'snapshots'>('export');
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedGames, setParsedGames] = useState<any[] | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const data = await api.getSnapshots();
      setSnapshots(data);
    } catch (err) {
      console.error('Error fetching snapshots:', err);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedbackMessage(null);
      setImportError(null);
      setSelectedFile(null);
      setParsedGames(null);
      loadSnapshots();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Export Download
  const handleExport = async () => {
    try {
      const data = await api.exportBackup();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const filename = `questlog-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setFeedbackMessage({
        type: 'success',
        text: `Backup berhasil diunduh (${data.totalGames} game tersimpan di ${filename}).`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'Gagal mengunduh file backup: ' + err.message,
      });
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setFeedbackMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const games = Array.isArray(json) ? json : (Array.isArray(json.games) ? json.games : null);

        if (!games || games.length === 0) {
          setImportError('File JSON valid, tetapi tidak ditemukan data game di dalamnya.');
          setParsedGames(null);
          return;
        }

        setParsedGames(games);
      } catch {
        setImportError('Format file tidak valid. Pastikan file berupa JSON backup yang benar.');
        setParsedGames(null);
      }
    };
    reader.readAsText(file);
  };

  // Handle Import Submit
  const handleImportSubmit = async () => {
    if (!parsedGames || parsedGames.length === 0) return;

    const confirmMsg = importMode === 'replace'
      ? `Anda akan mengganti SELURUH data saat ini dengan ${parsedGames.length} game dari file backup. Lanjutkan?`
      : `Anda akan menggabungkan ${parsedGames.length} game dari file backup ke katalog saat ini. Lanjutkan?`;

    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      const res = await api.importBackup(parsedGames, importMode);
      setFeedbackMessage({
        type: 'success',
        text: `Data berhasil dipulihkan! Total ${res.count} game aktif di katalog Anda.`,
      });
      setSelectedFile(null);
      setParsedGames(null);
      onDataRestored();
      loadSnapshots();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'Gagal memulihkan data: ' + err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Restore Local Snapshot
  const handleRestoreSnapshot = async (filename: string, gameCount: number) => {
    if (!window.confirm(`Pulihkan data dari snapshot "${filename}" (${gameCount} game)? Data saat ini akan disimpan sebagai snapshot cadangan sebelum dipulihkan.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.restoreSnapshot(filename);
      setFeedbackMessage({
        type: 'success',
        text: `Berhasil memulihkan snapshot lokal! Sekarang ada ${res.count} game dalam katalog.`,
      });
      onDataRestored();
      loadSnapshots();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'Gagal memulihkan snapshot: ' + err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#121520] border border-[#242b3d] rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#202636] bg-[#0f121a]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-300" />
            <h2 className="text-sm font-bold text-white">Cadangan & Pemulihan Data (Backup)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#202636] bg-[#0e111a]">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-sky-500 text-white bg-[#141824]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor File (.json)</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-sky-500 text-white bg-[#141824]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor / Pulihkan</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('snapshots');
              loadSnapshots();
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'snapshots'
                ? 'border-sky-500 text-white bg-[#141824]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Snapshot Otomatis</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Feedback Alert */}
          {feedbackMessage && (
            <div
              className={`p-3 rounded-md text-xs flex items-center gap-2 ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#0e111a] border border-[#1e2436] space-y-2">
                <div className="flex items-center gap-2 text-white text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span>Simpan Cadangan Mandiri</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unduh seluruh daftar game, cover Steam, catatan progress, jam bermain, rating, dan alasan drop dalam satu file <code className="text-sky-300 bg-[#161a26] px-1.5 py-0.5 rounded">.json</code>. File ini bisa disimpan di Google Drive, flashdisk, atau dipindahkan ke PC lain kapan saja.
                </p>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-300 border-t border-[#1a1f2e]">
                  <span>Total game yang akan diekspor:</span>
                  <span className="font-bold text-white text-sm">{totalGames} game</span>
                </div>
              </div>

              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Cadangan (.json)</span>
              </button>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#0e111a] border border-[#1e2436] space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-white">
                    Pilih File Cadangan JSON:
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Pilih file backup yang pernah kamu ekspor sebelumnya.
                  </p>
                </div>

                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1a2130] file:text-sky-300 hover:file:bg-[#232b40] file:cursor-pointer cursor-pointer border border-[#202738] rounded-md p-1 bg-[#141824]"
                />

                {importError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{importError}</span>
                  </p>
                )}

                {parsedGames && (
                  <div className="p-3 rounded-md bg-[#161a26] border border-[#263044] space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                      <FileText className="w-4 h-4" />
                      <span>{selectedFile ? selectedFile.name : 'File valid'}: Ditemukan {parsedGames.length} game</span>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-[#202738]">
                      <span className="text-[11px] font-semibold text-slate-300 block">Metode Pemulihan:</span>
                      <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-semibold text-white">Ganti Seluruh Data (Replace)</span>
                          <p className="text-[10px] text-slate-400">Katalog saat ini akan digantikan sepenuhnya oleh data backup.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="merge"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-semibold text-white">Gabungkan Data (Merge)</span>
                          <p className="text-[10px] text-slate-400">Menambahkan game dari backup ke katalog saat ini tanpa menghapus yang sudah ada.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleImportSubmit}
                disabled={!parsedGames || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 border border-sky-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                <span>{isProcessing ? 'Memulihkan Data...' : 'Mulai Pemulihan'}</span>
              </button>
            </div>
          )}

          {/* TAB 3: SNAPSHOTS */}
          {activeTab === 'snapshots' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Snapshot otomatis lokal (tersimpan di PC):</span>
                <button
                  onClick={loadSnapshots}
                  disabled={isLoadingSnapshots}
                  className="hover:text-white underline text-[11px]"
                >
                  Muat Ulang
                </button>
              </div>

              {isLoadingSnapshots ? (
                <div className="py-8 text-center text-xs text-slate-500">Memuat riwayat snapshot...</div>
              ) : snapshots.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.filename}
                      className="p-3 rounded-lg bg-[#0e111a] border border-[#1e2436] flex items-center justify-between gap-3 text-xs hover:border-[#2b354d] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate max-w-[200px]">
                            {snap.filename}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {formatFileSize(snap.sizeBytes)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDate(snap.createdAt)} • <span className="text-slate-300 font-medium">{snap.gameCount} game</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleRestoreSnapshot(snap.filename, snap.gameCount)}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c2233] hover:bg-sky-600 text-slate-200 hover:text-white border border-[#2b354d] transition-colors font-medium shrink-0 text-[11px]"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Pulihkan</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 rounded-lg bg-[#0e111a] border border-dashed border-[#1e2436]">
                  Belum ada snapshot otomatis lokal.
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-2 border-t border-[#1e2436] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white bg-[#161a26] hover:bg-[#1f2538] transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
