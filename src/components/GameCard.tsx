import React from 'react';
import { Star, Clock, Trophy, Flame, Bookmark, XCircle, PauseCircle, ChevronRight, AlertTriangle } from 'lucide-react';
import type { Game, GameStatus } from '../types/game';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  onQuickStatusChange: (status: GameStatus) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onClick }) => {
  const statusConfig = {
    playing: {
      label: 'Playing',
      icon: <Flame className="w-3 h-3 text-emerald-400" />,
      bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      badgeDot: 'bg-emerald-400',
    },
    plan_to_play: {
      label: 'Plan to Play',
      icon: <Bookmark className="w-3 h-3 text-indigo-400" />,
      bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      badgeDot: 'bg-indigo-400',
    },
    completed: {
      label: 'Completed',
      icon: <Trophy className="w-3 h-3 text-amber-400" />,
      bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      badgeDot: 'bg-amber-400',
    },
    dropped: {
      label: 'Dropped',
      icon: <XCircle className="w-3 h-3 text-rose-400" />,
      bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      badgeDot: 'bg-rose-400',
    },
    on_hold: {
      label: 'On Hold',
      icon: <PauseCircle className="w-3 h-3 text-slate-400" />,
      bg: 'bg-slate-700/40 text-slate-300 border-slate-600/30',
      badgeDot: 'bg-slate-400',
    },
  }[game.status];

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl glass-card overflow-hidden cursor-pointer select-none transition-all duration-300 hover:scale-[1.02]"
    >
      {/* Game Cover Poster (Aspect Ratio 2:3 - Standard Steam Library) */}
      <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              if (game.bannerUrl && (e.currentTarget.src !== game.bannerUrl)) {
                e.currentTarget.src = game.bannerUrl;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-600">
            <span className="text-sm font-semibold">{game.title}</span>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md border shadow-lg ${statusConfig.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.badgeDot}`} />
            {statusConfig.label}
          </div>

          {/* Rating Badge */}
          {game.rating > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-amber-300 text-xs font-bold shadow-lg">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{game.rating}</span>
            </div>
          )}
        </div>

        {/* Playtime Badge Bottom Left */}
        {game.playtimeHours > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-slate-300 text-[11px] font-medium">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{game.playtimeHours}h</span>
          </div>
        )}

        {/* Gradient shadow for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none" />
      </div>

      {/* Card Info Content */}
      <div className="p-4 flex flex-col flex-1 justify-between bg-slate-950/60">
        <div>
          <h3 className="font-bold text-white text-base leading-snug line-clamp-1 group-hover:text-purple-300 transition-colors">
            {game.title}
          </h3>

          {/* Genres */}
          {game.genres && game.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {game.genres.slice(0, 2).map((genre, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 font-medium"
                >
                  {genre}
                </span>
              ))}
              {game.genres.length > 2 && (
                <span className="text-[10px] px-1 py-0.5 text-slate-500">
                  +{game.genres.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Progress Notes */}
          {game.currentProgress && (
            <div className="mt-2.5 text-xs text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-white/5 line-clamp-2">
              <span className="text-purple-400 font-semibold mr-1">Progress:</span>
              {game.currentProgress}
            </div>
          )}

          {/* Dropped Reason Alert */}
          {game.status === 'dropped' && game.dropReason && (
            <div className="mt-2 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2 rounded-lg flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="line-clamp-2">
                <span className="font-bold">Alasan Drop:</span> {game.dropReason}
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
            {game.developer || game.platform}
          </span>
          <div className="flex items-center gap-1 text-purple-400 font-medium group-hover:translate-x-1 transition-transform">
            <span>Details</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
};
