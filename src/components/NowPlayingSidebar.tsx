import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Music, Trash2, X } from 'lucide-react';
import { Artist, Track } from '../types';

interface NowPlayingSidebarProps {
  currentTrack: Track | null;
  artistDetails: Artist | null;
  onClose: () => void;
  queue?: Track[];
  currentIndex?: number;
  onSelectQueueIndex?: (index: number) => void;
  onRemoveFromQueue?: (index: number) => void;
  width: number;
  setWidth: (width: number) => void;
}

export function NowPlayingSidebar({
  currentTrack,
  artistDetails,
  onClose,
  queue = [],
  currentIndex = 0,
  onSelectQueueIndex,
  onRemoveFromQueue,
  width,
  setWidth,
}: NowPlayingSidebarProps) {
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((event: MouseEvent) => {
    if (!isResizing) return;

    const nextWidth = window.innerWidth - event.clientX;
    if (nextWidth < 240) {
      onClose();
      setIsResizing(false);
    } else if (nextWidth >= 280 && nextWidth <= 600) {
      setWidth(nextWidth);
    }
  }, [isResizing, onClose, setWidth]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const coverUrl = currentTrack?.image || currentTrack?.thumbnail;

  const upcoming = useMemo(() => {
    const start = currentIndex + 1;
    return showAllQueue ? queue.slice(start) : queue.slice(start, start + 5);
  }, [currentIndex, queue, showAllQueue]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {!isDesktop ? (
        <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm lg:hidden animate-fadeIn" onClick={onClose} />
      ) : null}

      <div
        ref={sidebarRef}
        className={`fixed right-0 top-0 z-[60] flex h-screen flex-col border-l border-border/60 bg-bg-primary/34 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-3xl lg:static ${isResizing ? 'select-none' : ''}`}
        style={{
          width: isDesktop ? `${width}px` : '90%',
          maxWidth: isDesktop ? undefined : '480px',
          paddingBottom: !isDesktop ? 'calc(1.25rem + env(safe-area-inset-bottom))' : undefined,
        }}
      >
        <div
          className="group absolute left-0 top-0 hidden h-full w-1 cursor-col-resize transition-colors hover:bg-border/60 lg:block"
          onMouseDown={startResizing}
        >
          <div className={`absolute left-0 top-1/2 h-10 w-full -translate-y-1/2 rounded-full bg-primary/70 opacity-0 transition-opacity group-hover:opacity-100 ${isResizing ? 'opacity-100' : ''}`} />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Now Playing</h2>
            <p className="mt-1 text-xs text-text-muted">Queue and track context</p>
          </div>
          <button onClick={onClose} className="app-icon-button flex h-10 w-10 items-center justify-center rounded-full">
            <X size={18} className="text-text-primary" />
          </button>
        </div>

        {currentTrack ? (
          <div className="flex-1 overflow-y-auto">
            <div className="overflow-hidden rounded-[26px] app-panel shadow-elevated">
              {coverUrl ? (
                <img src={coverUrl} alt={currentTrack.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-bg-secondary">
                  <Music size={48} className="text-text-muted" />
                </div>
              )}
            </div>

            <div className="mt-5">
              <h3 className="text-2xl font-bold leading-tight text-text-primary">{currentTrack.name}</h3>
              <p className="mt-2 text-sm text-text-secondary">{currentTrack.artist}</p>
              <p className="mt-1 text-xs text-text-muted">{currentTrack.album || 'Single'}</p>
            </div>

            {artistDetails ? (
              <div className="mt-6 rounded-[24px] app-panel p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">About the artist</h4>

                {artistDetails.images?.[0]?.url ? (
                  <img
                    src={artistDetails.images[0].url}
                    alt={artistDetails.name}
                    className="mt-4 w-full rounded-[20px] object-cover"
                  />
                ) : null}

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h5 className="truncate text-base font-bold text-text-primary">{artistDetails.name}</h5>
                    {artistDetails.followers?.total !== undefined ? (
                      <p className="mt-1 text-sm text-text-secondary">
                        {artistDetails.followers.total.toLocaleString()} followers
                      </p>
                    ) : null}
                    {artistDetails.genres?.length ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">{artistDetails.genres.slice(0, 4).join(', ')}</p>
                    ) : null}
                  </div>

                  {artistDetails.id ? (
                    <a
                      href={`https://open.spotify.com/artist/${artistDetails.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="app-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                      title="Open artist in Spotify"
                    >
                      <ExternalLink size={12} />
                      Open
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-[24px] app-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">Next in queue</h4>
                  <p className="mt-1 text-xs text-text-secondary">{Math.max(queue.length - currentIndex - 1, 0)} upcoming tracks</p>
                </div>

                {queue.length > currentIndex + 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllQueue(value => !value)}
                    className="text-xs font-medium text-text-secondary hover:text-text-primary"
                  >
                    {showAllQueue ? 'Show less' : 'Show all'}
                  </button>
                ) : null}
              </div>

              {upcoming.length > 0 ? (
                <div className="space-y-2">
                  {upcoming.map((track, index) => {
                    const absoluteIndex = currentIndex + 1 + index;

                    return (
                      <div
                        key={`${track.id}-${absoluteIndex}`}
                        className="group flex items-center gap-3 rounded-[16px] p-2 transition-all app-card app-card-hover"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectQueueIndex?.(absoluteIndex)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          {track.image ? (
                            <img src={track.image} alt={track.name} className="h-10 w-10 rounded-[12px] object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-bg-secondary">
                              <Music size={18} className="text-text-muted" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-primary">{track.name}</p>
                            <p className="truncate text-xs text-text-secondary">{track.artist}</p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2">
                          {track.duration_ms ? (
                            <span className="text-xs tabular-nums text-text-muted">{formatDuration(track.duration_ms)}</span>
                          ) : null}

                          {onRemoveFromQueue ? (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                onRemoveFromQueue(absoluteIndex);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted opacity-70 transition-all hover:bg-danger/12 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                              title="Remove from queue"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No next track.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="app-card mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <Music size={32} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary">No song is currently playing.</p>
          </div>
        )}
      </div>
    </>
  );
}
