import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Clock, Disc, Music, Plus, Search as SearchIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ImportedPlaylist, ImportedTrack, Track } from '../types';
import { buildAppPlaylistRoute } from '../routes';
import { ImportPlaylist } from './ImportPlaylist';
import { SolidPauseIcon, SolidPlayIcon } from './PlaybackIcons';

function parseDurationToMs(dur: string): number {
  if (!dur) return 0;
  const parts = dur.split(':');
  if (parts.length === 2) return (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)) * 1000;
  if (parts.length === 3) return (parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10)) * 1000;
  return 0;
}

function extractSpotifyTrackId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match?.[1];
}

function importedTrackToTrack(t: ImportedTrack, index: number): Track {
  const artistIds = t.artistIds?.filter(Boolean);
  const spotifyTrackId = t.spotifyTrackId || extractSpotifyTrackId(t.url);

  return {
    id: `imported-${index}-${t.name.replace(/\s+/g, '-')}`.slice(0, 50),
    name: t.name,
    artist: t.artist,
    album: t.album,
    duration_ms: parseDurationToMs(t.duration),
    image: t.image || undefined,
    artistId: t.artistId || artistIds?.[0],
    artistIds,
    spotifyTrackId,
    spotifyUrl: t.url || undefined,
  };
}

function importedPlaylistToTracks(playlist: ImportedPlaylist): Track[] {
  return playlist.tracks.map((track, index) => importedTrackToTrack(track, index));
}

function isSameTrack(left?: Track | null, right?: Track | null): boolean {
  if (!left || !right) return false;

  if (left.spotifyTrackId && right.spotifyTrackId) {
    return left.spotifyTrackId === right.spotifyTrackId;
  }

  return left.id === right.id;
}

interface HomeProps {
  activePlaylistId: string | null;
  onTrackSelect: (track: Track, playlist: Track[], contextId?: string) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  setIsPlaying?: Dispatch<SetStateAction<boolean>>;
}

const SONGS_PER_PAGE = 50;

export function Home({ activePlaylistId, onTrackSelect, currentTrack, isPlaying, setIsPlaying }: HomeProps) {
  const navigate = useNavigate();
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]);
  const [playlist, setPlaylist] = useState<ImportedPlaylist | null>(null);
  const [allPlaylists, setAllPlaylists] = useState<ImportedPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [displayCount, setDisplayCount] = useState(SONGS_PER_PAGE);
  const [showImport, setShowImport] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('imported_playlists');
    if (saved) {
      try {
        setAllPlaylists(JSON.parse(saved));
      } catch {
        // Ignore malformed local state.
      }
    }
  }, []);

  useEffect(() => {
    const handleImported = () => {
      const saved = localStorage.getItem('imported_playlists');
      if (saved) {
        try {
          setAllPlaylists(JSON.parse(saved));
        } catch {
          // Ignore malformed local state.
        }
      }
    };

    const handleDeleted = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const id = typeof detail === 'string' ? detail : detail?.id;
      if (!id) return;

      setAllPlaylists(prev => prev.filter(p => p.id !== id));
      if (activePlaylistId === id) {
        setAllTracks([]);
        setFilteredTracks([]);
        setDisplayedTracks([]);
        setPlaylist(null);
      }
    };

    window.addEventListener('playlist-imported', handleImported);
    window.addEventListener('playlist-deleted', handleDeleted);

    return () => {
      window.removeEventListener('playlist-imported', handleImported);
      window.removeEventListener('playlist-deleted', handleDeleted);
    };
  }, [activePlaylistId]);

  useEffect(() => {
    if (!activePlaylistId) {
      setAllTracks([]);
      setFilteredTracks([]);
      setDisplayedTracks([]);
      setPlaylist(null);
      setPlaylistSearchQuery('');
      return;
    }

    setLoading(true);
    setPlaylistSearchQuery('');
    setDisplayCount(SONGS_PER_PAGE);

    const saved = localStorage.getItem('imported_playlists');
    if (saved) {
      try {
        const playlists: ImportedPlaylist[] = JSON.parse(saved);
        const found = playlists.find(item => item.id === activePlaylistId);
        if (found) {
          const tracks = found.tracks.map((track, index) => importedTrackToTrack(track, index));
          setPlaylist(found);
          setAllTracks(tracks);
          setFilteredTracks(tracks);
          setDisplayedTracks(tracks.slice(0, SONGS_PER_PAGE));
        }
      } catch {
        // Ignore malformed local state.
      }
    }

    setLoading(false);
  }, [activePlaylistId]);

  useEffect(() => {
    if (!playlistSearchQuery.trim()) {
      setFilteredTracks(allTracks);
      setDisplayCount(SONGS_PER_PAGE);
      setDisplayedTracks(allTracks.slice(0, SONGS_PER_PAGE));
      return;
    }

    const query = playlistSearchQuery.toLowerCase();
    const filtered = allTracks.filter(track => {
      return track.name.toLowerCase().includes(query)
        || track.artist.toLowerCase().includes(query)
        || track.album.toLowerCase().includes(query);
    });

    setFilteredTracks(filtered);
    setDisplayCount(SONGS_PER_PAGE);
    setDisplayedTracks(filtered.slice(0, SONGS_PER_PAGE));
  }, [playlistSearchQuery, allTracks]);

  useEffect(() => {
    setDisplayedTracks(filteredTracks.slice(0, displayCount));
  }, [displayCount, filteredTracks]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && displayCount < filteredTracks.length) {
          setDisplayCount(prev => Math.min(prev + SONGS_PER_PAGE, filteredTracks.length));
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [displayCount, filteredTracks.length]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;
  };

  const handleTrackClick = (track: Track) => onTrackSelect(track, allTracks, activePlaylistId || undefined);

  const handlePlayPauseClick = (track: Track) => {
    if (!setIsPlaying) {
      handleTrackClick(track);
      return;
    }

    if (isSameTrack(currentTrack, track)) {
      setIsPlaying(prev => !prev);
      return;
    }

    onTrackSelect(track, allTracks, activePlaylistId || undefined);
    setIsPlaying(true);
  };

  const playPlaylist = () => {
    if (!allTracks.length) return;

    if (currentTrack && allTracks.some(track => isSameTrack(track, currentTrack))) {
      setIsPlaying?.(!isPlaying);
      return;
    }

    onTrackSelect(allTracks[0], allTracks, activePlaylistId || undefined);
    setIsPlaying?.(true);
  };

  const playImportedPlaylist = (playlistToPlay: ImportedPlaylist) => {
    const tracks = importedPlaylistToTracks(playlistToPlay);
    if (!tracks.length) return;

    onTrackSelect(tracks[0], tracks, playlistToPlay.id);
    setIsPlaying?.(true);
  };

  const handleImported = (importedPlaylist: ImportedPlaylist) => {
    setShowImport(false);
    navigate(buildAppPlaylistRoute(importedPlaylist.id));
  };

  return (
    <>
      {showImport ? (
        <ImportPlaylist onClose={() => setShowImport(false)} onImported={handleImported} />
      ) : null}

      <div className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {!activePlaylistId && !loading ? (
          <div className="min-h-full px-4 py-6 md:px-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-text-primary">Your Library</h1>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                Import Spotify playlists and keep the album-driven atmosphere, with a cleaner and more focused interface.
              </p>
            </div>

            {allPlaylists.length === 0 ? (
              <div className="app-panel-strong mx-auto max-w-2xl rounded-[20px] px-7 py-12 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full app-card">
                  <Music size={34} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">No playlists yet</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">
                  Import a public Spotify playlist and the app will build a queue around its songs while keeping the UI matched to the music artwork.
                </p>
                <button
                  onClick={() => setShowImport(true)}
                  className="app-button-primary mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
                >
                  <Plus size={18} />
                  Import Playlist
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Imported playlists</p>
                    <p className="mt-1 text-xs text-text-muted">{allPlaylists.length} saved collections</p>
                  </div>
                  <button
                    onClick={() => setShowImport(true)}
                    className="app-button-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                  >
                    <Plus size={16} />
                    Import another
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {allPlaylists.map(item => {
                    const itemTracks = importedPlaylistToTracks(item);
                    const isPlaylistActive = !!currentTrack && itemTracks.some(track => isSameTrack(track, currentTrack));

                    return (
                    <div
                      key={item.id}
                      className="app-card app-card-hover group w-full max-w-[304px] self-start rounded-[16px] p-2.5 text-left"
                      onClick={() => navigate(buildAppPlaylistRoute(item.id))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(buildAppPlaylistRoute(item.id));
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="relative mb-3 aspect-square overflow-hidden rounded-[12px]">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-[12px] bg-bg-secondary">
                            <Music size={28} className="text-text-muted" />
                          </div>
                        )}

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                        <span className="app-badge absolute left-2.5 top-2.5 rounded-lg px-2 py-0.5 text-[10px] font-medium">
                          {item.tracks.length} songs
                        </span>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (isPlaylistActive) {
                              setIsPlaying?.(!isPlaying);
                              return;
                            }
                            playImportedPlaylist(item);
                          }}
                          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full app-button-primary opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-active:opacity-100"
                          aria-label={`${isPlaylistActive && isPlaying ? 'Pause' : 'Play'} ${item.name}`}
                        >
                          {isPlaylistActive && isPlaying ? (
                            <SolidPauseIcon className="h-4 w-4 text-primary-foreground" />
                          ) : (
                            <SolidPlayIcon className="h-4 w-4 text-primary-foreground" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <h3 className="truncate text-sm font-semibold text-text-primary">{item.name}</h3>
                        <p className="line-clamp-2 min-h-[2.25rem] text-[11px] leading-[1.15rem] text-text-secondary">
                          {item.description || item.owner || 'Imported from Spotify'}
                        </p>
                      </div>
                    </div>
                  )})}

                  <button
                    type="button"
                    className="app-card app-card-hover flex w-full max-w-[304px] aspect-square self-start flex-col items-center justify-center rounded-[16px] border-dashed p-2.5 text-center"
                    onClick={() => setShowImport(true)}
                  >
                    <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full app-icon-button">
                      <Plus size={20} className="text-text-primary" />
                    </div>
                    <span className="text-sm font-medium text-text-primary">Import New</span>
                    <span className="mt-1 text-[11px] text-text-muted">Add another playlist</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 rounded-full border-2 border-bg-tertiary border-t-primary animate-spin" />
              <p className="text-sm text-text-muted">Loading playlist...</p>
            </div>
          </div>
        ) : null}

        {activePlaylistId && allTracks.length > 0 && !loading ? (
          <div className="min-h-full px-4 py-5 md:px-6">
            <div className="relative overflow-hidden rounded-[22px] app-panel-strong">
              <div className="absolute inset-0" style={{ background: 'var(--hero-gradient)' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />

              <div className="relative z-10 px-4 py-4 md:px-7 md:py-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-5">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[16px] shadow-elevated md:h-40 md:w-40">
                    {playlist?.image ? (
                      <img src={playlist.image} alt={playlist.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-bg-secondary">
                        <Disc size={56} className="text-text-muted" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="app-badge inline-flex rounded-lg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
                      Playlist
                    </span>
                    <h1 className="mt-2.5 text-[2.1rem] font-bold leading-tight text-text-primary md:mt-3 md:text-[2.5rem]">
                      {playlist?.name || 'Playlist'}
                    </h1>
                    {playlist?.description ? (
                      <p className="mt-2.5 max-w-2xl text-sm leading-6 text-text-secondary line-clamp-2">
                        {playlist.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">{allTracks.length} songs</span>
                      {playlist?.owner ? <span>by {playlist.owner}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2.5 md:mt-5 md:justify-between md:gap-3">
                  <button
                    type="button"
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-glow transition-transform hover:scale-[1.03] ${isPlaying && currentTrack && allTracks.some(track => track.id === currentTrack.id) ? 'app-button-primary' : 'app-button-secondary'}`}
                    onClick={playPlaylist}
                  >
                    {isPlaying && currentTrack && allTracks.some(track => track.id === currentTrack.id) ? (
                      <SolidPauseIcon className="h-5 w-5 text-primary-foreground" />
                    ) : (
                      <SolidPlayIcon className="h-5 w-5 text-text-primary" />
                    )}
                  </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2.5 md:max-w-[320px] md:flex-none">
                    <div
                      className={`app-input-shell flex min-w-0 items-center overflow-hidden rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSearchExpanded ? 'flex-1 w-full' : 'w-10 shrink-0 cursor-pointer'}`}
                      onClick={() => {
                        if (!isSearchExpanded) {
                          setIsSearchExpanded(true);
                          setTimeout(() => searchInputRef.current?.focus(), 100);
                        }
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                        <SearchIcon size={16} className={isSearchExpanded ? 'text-text-secondary' : 'text-text-primary'} />
                      </div>
                      <div className={`flex-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSearchExpanded ? 'opacity-100' : 'w-0 opacity-0'}`}>
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={playlistSearchQuery}
                          onChange={(event) => setPlaylistSearchQuery(event.target.value)}
                          onBlur={() => {
                            if (!playlistSearchQuery) setIsSearchExpanded(false);
                          }}
                          placeholder="Search in playlist"
                          className="w-full bg-transparent py-2 pr-2 text-sm text-text-primary placeholder:text-text-muted outline-none"
                        />
                      </div>
                      {isSearchExpanded && playlistSearchQuery ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPlaylistSearchQuery('');
                            searchInputRef.current?.focus();
                          }}
                          className="mr-2 flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:text-text-primary"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>

                    {playlistSearchQuery ? (
                      <span className="app-badge shrink-0 rounded-lg px-2.5 py-0.5 text-[11px]">{filteredTracks.length} results</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] app-panel px-2.5 pb-3 pt-2 md:px-3">
              {filteredTracks.length > 0 ? (
                <>
                  <div className="grid grid-cols-[40px_1fr_auto] gap-3 border-b border-border/20 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted md:grid-cols-[46px_minmax(0,4fr)_minmax(0,3fr)_minmax(72px,1fr)]">
                    <div className="text-left md:text-center">#</div>
                    <div>Title</div>
                    <div className="hidden md:block">Album</div>
                    <div className="flex justify-end">
                      <Clock size={14} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-1.5">
                    {displayedTracks.map((track, index) => {
                      const isActive = isSameTrack(currentTrack, track);

                      return (
                        <div
                          key={`${track.id}-${index}`}
                          className={`grid cursor-pointer grid-cols-[40px_1fr_auto] gap-3 rounded-[14px] px-3 py-2.5 text-left md:grid-cols-[46px_minmax(0,4fr)_minmax(0,3fr)_minmax(72px,1fr)] ${isActive ? 'app-card app-card-active' : 'app-card app-card-hover'}`}
                          onClick={() => handleTrackClick(track)}
                          onMouseEnter={() => setHoveredTrack(track.id)}
                          onMouseLeave={() => setHoveredTrack(null)}
                        >
                          <div className="flex items-center justify-center text-text-muted">
                            {hoveredTrack === track.id || isActive ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handlePlayPauseClick(track);
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'app-button-primary' : 'app-icon-button'}`}
                              >
                                {isActive && isPlaying ? (
                                  <SolidPauseIcon className={`h-3.5 w-3.5 ${isActive ? 'text-primary-foreground' : 'text-text-primary'}`} />
                                ) : (
                                  <SolidPlayIcon className={`h-3.5 w-3.5 ${isActive ? 'text-primary-foreground' : 'text-text-primary'}`} />
                                )}
                              </button>
                            ) : (
                              <span className={`text-sm ${isActive ? 'text-primary' : 'text-text-muted'}`}>{index + 1}</span>
                            )}
                          </div>

                          <div className="flex min-w-0 items-center gap-3">
                            {track.image ? (
                              <img
                                src={track.image}
                                className="h-10 w-10 shrink-0 rounded-[10px] object-cover shadow-card"
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-bg-secondary">
                                <Music size={16} className="text-text-muted" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <span className={`block truncate text-[13px] font-medium ${isActive ? 'text-primary' : 'text-text-primary'}`}>
                                {track.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-text-secondary">
                                {track.artist}
                              </span>
                            </div>
                          </div>

                          <div className={`hidden min-w-0 items-center text-[13px] md:flex ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
                            <span className="truncate">{track.album}</span>
                          </div>

                          <div className={`flex items-center justify-end text-[13px] tabular-nums ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {formatDuration(track.duration_ms)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {displayCount < filteredTracks.length ? (
                    <div ref={observerTarget} className="flex justify-center py-6">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Loading more...
                      </div>
                    </div>
                  ) : null}

                  {displayCount >= filteredTracks.length && filteredTracks.length > 20 ? (
                    <div className="py-6 text-center text-xs text-text-muted">{filteredTracks.length} songs</div>
                  ) : null}
                </>
              ) : playlistSearchQuery ? (
                <div className="py-14 text-center">
                  <p className="text-base text-text-secondary">No songs match "{playlistSearchQuery}"</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activePlaylistId && allTracks.length === 0 && !loading ? (
          <div className="px-4 py-16 md:px-6">
            <div className="app-panel mx-auto max-w-xl rounded-[20px] px-7 py-12 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full app-card">
                <Music size={36} className="text-text-muted" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">Playlist not found</h2>
              <p className="mt-3 text-sm text-text-secondary">This playlist may have been removed from your local library.</p>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
