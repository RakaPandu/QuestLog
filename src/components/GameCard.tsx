import React, { useState, useEffect } from 'react';
import { Star, Clock, Trophy, Flame, Bookmark, XCircle, PauseCircle, ChevronRight, AlertTriangle } from 'lucide-react';
import type { Game, GameStatus } from '../types/game';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  onQuickStatusChange: (status: GameStatus) => void;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({ game, onClick }) => {
  const [imgSrc, setImgSrc] = useState<string>(game.coverUrl || '');
  const [isLandscapeImg, setIsLandscapeImg] = useState<boolean>(game.coverFit === 'contain-blur');
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  useEffect(() => {
    setImgSrc(game.coverUrl || (game.steamAppId ? `/api/steam/local-image/${game.steamAppId}/cover` : ''));
    setIsLandscapeImg(game.coverFit === 'contain-blur');
    setImgFailed(false);
  }, [game.coverUrl, game.steamAppId, game.coverFit]);

  const handleImgError = () => {
    const localCover = game.steamAppId ? `/api/steam/local-image/${game.steamAppId}/cover` : '';
    const localBanner = game.steamAppId ? `/api/steam/local-image/${game.steamAppId}/banner` : '';

    if (localCover && imgSrc !== localCover && imgSrc !== localBanner && imgSrc !== game.bannerUrl) {
      setImgSrc(localCover);
    } else if (game.bannerUrl && imgSrc !== game.bannerUrl && imgSrc !== localBanner) {
      setImgSrc(game.bannerUrl);
    } else if (localBanner && imgSrc !== localBanner) {
      setImgSrc(localBanner);
    } else {
      setImgFailed(true);
    }
  };

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (game.coverFit === 'contain-blur') {
      setIsLandscapeImg(true);
    } else if (game.coverFit === 'cover') {
      setIsLandscapeImg(false);
    } else if (el.naturalWidth && el.naturalHeight) {
      setIsLandscapeImg(el.naturalWidth > el.naturalHeight * 1.15);
    }
  };

  const useContainBlur = game.coverFit === 'contain-blur' || isLandscapeImg;
  const objectPos = game.coverPosition || '50% 30%';
  const statusConfig = {
    playing: {
      label: 'Playing',
      icon: <Flame className="w-2.5 h-2.5 text-emerald-400" />,
      bg: 'bg-[#06281e] text-emerald-300 border-[#0b4d3a]',
      badgeDot: 'bg-emerald-400',
    },
    plan_to_play: {
      label: 'Backlog',
      icon: <Bookmark className="w-2.5 h-2.5 text-slate-300" />,
      bg: 'bg-[#181d2b] text-slate-300 border-[#2b354d]',
      badgeDot: 'bg-slate-400',
    },
    completed: {
      label: 'Completed',
      icon: <Trophy className="w-2.5 h-2.5 text-amber-400" />,
      bg: 'bg-[#291804] text-amber-300 border-[#5e370a]',
      badgeDot: 'bg-amber-400',
    },
    dropped: {
      label: 'Dropped',
      icon: <XCircle className="w-2.5 h-2.5 text-rose-400" />,
      bg: 'bg-[#2b0c10] text-rose-300 border-[#5e1923]',
      badgeDot: 'bg-rose-400',
    },
    on_hold: {
      label: 'On Hold',
      icon: <PauseCircle className="w-2.5 h-2.5 text-slate-400" />,
      bg: 'bg-[#181d26] text-slate-300 border-[#2c3445]',
      badgeDot: 'bg-slate-400',
    },
  }[game.status];

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-lg surface-card overflow-hidden cursor-pointer select-none"
    >
      {/* Game Cover Poster (Aspect Ratio 2:3 - Steam Library Standard) */}
      <div className="relative aspect-[2/3] w-full bg-[#0a0c12] overflow-hidden">
        {imgSrc && !imgFailed ? (
          useContainBlur ? (
            <div className="relative w-full h-full flex items-center justify-center bg-[#090b10]">
              <img
                src={imgSrc}
                alt=""
                aria-hidden="true"
                decoding="async"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                style={{ objectPosition: objectPos }}
              />
              <img
                src={imgSrc}
                alt={game.title}
                decoding="async"
                loading="lazy"
                onLoad={handleImgLoad}
                onError={handleImgError}
                className="relative z-10 w-full max-h-full object-contain shadow-md"
              />
            </div>
          ) : (
            <img
              src={imgSrc}
              alt={game.title}
              decoding="async"
              loading="lazy"
              onLoad={handleImgLoad}
              onError={handleImgError}
              style={{ objectPosition: objectPos }}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#11141c] text-slate-500">
            <span className="text-xs font-medium px-2 text-center">{game.title}</span>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${statusConfig.bg}`}
          >
            <span className={`w-1 h-1 rounded-full ${statusConfig.badgeDot}`} />
            {statusConfig.label}
          </div>

          {/* Rating Badge */}
          {game.rating > 0 && (
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/80 border border-white/10 text-amber-300 text-[10px] font-bold">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>{game.rating}</span>
            </div>
          )}
        </div>

        {/* Playtime Badge Bottom Left */}
        {game.playtimeHours > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/85 border border-white/10 text-slate-300 text-[10px] font-medium">
            <Clock className="w-2.5 h-2.5 text-slate-400" />
            <span>{game.playtimeHours}h</span>
          </div>
        )}

        {/* Subtle shadow overlay for text */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0e111a] via-[#0e111a]/40 to-transparent pointer-events-none" />
      </div>

      {/* Card Info Content */}
      <div className="p-2.5 flex flex-col flex-1 justify-between bg-[#11141e]">
        <div>
          <h3 className="font-semibold text-white text-xs leading-tight truncate group-hover:text-slate-100 transition-colors" title={game.title}>
            {game.title}
          </h3>

          {/* Genres */}
          {game.genres && game.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {game.genres.slice(0, 2).map((genre, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-[#191f2e] text-slate-400 border border-[#242c40] font-medium"
                >
                  {genre}
                </span>
              ))}
              {game.genres.length > 2 && (
                <span className="text-[9px] text-slate-500">
                  +{game.genres.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Progress Notes */}
          {game.currentProgress && (
            <div className="mt-1.5 text-[10px] text-slate-300 bg-[#161a26] px-2 py-1 rounded border border-[#242b3d] truncate">
              <span className="text-slate-400 font-medium mr-1">Prog:</span>
              {game.currentProgress}
            </div>
          )}

          {/* Dropped Reason Alert */}
          {game.status === 'dropped' && game.dropReason && (
            <div className="mt-1.5 text-[10px] bg-[#290c10] border border-[#541620] text-rose-300 px-2 py-1 rounded flex items-center gap-1 truncate">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
              <span className="truncate">{game.dropReason}</span>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="mt-2 pt-1.5 border-t border-[#1e2436] flex items-center justify-between text-[10px] text-slate-400">
          <span className="text-[10px] text-slate-500 truncate max-w-[110px]">
            {game.developer || game.platform}
          </span>
          <div className="flex items-center gap-0.5 text-slate-400 group-hover:text-slate-200 transition-colors font-medium">
            <span>Detail</span>
            <ChevronRight className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>
    </div>
  );
});
