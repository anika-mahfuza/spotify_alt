import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2, Music, Trash2, X } from 'lucide-react';
import { Artist, ArtistPlaylist, Track } from '../types';
import { SolidPauseIcon, SolidPlayIcon } from './PlaybackIcons';

interface NowPlayingSidebarProps {
  currentTrack: Track | null;
  artistDetails: Artist | null;
  artistPlaylists?: ArtistPlaylist[];
  isPlaying: boolean;
  onClose: () => void;
  queue?: Track[];
  currentIndex?: number;
  onSelectQueueIndex?: (index: number) => void;
  onRemoveFromQueue?: (index: number) => void;
  onPlayArtistTopTrack?: (index: number) => void;
  onOpenArtistPlaylist?: (playlist: ArtistPlaylist) => Promise<void>;
  onPlayArtistPlaylist?: (playlist: ArtistPlaylist) => Promise<void>;
  width: number;
  setWidth: (width: number) => void;
}

export function NowPlayingSidebar({
  currentTrack,
  artistDetails,
  artistPlaylists = [],
  isPlaying,
  onClose,
  queue = [],
  currentIndex = 0,
  onSelectQueueIndex,
  onRemoveFromQueue,
  onPlayArtistTopTrack,
  onOpenArtistPlaylist,
  onPlayArtistPlaylist,
  width,
  setWidth,
}: NowPlayingSidebarProps) {
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [hoveredTopTrack, setHoveredTopTrack] = useState<string | null>(null);
  const [selectedArtistPlaylist, setSelectedArtistPlaylist] = useState<ArtistPlaylist | null>(null);
  const [playlistAction, setPlaylistAction] = useState<'open' | 'play' | null>(null);
  const [playlistActionError, setPlaylistActionError] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentTrack?.id, currentTrack?.spotifyTrackId]);

  useEffect(() => {
    setSelectedArtistPlaylist(null);
    setPlaylistAction(null);
    setPlaylistActionError(null);
  }, [currentTrack?.id, currentTrack?.spotifyTrackId]);

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

  const handlePlaylistPreviewAction = useCallback(async (action: 'open' | 'play') => {
    if (!selectedArtistPlaylist) return;

    setPlaylistAction(action);
    setPlaylistActionError(null);

    try {
      if (action === 'open') {
        await onOpenArtistPlaylist?.(selectedArtistPlaylist);
      } else {
        await onPlayArtistPlaylist?.(selectedArtistPlaylist);
      }
    } catch (error) {
      setPlaylistActionError(error instanceof Error ? error.message : 'Playlist action failed.');
    } finally {
      setPlaylistAction(null);
    }
  }, [onOpenArtistPlaylist, onPlayArtistPlaylist, selectedArtistPlaylist]);

  return (
    <>
      {!isDesktop ? (
        <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm lg:hidden animate-fadeIn" onClick={onClose} />
      ) : null}

      <div
        ref={sidebarRef}
        className={`fixed right-0 top-0 z-[60] relative flex h-screen flex-col border-l border-border/50 bg-bg-primary/22 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.14)] backdrop-blur-2xl lg:static ${isResizing ? 'select-none' : ''}`}
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
          <div ref={contentRef} className="flex-1 overflow-y-auto">
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
                    {artistDetails.subtitle ? (
                      <p className="mt-1 text-sm text-text-secondary">{artistDetails.subtitle}</p>
                    ) : null}
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
                      href={artistDetails.externalUrl || `https://open.spotify.com/artist/${artistDetails.id}`}
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

                {artistDetails.bio ? (
                  <div className="mt-4">
                    <p className="text-sm leading-6 text-text-secondary">
                      {artistDetails.bio}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {artistPlaylists.length ? (
              <div className="mt-6 rounded-[24px] app-panel p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">More playlists</h4>
                  <p className="mt-1 text-xs text-text-secondary">From Spotify artist page</p>
                </div>

                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {artistPlaylists.map(playlist => (
                    <button
                      key={playlist.id}
                      type="button"
                      onClick={() => {
                        setSelectedArtistPlaylist(playlist);
                        setPlaylistAction(null);
                        setPlaylistActionError(null);
                      }}
                      className="w-[132px] shrink-0 text-left"
                    >
                      <div className="rounded-[18px] app-card app-card-hover p-2.5">
                        {playlist.image ? (
                          <img
                            src={playlist.image}
                            alt={playlist.name}
                            className="aspect-square w-full rounded-[14px] object-cover"
                          />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center rounded-[14px] bg-bg-secondary">
                            <Music size={20} className="text-text-muted" />
                          </div>
                        )}
                        <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-text-primary">{playlist.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {artistDetails?.topTracks?.length ? (
              <div className="mt-6 rounded-[24px] app-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">Top tracks</h4>
                    <p className="mt-1 text-xs text-text-secondary">From Spotify artist embed</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {artistDetails.topTracks.slice(0, 5).map((track, index) => {
                    const isActiveTrack = currentTrack?.spotifyTrackId === track.id || currentTrack?.id === track.id;
                    const showPlaybackIcon = hoveredTopTrack === track.id || isActiveTrack;

                    return (
                      <button
                        key={`${track.id}-${index}`}
                        type="button"
                        onClick={() => onPlayArtistTopTrack?.(index)}
                        onMouseEnter={() => setHoveredTopTrack(track.id)}
                        onMouseLeave={() => setHoveredTopTrack(null)}
                        className={`flex w-full items-center gap-3 rounded-[16px] p-2 text-left transition-all ${
                          isActiveTrack
                            ? 'app-card bg-[rgb(var(--accent-color-rgb)/0.16)]'
                            : 'app-card app-card-hover'
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center text-text-muted">
                          {showPlaybackIcon ? (
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isActiveTrack ? 'app-button-primary' : 'app-icon-button'}`}>
                              {isActiveTrack && isPlaying ? (
                                <SolidPauseIcon className={`h-3.5 w-3.5 ${isActiveTrack ? 'text-primary-foreground' : 'text-text-primary'}`} />
                              ) : (
                                <SolidPlayIcon className={`h-3.5 w-3.5 ${isActiveTrack ? 'text-primary-foreground' : 'text-text-primary'}`} />
                              )}
                            </span>
                          ) : (
                            <span className={`text-sm ${isActiveTrack ? 'text-primary' : 'text-text-muted'}`}>{index + 1}</span>
                          )}
                        </div>

                        {track.image ? (
                          <img
                            src={track.image}
                            alt={track.name}
                            className="h-10 w-10 shrink-0 rounded-[12px] object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-bg-secondary">
                            <Music size={16} className="text-text-muted" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{track.name}</p>
                          {track.artist ? (
                            <p className="truncate text-xs text-text-secondary">{track.artist}</p>
                          ) : null}
                        </div>

                        {track.duration_ms ? (
                          <span className="text-xs tabular-nums text-text-muted">{formatDuration(track.duration_ms)}</span>
                        ) : null}
                      </button>
                    );
                  })}
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

        {selectedArtistPlaylist ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-bg-primary/62 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedArtistPlaylist(null);
                  setPlaylistAction(null);
                  setPlaylistActionError(null);
                }}
                className="app-button-secondary inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium"
              >
                <ArrowLeft size={14} />
                Back
              </button>

              <a
                href={selectedArtistPlaylist.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="app-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
                title="Open playlist in Spotify"
              >
                <ExternalLink size={12} />
                Spotify
              </a>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="overflow-hidden rounded-[26px] app-panel shadow-elevated">
                {selectedArtistPlaylist.image ? (
                  <img src={selectedArtistPlaylist.image} alt={selectedArtistPlaylist.name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-bg-secondary">
                    <Music size={44} className="text-text-muted" />
                  </div>
                )}
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Artist playlist</p>
                <h4 className="mt-2 text-2xl font-bold leading-tight text-text-primary">{selectedArtistPlaylist.name}</h4>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Open the full playlist page in the app or start playing it from track 1.
                </p>
              </div>

              {playlistActionError ? (
                <p className="mt-4 text-sm text-danger">{playlistActionError}</p>
              ) : null}

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => handlePlaylistPreviewAction('open')}
                  disabled={playlistAction !== null}
                  className="app-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-70"
                >
                  {playlistAction === 'open' ? <Loader2 size={16} className="animate-spin" /> : null}
                  {playlistAction === 'open' ? 'Opening playlist...' : 'Open playlist'}
                </button>

                <button
                  type="button"
                  onClick={() => handlePlaylistPreviewAction('play')}
                  disabled={playlistAction !== null}
                  className="app-button-secondary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-70"
                >
                  {playlistAction === 'play' ? <Loader2 size={16} className="animate-spin" /> : null}
                  {playlistAction === 'play' ? 'Starting playback...' : 'Play now'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
