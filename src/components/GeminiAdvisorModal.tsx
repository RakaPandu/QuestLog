import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Compass,
  MessageSquare,
  KeyRound,
  Clock,
  Sliders,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  Game,
  GeminiConfig,
  GeminiRecommendResponse,
  GeminiChatMessage,
} from '../types/game';

interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  onSelectGame?: (game: Game) => void;
}

type AdvisorTab = 'picker' | 'chat' | 'settings';

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  games,
  onSelectGame,
}) => {
  const [activeTab, setActiveTab] = useState<AdvisorTab>('picker');
  const [config, setConfig] = useState<GeminiConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-4-hydrogen');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  // Backlog Picker State
  const [mood, setMood] = useState('Fokus menamatkan game yang sedang dimainkan (Finish Backlog)');
  const [timeAvailable, setTimeAvailable] = useState('1 - 2 Jam');
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendResult, setRecommendResult] = useState<GeminiRecommendResponse | null>(null);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  // Stateful Multi-Turn Chat State (Interactions API previous_interaction_id)
  const [messages, setMessages] = useState<GeminiChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [lastInteractionId, setLastInteractionId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSendingChat]);

  const loadConfig = async () => {
    try {
      const cfg = await api.getGeminiConfig();
      setConfig(cfg);
      if (cfg.model) setSelectedModel(cfg.model);
      if (!cfg.hasApiKey) {
        setActiveTab('settings');
      }
    } catch {
      // Ignore initial config fetch error
    }
  };

  if (!isOpen) return null;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSavedMsg(null);
    try {
      const updated = await api.saveGeminiConfig({
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
        model: selectedModel,
      });
      setConfig(updated);
      setApiKeyInput('');
      setConfigSavedMsg('Konfigurasi Gemini API berhasil disimpan secara lokal.');
      if (updated.hasApiKey && activeTab === 'settings') {
        setTimeout(() => setActiveTab('picker'), 800);
      }
    } catch (err: any) {
      setConfigSavedMsg(err.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRunPicker = async () => {
    setIsRecommending(true);
    setRecommendError(null);
    try {
      const res = await api.getGeminiRecommendations({
        mood,
        timeAvailable,
        model: selectedModel,
      });
      setRecommendResult(res);
    } catch (err: any) {
      setRecommendError(err.message || 'Gagal mendapatkan rekomendasi');
      if (err.message?.includes('API Key')) {
        setActiveTab('settings');
      }
    } finally {
      setIsRecommending(false);
    }
  };

  const handleSendChat = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? chatInput).trim();
    if (!textToSend || isSendingChat) return;

    const userMsg: GeminiChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setChatInput('');
    setIsSendingChat(true);
    setChatError(null);

    try {
      const res = await api.sendGeminiChat({
        message: textToSend,
        previousInteractionId: lastInteractionId,
        model: selectedModel,
      });
      setLastInteractionId(res.interactionId);
      const assistantMsg: GeminiChatMessage = {
        id: res.interactionId || `ai_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setChatError(err.message || 'Gagal menghubungi Gemini API');
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setLastInteractionId(null);
    setChatError(null);
  };

  const moodOptions = [
    { label: 'Cicil Backlog', value: 'Fokus menamatkan game yang sedang dimainkan (Finish Backlog)' },
    { label: 'Santai & Chill', value: 'Santai, bebas stres, mekanik ringan setelah hari yang sibuk' },
    { label: 'Cerita & Imersi', value: 'Fokus narasi mendalam, RPG, atau eksplorasi dunia' },
    { label: 'Tantangan & Aksi', value: 'Gameplay intens, fast-paced, atau butuh fokus mekanik tinggi' },
  ];

  const timeOptions = ['30 - 45 Menit', '1 - 2 Jam', '3+ Jam Sesi Panjang'];

  const quickPrompts = [
    'Urutkan 3 game backlog yang paling layak gw tamatin duluan',
    'Analisis pola game yang sering gw drop vs tamatkan',
    'Kasih rekomendasi game Steam baru sesuai rating tertinggi gw',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="bg-[#11141d] border border-[#1f2536] rounded-lg w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#0c0e14] border-b border-[#1f2536] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#161c2b] border border-[#26314a] flex items-center justify-center text-sky-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Gemini Quest Advisor</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161c2b] text-sky-400 border border-[#26314a]">
                  {selectedModel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Kurator Backlog & Asisten Sesi Bermain (Google GenAI Interactions API)
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

        {/* Navigation Tabs */}
        <div className="px-4 pt-2 bg-[#0e1118] border-b border-[#1f2536] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('picker')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'picker'
                  ? 'border-sky-500 text-white bg-[#141824]/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Rekomendasi Sesi</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-sky-500 text-white bg-[#141824]/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tanya Advisor</span>
              {lastInteractionId && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Sesi Stateful Aktif" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-sky-500 text-white bg-[#141824]/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>API Key & Model</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 pb-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                config?.hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>{config?.hasApiKey ? `Key: ${config.maskedKey}` : 'API Key Belum Diatur'}</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: SMART BACKLOG PICKER */}
          {activeTab === 'picker' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-md bg-[#141824] border border-[#202738] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mood Selector */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-sky-400" />
                      <span>Mood / Fokus Malam Ini</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {moodOptions.map(opt => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setMood(opt.value)}
                          className={`px-2.5 py-1.5 rounded text-left text-[11px] font-medium border transition-colors ${
                            mood === opt.value
                              ? 'bg-[#1b2438] text-white border-sky-500/70'
                              : 'bg-[#0f121b] text-slate-400 border-[#1e2436] hover:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Budget Selector */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>Waktu Luang Tersedia</span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {timeOptions.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTimeAvailable(t)}
                            className={`px-2 py-1.5 rounded text-center text-[11px] font-medium border transition-colors ${
                              timeAvailable === t
                                ? 'bg-[#1b2438] text-white border-sky-500/70'
                                : 'bg-[#0f121b] text-slate-400 border-[#1e2436] hover:text-slate-200'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleRunPicker}
                      disabled={isRecommending}
                      className="mt-3 w-full py-2 px-3 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      {isRecommending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menganalisis {games.length} Game di Library...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Carikan Game Terbaik untuk Sesi Ini</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {recommendError && (
                <div className="p-3 rounded-md bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{recommendError}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-[11px] font-medium shrink-0"
                  >
                    Atur API Key
                  </button>
                </div>
              )}

              {recommendResult && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      {recommendResult.headline}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Structured JSON · {recommendResult.model}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {recommendResult.recommendations.map((rec, idx) => {
                      const matchedGame = games.find(
                        g => g.id === rec.gameId || g.title.toLowerCase() === rec.title.toLowerCase()
                      );

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-md bg-[#141824] border border-[#22293a] flex flex-col justify-between gap-2.5 hover:border-[#384564] transition-colors"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-white leading-snug">
                                {idx + 1}. {rec.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[10px] font-mono shrink-0">
                                {rec.matchScore}% Match
                              </span>
                            </div>

                            <div className="text-[11px] text-sky-300 font-medium bg-[#101420] px-2 py-1 rounded border border-[#1d2538]">
                              Target Sesi: {rec.sessionGoal}
                            </div>

                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {rec.reason}
                            </p>
                          </div>

                          {matchedGame && onSelectGame && (
                            <button
                              onClick={() => {
                                onSelectGame(matchedGame);
                                onClose();
                              }}
                              className="w-full py-1 px-2 rounded bg-[#1b2234] hover:bg-[#252f47] text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors border border-[#2c3650]"
                            >
                              <span>Buka Detail Game</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {recommendResult.backlogInsight && (
                    <div className="p-3 rounded-md bg-[#0f131d] border border-[#1f273b] flex items-start gap-2.5">
                      <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-amber-300 mr-1.5">Strategi Backlog:</span>
                        {recommendResult.backlogInsight}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STATEFUL MULTI-TURN CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[420px]">
              {/* Quick Prompts Bar */}
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-[#1c2233]">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {quickPrompts.map(qp => (
                    <button
                      key={qp}
                      onClick={() => handleSendChat(qp)}
                      disabled={isSendingChat}
                      className="px-2.5 py-1 rounded bg-[#141824] hover:bg-[#1c2233] border border-[#22293d] text-[11px] text-slate-300 whitespace-nowrap transition-colors"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={handleResetChat}
                    title="Reset Sesi Percakapan"
                    className="p-1.5 rounded bg-[#141824] hover:bg-[#1c2233] border border-[#22293d] text-slate-400 hover:text-white shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                    <MessageSquare className="w-7 h-7 mb-2 text-slate-600" />
                    <p className="text-xs font-medium text-slate-300">
                      Diskusi Langsung dengan Gemini Quest Advisor
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mt-1">
                      Advisor memahami seluruh isi library QuestLog kamu ({games.length} game) dan mengingat konteks percakapan menggunakan Stateful Interactions API.
                    </p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-sky-700 text-white border border-sky-600'
                            : 'bg-[#141824] text-slate-200 border border-[#22293d]'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                        {msg.role === 'user' ? 'Kamu' : `Gemini (${selectedModel})`} · {msg.timestamp}
                      </span>
                    </div>
                  ))
                )}

                {isSendingChat && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 px-2 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Gemini sedang menyusun jawaban...</span>
                  </div>
                )}

                {chatError && (
                  <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs">
                    {chatError}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="mt-2.5 pt-2 border-t border-[#1c2233] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Tanyakan soal backlog, progres game, atau saran rekomendasi..."
                  className="flex-1 bg-[#0c0e14] border border-[#202738] rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isSendingChat || !chatInput.trim()}
                  className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: API KEY & MODEL SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="p-3.5 rounded-md bg-[#141824] border border-[#202738] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white">Konfigurasi Google Gemini API</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Disimpan secara lokal di <code className="text-slate-300">data/config.json</code> (diabaikan oleh Git agar tetap aman & privat).
                    </p>
                  </div>
                  {config?.hasApiKey && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Aktif ({config.maskedKey})
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Gemini API Key (Google AI Studio)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder={
                      config?.hasApiKey
                        ? 'Biarkan kosong jika tidak ingin mengubah API Key...'
                        : 'Masukkan GEMINI_API_KEY (AIzaSy...)'
                    }
                    className="w-full bg-[#0c0e14] border border-[#202738] rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Model Gemini (Interactions API v1)
                  </label>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="w-full bg-[#0c0e14] border border-[#202738] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {(config?.availableModels || [
                      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Fast & Balanced - Default)' },
                      { id: 'gemini-4-argon', label: 'Gemini 4 Argon (Interactive Reasoning)' },
                      { id: 'gemini-4-neon', label: 'Gemini 4 Neon (Frontier Speed)' },
                      { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (Deep Frontier Reasoning)' },
                      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Ultra-Fast)' },
                    ]).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {configSavedMsg && (
                  <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{configSavedMsg}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
                  >
                    {isSavingConfig ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
