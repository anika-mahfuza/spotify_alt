import { useEffect, useState, useRef, Dispatch, SetStateAction, useMemo } from 'react';
import { Clock, Play, Pause, Search as SearchIcon, X, Music, Disc, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Track, ImportedPlaylist, ImportedTrack } from '../types';
import { ImportPlaylist } from './ImportPlaylist';

function parseDurationToMs(dur: string): number {
  if (!dur) return 0;
  const parts = dur.split(':');
  if (parts.length === 2) return (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000;
  if (parts.length === 3) return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])) * 1000;
  return 0;
}

function importedTrackToTrack(t: ImportedTrack, index: number): Track {
  return {
    id: `imported-${index}-${t.name.replace(/\s+/g, '-')}`.slice(0, 50),
    name: t.name,
    artist: t.artist,
    album: t.album,
    duration_ms: parseDurationToMs(t.duration),
    image: t.image || undefined,
  };
}

interface HomeProps {
  activePlaylistId: string | null;
  onTrackSelect: (track: Track, playlist: Track[], contextId?: string) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  setIsPlaying?: Dispatch<SetStateAction<boolean>>;
  playingContextId?: string | null;
}

const SONGS_PER_PAGE = 50;

export function Home({ activePlaylistId, onTrackSelect, currentTrack, isPlaying, setIsPlaying, playingContextId }: HomeProps) {
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

  // Load all imported playlists
  useEffect(() => {
    const saved = localStorage.getItem('imported_playlists');
    if (saved) {
      try { setAllPlaylists(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Listen for playlist imports/deletes from any component
  useEffect(() => {
    const handleImported = () => {
      const saved = localStorage.getItem('imported_playlists');
      if (saved) {
        try { setAllPlaylists(JSON.parse(saved)); } catch { /* ignore */ }
      }
    };

    const handleDeleted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const id = typeof detail === 'string' ? detail : detail?.id;
      if (id) {
        setAllPlaylists(prev => prev.filter(p => p.id !== id));
        // Clear tracks if viewing deleted playlist
        if (activePlaylistId === id) {
          setAllTracks([]);
          setFilteredTracks([]);
          setDisplayedTracks([]);
          setPlaylist(null);
        }
      }
    };

    window.addEventListener('playlist-imported', handleImported);
    window.addEventListener('playlist-deleted', handleDeleted);
    return () => {
      window.removeEventListener('playlist-imported', handleImported);
      window.removeEventListener('playlist-deleted', handleDeleted);
    };
  }, [activePlaylistId]);

  // Load specific playlist
  useEffect(() => {
    if (activePlaylistId) {
      setLoading(true);
      setPlaylistSearchQuery('');
      setDisplayCount(SONGS_PER_PAGE);

      const saved = localStorage.getItem('imported_playlists');
      if (saved) {
        try {
          const playlists: ImportedPlaylist[] = JSON.parse(saved);
          const found = playlists.find(p => p.id === activePlaylistId);
          if (found) {
            setPlaylist(found);
            const tracks = found.tracks.map((t, i) => importedTrackToTrack(t, i));
            setAllTracks(tracks);
            setFilteredTracks(tracks);
            setDisplayedTracks(tracks.slice(0, SONGS_PER_PAGE));
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    } else {
      setAllTracks([]);
      setFilteredTracks([]);
      setDisplayedTracks([]);
      setPlaylist(null);
      setPlaylistSearchQuery('');
    }
  }, [activePlaylistId]);

  // Filter tracks
  useEffect(() => {
    if (playlistSearchQuery.trim()) {
      const query = playlistSearchQuery.toLowerCase();
      const filtered = allTracks.filter(track =>
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
      setFilteredTracks(filtered);
      setDisplayCount(SONGS_PER_PAGE);
      setDisplayedTracks(filtered.slice(0, SONGS_PER_PAGE));
    } else {
      setFilteredTracks(allTracks);
      setDisplayCount(SONGS_PER_PAGE);
      setDisplayedTracks(allTracks.slice(0, SONGS_PER_PAGE));
    }
  }, [playlistSearchQuery, allTracks]);

  useEffect(() => {
    setDisplayedTracks(filteredTracks.slice(0, displayCount));
  }, [displayCount, filteredTracks]);

  // Infinite scroll
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
    return () => { if (currentTarget) observer.unobserve(currentTarget); };
  }, [displayCount, filteredTracks.length]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return minutes + ":" + (Number(seconds) < 10 ? '0' : '') + seconds;
  };

  const handleTrackClick = (track: Track) => onTrackSelect(track, allTracks, activePlaylistId || undefined);

  const handlePlayPauseClick = (track: Track) => {
    if (!setIsPlaying) { handleTrackClick(track); return; }
    if (currentTrack?.id === track.id) { setIsPlaying(prev => !prev); return; }
    onTrackSelect(track, allTracks, activePlaylistId || undefined);
    setIsPlaying(true);
  };

  const playPlaylist = () => {
    if (!allTracks.length) return;
    if (playingContextId === activePlaylistId) {
      setIsPlaying && setIsPlaying(!isPlaying);
      return;
    }
    onTrackSelect(allTracks[0], allTracks, activePlaylistId || undefined);
    setIsPlaying && setIsPlaying(true);
  };

  const headerGradient = useMemo(() => {
    const colors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#4a0e4e', '#2c3e50', '#1e3c72'];
    const key = activePlaylistId || 'home';
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return colors[hash % colors.length];
  }, [activePlaylistId]);

  const handleImported = (p: ImportedPlaylist) => {
    // Event listener will update state from localStorage
    setShowImport(false);
    navigate(`/playlist/${p.id}`);
  };

  return (
    <>
      {showImport && (
        <ImportPlaylist onClose={() => setShowImport(false)} onImported={handleImported} />
      )}

      <style>{`
        .play-btn-hover:hover {
          background-color: var(--accent-color-hover, var(--accent-color, #1ed760)) !important;
          background: var(--accent-color-hover, var(--accent-color, #1ed760)) !important;
        }
      `}</style>
      <div className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {/* HOME VIEW */}
        {!activePlaylistId && !loading && (
          <div className="min-h-full">
            <div className="px-6 pt-6 pb-5">
              <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Your Library</h1>
              <p className="text-sm text-white/40 mb-6">Import Spotify playlists to start listening</p>

              {allPlaylists.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Music size={36} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">No playlists yet</h2>
                  <p className="text-text-muted max-w-md mx-auto mb-6">
                    Import a Spotify playlist to get started. Paste any public playlist URL and we'll fetch all the tracks for you.
                  </p>
                  <button
                    onClick={() => setShowImport(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-black font-semibold rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Plus size={18} />
                    Import Playlist
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {allPlaylists.map(p => (
                    <div
                      key={p.id}
                      className="group bg-white/5 hover:bg-white/10 backdrop-blur-md p-3 rounded-md transition-all duration-200 cursor-pointer border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl hover:scale-[1.02] flex-shrink-0"
                      onClick={() => navigate(`/playlist/${p.id}`)}
                    >
                      <div className="relative mb-3 aspect-square rounded overflow-hidden">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-white/5 backdrop-blur-sm flex items-center justify-center">
                            <Music size={32} className="text-text-muted" />
                          </div>
                        )}
                        <button
                          className="absolute right-2 bottom-2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg play-btn-hover bg-white/60 opacity-0 translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0 group-active:opacity-100 group-active:translate-y-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const tracks = p.tracks.map((t, i) => importedTrackToTrack(t, i));
                            if (tracks.length > 0) {
                              onTrackSelect(tracks[0], tracks, p.id);
                              setIsPlaying && setIsPlaying(true);
                            }
                          }}
                        >
                          <Play size={18} className="ml-0.5 text-white" fill="white" />
                        </button>
                      </div>
                      <h3 className="font-medium text-sm truncate text-white mb-0.5">{p.name}</h3>
                      <p className="text-xs text-white/60 truncate">{p.tracks.length} songs</p>
                    </div>
                  ))}

                  {/* Add new playlist card */}
                  <div
                    className="group bg-white/5 hover:bg-white/10 backdrop-blur-md p-3 rounded-md transition-all duration-200 cursor-pointer border border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center aspect-square"
                    onClick={() => setShowImport(true)}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2">
                      <Plus size={24} className="text-white/60" />
                    </div>
                    <span className="text-sm text-white/60">Import New</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-bg-tertiary border-t-primary rounded-full animate-spin"></div>
              <p className="text-text-muted text-sm">Loading...</p>
            </div>
          </div>
        )}

        {/* PLAYLIST VIEW */}
        {activePlaylistId && allTracks.length > 0 && !loading && (
          <div className="min-h-full">
            <div
              className="px-6 pt-12 pb-5"
              style={{ background: `linear-gradient(180deg, ${headerGradient} 0%, transparent 100%)` }}
            >
              <div className="flex gap-5 items-end mb-5">
                <div className="w-40 h-40 lg:w-48 lg:h-48 flex-shrink-0 shadow-elevated">
                  {playlist?.image ? (
                    <img src={playlist.image} alt={playlist.name} className="w-full h-full object-cover shadow-card rounded" />
                  ) : (
                    <div className="w-full h-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 rounded">
                      <Disc size={56} className="text-text-muted" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-end">
                  <span className="text-xs font-medium uppercase text-white mb-1.5">Playlist</span>
                  <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3 leading-tight">
                    {playlist?.name || 'Playlist'}
                  </h1>
                  {playlist?.description && (
                    <p className="text-text-muted text-sm mb-1.5 line-clamp-2">{playlist.description}</p>
                  )}
                  <p className="text-text-muted text-sm">
                    <span className="font-medium text-white">{allTracks.length} songs</span>
                    {playlist?.owner && <span> • {playlist.owner}</span>}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 flex items-center gap-5 bg-white/5 backdrop-blur-xl border-b border-white/10">
              <button
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-[1.05] ${isPlaying && currentTrack && allTracks.some(t => t.id === currentTrack.id) ? 'bg-primary hover:bg-primary-hover' : 'bg-white hover:bg-gray-200'}`}
                onClick={playPlaylist}
              >
                {isPlaying && currentTrack && allTracks.some(t => t.id === currentTrack.id) ? (
                  <Pause size={28} fill="black" className="text-black" />
                ) : (
                  <Play size={28} fill="black" className="text-black ml-1" />
                )}
              </button>

              <div className="ml-auto flex items-center gap-4">
                <div
                  className={`flex items-center rounded-md overflow-hidden transition-all duration-200 ${isSearchExpanded ? 'w-56 bg-white/10 backdrop-blur-md border border-white/20' : 'w-8 h-8 hover:text-white cursor-pointer'}`}
                  onClick={() => {
                    if (!isSearchExpanded) {
                      setIsSearchExpanded(true);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }
                  }}
                >
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8">
                    <SearchIcon size={16} className={isSearchExpanded ? 'text-white' : 'text-text-secondary'} />
                  </div>
                  <div className={`flex-1 overflow-hidden transition-all duration-200 ${isSearchExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={playlistSearchQuery}
                      onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                      onBlur={() => { if (!playlistSearchQuery) setIsSearchExpanded(false); }}
                      placeholder="Search in playlist"
                      className="w-full bg-transparent text-sm text-white placeholder:text-text-muted outline-none py-2 pr-2"
                    />
                  </div>
                  {isSearchExpanded && playlistSearchQuery && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="mr-2 text-text-secondary hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {playlistSearchQuery && (
                  <span className="text-xs text-text-muted">{filteredTracks.length} results</span>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              {filteredTracks.length > 0 ? (
                <>
                  <div className="grid grid-cols-[36px_1fr_auto] md:grid-cols-[16px_4fr_3fr_minmax(80px,1fr)] gap-3 px-3 py-2 text-xs font-bold text-white uppercase tracking-wider border-b border-white/20 sticky top-0 bg-transparent z-10 rounded-t-lg drop-shadow-md">
                    <div className="text-left md:text-center">#</div>
                    <div>Title</div>
                    <div className="hidden md:block">Album</div>
                    <div className="flex justify-end">
                      <Clock size={14} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 mt-1">
                    {displayedTracks.map((track, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className={`grid grid-cols-[36px_1fr_auto] md:grid-cols-[16px_4fr_3fr_minmax(80px,1fr)] gap-3 px-3 py-2 group bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-md cursor-pointer transition-all border border-white/10 hover:border-white/20 ${currentTrack?.id === track.id ? 'bg-white/10 border-white/30' : ''}`}
                        onClick={() => handleTrackClick(track)}
                        onMouseEnter={() => setHoveredTrack(track.id)}
                        onMouseLeave={() => setHoveredTrack(null)}
                      >
                        <div className="flex items-center justify-center text-text-muted w-4">
                          {hoveredTrack === track.id || currentTrack?.id === track.id ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePlayPauseClick(track); }}
                              className={currentTrack?.id === track.id ? 'text-primary' : 'text-white'}
                            >
                              {currentTrack?.id === track.id && isPlaying ? (
                                <Pause size={14} fill="currentColor" />
                              ) : (
                                <Play size={14} fill="currentColor" />
                              )}
                            </button>
                          ) : (
                            <span className={`text-sm ${currentTrack?.id === track.id ? 'text-primary' : ''}`}>
                              {index + 1}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={track.image || 'https://via.placeholder.com/40'}
                            className="w-9 h-9 object-cover flex-shrink-0 rounded shadow-card"
                            alt=""
                            loading="lazy"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-medium truncate ${currentTrack?.id === track.id ? 'text-primary' : 'text-white'}`}>
                              {track.name}
                            </span>
                            <span className="text-xs text-text-muted truncate hover:text-white cursor-pointer">
                              {track.artist}
                            </span>
                          </div>
                        </div>

                        <div className={`hidden md:flex items-center text-sm truncate hover:text-white cursor-pointer min-w-0 ${currentTrack?.id === track.id ? 'text-white/90' : 'text-text-muted'}`}>
                          <span className="truncate">{track.album}</span>
                        </div>

                        <div className={`flex items-center justify-end text-sm tabular-nums ${currentTrack?.id === track.id ? 'text-white/90' : 'text-text-muted'}`}>
                          {formatDuration(track.duration_ms)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {displayCount < filteredTracks.length && (
                    <div ref={observerTarget} className="flex justify-center py-6">
                      <div className="flex items-center gap-2 text-text-muted text-xs">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading more...
                      </div>
                    </div>
                  )}

                  {displayCount >= filteredTracks.length && filteredTracks.length > 20 && (
                    <div className="text-center py-6 text-text-muted text-xs">
                      {filteredTracks.length} songs
                    </div>
                  )}
                </>
              ) : playlistSearchQuery ? (
                <div className="text-center py-12">
                  <p className="text-text-muted text-base">No songs match "{playlistSearchQuery}"</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* EMPTY PLAYLIST */}
        {activePlaylistId && allTracks.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10">
              <Music size={36} className="text-text-muted" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Playlist not found</h2>
            <p className="text-text-muted">This playlist may have been removed.</p>
          </div>
        )}
      </div>
    </>
  );
}
