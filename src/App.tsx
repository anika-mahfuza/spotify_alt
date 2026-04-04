import { useState, useEffect, useRef, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { NowPlayingSidebar } from './components/NowPlayingSidebar';
import { Player } from './components/Player';
import { Home } from './components/Home';
import { LandingPage } from './components/LandingPage';
import { SearchBar } from './components/SearchBar';
import { ResultList } from './components/ResultList';
import { config } from './config';
import { APP_HOME_ROUTE, APP_PLAYLIST_ROUTE, LANDING_ROUTE, buildAppPlaylistRoute, normalizeAppPath } from './routes';
import { Artist, ArtistPlaylist, ImportedPlaylist, ImportedTrack, Track } from './types';
import { ChevronUp, Music } from 'lucide-react';
import { applyAlbumTheme, DEFAULT_ALBUM_THEME, extractAlbumTheme } from './utils/colorExtractor';
import { DynamicBackground } from './components/DynamicBackground';
import { importOrReuseSpotifyPlaylist } from './utils/spotifyPlaylistImport';
import './index.css';
import './App.css';
import './styles/global.css';
import './styles/accent.css';

interface Video {
  id: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
}

function extractSpotifyTrackId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match?.[1];
}

function normalizeLookup(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

function getImportedPlaylistsSnapshot(): ImportedPlaylist[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem('imported_playlists');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function hasNonAscii(value?: string): boolean {
  return Array.from(String(value || '')).some(char => char.charCodeAt(0) > 127);
}

function shouldRepairImportedTrack(track: ImportedTrack): boolean {
  return !!(track.spotifyTrackId || extractSpotifyTrackId(track.url)) && hasNonAscii(track.artist);
}

interface SpotifyTrackDetailsResponse {
  id: string;
  name?: string;
  artist?: string;
  artistId?: string;
  artistIds?: string[];
  image?: string;
  spotifyUrl?: string;
}

function parseDurationToMs(duration: string): number {
  const parts = String(duration || '').split(':').map(part => parseInt(part, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

function importedTrackToPlayableTrack(track: ImportedTrack, index: number, playlistId?: string): Track {
  const spotifyTrackId = track.spotifyTrackId || extractSpotifyTrackId(track.url);
  const artistIds = track.artistIds?.filter(Boolean);

  return {
    id: `${playlistId || 'imported'}-${index}-${track.name.replace(/\s+/g, '-')}`.slice(0, 80),
    name: track.name,
    artist: track.artist,
    album: track.album,
    duration_ms: track.durationMs || parseDurationToMs(track.duration),
    image: track.image || undefined,
    artistId: track.artistId || artistIds?.[0],
    artistIds,
    spotifyTrackId,
    spotifyUrl: track.url || undefined,
  };
}

function importedPlaylistToPlayableTracks(playlist: ImportedPlaylist): Track[] {
  return playlist.tracks.map((track, index) => importedTrackToPlayableTrack(track, index, playlist.id));
}

async function repairImportedPlaylists(apiUrl: string, signal?: AbortSignal): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const raw = window.localStorage.getItem('imported_playlists');
  if (!raw) return false;

  let playlists: ImportedPlaylist[];
  try {
    playlists = JSON.parse(raw);
  } catch {
    return false;
  }

  const trackIds = [...new Set(
    playlists
      .flatMap(playlist => playlist.tracks)
      .filter(shouldRepairImportedTrack)
      .map(track => track.spotifyTrackId || extractSpotifyTrackId(track.url))
      .filter(Boolean)
  )] as string[];

  if (!trackIds.length) return false;

  const detailsMap = new Map<string, SpotifyTrackDetailsResponse>();
  const batchSize = 6;

  for (let index = 0; index < trackIds.length; index += batchSize) {
    const batch = trackIds.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(async trackId => {
      try {
        const response = await fetch(`${apiUrl}/api/track-details?trackId=${encodeURIComponent(trackId)}`, { signal });
        if (!response.ok) return null;
        const details: SpotifyTrackDetailsResponse = await response.json();
        return [trackId, details] as const;
      } catch {
        return null;
      }
    }));

    for (const result of results) {
      if (!result) continue;
      detailsMap.set(result[0], result[1]);
    }
  }

  if (!detailsMap.size) return false;

  let changed = false;
  const nextPlaylists = playlists.map(playlist => ({
    ...playlist,
    tracks: playlist.tracks.map(track => {
      const trackId = track.spotifyTrackId || extractSpotifyTrackId(track.url);
      const details = trackId ? detailsMap.get(trackId) : undefined;
      if (!details) return track;

      const nextTrack: ImportedTrack = {
        ...track,
        name: details.name || track.name,
        artist: details.artist || track.artist,
        image: details.image || track.image,
        artistId: details.artistId || track.artistId,
        artistIds: details.artistIds?.length ? details.artistIds : track.artistIds,
        spotifyTrackId: track.spotifyTrackId || trackId,
        url: details.spotifyUrl || track.url,
      };

      if (
        nextTrack.name !== track.name ||
        nextTrack.artist !== track.artist ||
        nextTrack.image !== track.image ||
        nextTrack.artistId !== track.artistId ||
        nextTrack.url !== track.url ||
        JSON.stringify(nextTrack.artistIds || []) !== JSON.stringify(track.artistIds || [])
      ) {
        changed = true;
      }

      return nextTrack;
    }),
  }));

  if (!changed) return false;

  window.localStorage.setItem('imported_playlists', JSON.stringify(nextPlaylists));
  window.dispatchEvent(new Event('playlist-imported'));
  return true;
}

function enrichTrackWithImportedMetadata(track: Track | null): Track | null {
  if (!track || track.isYoutube) return track;

  const targetName = normalizeLookup(track.name);
  const targetArtist = normalizeLookup(track.artist);
  const targetAlbum = normalizeLookup(track.album);
  const targetSpotifyTrackId = track.spotifyTrackId || extractSpotifyTrackId(track.spotifyUrl);

  for (const playlist of getImportedPlaylistsSnapshot()) {
    for (const importedTrack of playlist.tracks) {
      const importedSpotifyTrackId = importedTrack.spotifyTrackId || extractSpotifyTrackId(importedTrack.url);
      const sameSpotifyTrack = !!targetSpotifyTrackId && importedSpotifyTrackId === targetSpotifyTrackId;
      const sameName = normalizeLookup(importedTrack.name) === targetName;
      const sameArtist = normalizeLookup(importedTrack.artist) === targetArtist;
      const sameAlbum = !targetAlbum || normalizeLookup(importedTrack.album) === targetAlbum;

      if (!sameSpotifyTrack && (!sameName || !sameArtist || !sameAlbum)) continue;

      const artistIds = importedTrack.artistIds?.filter(Boolean);
      const spotifyTrackId = importedTrack.spotifyTrackId || extractSpotifyTrackId(importedTrack.url);
      const nextArtistId = track.artistId || importedTrack.artistId || artistIds?.[0];
      const nextArtistIds = track.artistIds?.length ? track.artistIds : artistIds;
      const nextSpotifyTrackId = track.spotifyTrackId || spotifyTrackId;
      const nextSpotifyUrl = track.spotifyUrl || importedTrack.url || undefined;

      if (
        importedTrack.name === track.name &&
        importedTrack.artist === track.artist &&
        importedTrack.album === track.album &&
        (track.image || importedTrack.image || undefined) === track.image &&
        nextArtistId === track.artistId &&
        nextArtistIds === track.artistIds &&
        nextSpotifyTrackId === track.spotifyTrackId &&
        nextSpotifyUrl === track.spotifyUrl
      ) {
        return track;
      }

      return {
        ...track,
        name: importedTrack.name || track.name,
        artist: importedTrack.artist || track.artist,
        album: importedTrack.album || track.album,
        image: track.image || importedTrack.image || undefined,
        artistId: nextArtistId,
        artistIds: nextArtistIds,
        spotifyTrackId: nextSpotifyTrackId,
        spotifyUrl: nextSpotifyUrl,
      };
    }
  }

  return track;
}

function buildArtistTopTrackQueue(artistDetails: Artist | null): Track[] {
  if (!artistDetails?.topTracks?.length) return [];

  return artistDetails.topTracks.map(track => {
    const artistIds = track.artistIds?.filter(Boolean);

    return {
      id: track.id,
      name: track.name,
      artist: track.artist || artistDetails.name,
      album: `${artistDetails.name} top tracks`,
      duration_ms: track.duration_ms || 0,
      image: track.image || artistDetails.images?.[0]?.url,
      artistId: track.artistId || artistIds?.[0] || artistDetails.id,
      artistIds: artistIds?.length ? artistIds : artistDetails.id ? [artistDetails.id] : undefined,
      spotifyTrackId: track.id,
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
    };
  });
}

interface MainContentProps {
  currentTrack: Track | null;
  setCurrentTrack: Dispatch<SetStateAction<Track | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  isMobileMenuOpen: boolean;
  isNowPlayingSidebarOpen: boolean;
  setIsNowPlayingSidebarOpen: (isOpen: boolean) => void;
  sidebarWidth: number;
  queue: Track[];
  setQueue: Dispatch<SetStateAction<Track[]>>;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onToggleMenu: () => void;
}

function MainContent({
  currentTrack,
  setCurrentTrack,
  isPlaying,
  setIsPlaying,
  isMobileMenuOpen,
  isNowPlayingSidebarOpen,
  setIsNowPlayingSidebarOpen,
  sidebarWidth,
  queue,
  setQueue,
  currentIndex,
  setCurrentIndex,
  onToggleMenu
}: MainContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 1024);
  const didRestoreLastPath = useRef(false);
  const replayNonceRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const matchPlaylist = useMatch(APP_PLAYLIST_ROUTE);
  const location = useLocation();
  const navigate = useNavigate();
  const activePlaylistId = matchPlaylist?.params.id || null;

  // Restore last visited page
  useEffect(() => {
    if (didRestoreLastPath.current) return;
    didRestoreLastPath.current = true;
    const savedPath = normalizeAppPath(localStorage.getItem('last_visited_path'));
    if (savedPath && savedPath !== APP_HOME_ROUTE && location.pathname === APP_HOME_ROUTE) {
      navigate(savedPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const appPath = normalizeAppPath(location.pathname);
    if (appPath) {
      localStorage.setItem('last_visited_path', appPath);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist player state
  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem('player_current_track', JSON.stringify(currentTrack));
    } else {
      localStorage.removeItem('player_current_track');
    }
  }, [currentTrack]);

  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('player_queue', JSON.stringify(queue));
    } else {
      localStorage.removeItem('player_queue');
    }
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('player_current_index', currentIndex.toString());
  }, [currentIndex]);

  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  }, [location.pathname]);

  const withReplayNonce = (track: Track): Track => ({
    ...track,
    playbackNonce: ++replayNonceRef.current,
  });

  const handleTrackSelect = (track: Track, playlist: Track[] = []) => {
    setCurrentTrack(track);
    setQueue(playlist);
    const index = playlist.findIndex(t => t.id === track.id);
    setCurrentIndex(index >= 0 ? index : 0);
  };

  const handleResolveTrackPlayback = useCallback((trackId: string, updates: Pick<Track, 'youtubeId' | 'youtubeCandidates'>) => {
    setQueue(prev => prev.map(track => (
      track.id === trackId ? { ...track, ...updates } : track
    )));

    setCurrentTrack(prev => {
      if (!prev || prev.id !== trackId) return prev;
      return { ...prev, ...updates };
    });
  }, [setCurrentTrack, setQueue]);

  const handleNext = (isShuffle?: boolean, repeatMode?: number) => {
    if (queue.length === 0) return;

    if (isShuffle) {
      if (queue.length === 1) {
        setCurrentIndex(0);
        setCurrentTrack(withReplayNonce(queue[0]));
        return;
      }
      let nextIndex: number;
      do { nextIndex = Math.floor(Math.random() * queue.length); } while (nextIndex === currentIndex);
      setCurrentIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 1) {
        if (queue.length === 1) {
          setCurrentIndex(0);
          setCurrentTrack(withReplayNonce(queue[0]));
        } else {
          setCurrentIndex(0);
          setCurrentTrack(queue[0]);
        }
      }
      return;
    }
    setCurrentIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  };

  const handlePrev = (isShuffle?: boolean, repeatMode?: number) => {
    if (queue.length === 0) return;

    if (isShuffle) {
      if (queue.length === 1) {
        setCurrentIndex(0);
        setCurrentTrack(withReplayNonce(queue[0]));
        return;
      }
      let prevIndex: number;
      do { prevIndex = Math.floor(Math.random() * queue.length); } while (prevIndex === currentIndex);
      setCurrentIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
      return;
    }

    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      if (repeatMode === 1) {
        const lastIndex = queue.length - 1;
        if (queue.length === 1) {
          setCurrentIndex(0);
          setCurrentTrack(withReplayNonce(queue[0]));
        } else {
          setCurrentIndex(lastIndex);
          setCurrentTrack(queue[lastIndex]);
        }
      }
      return;
    }
    setCurrentIndex(prevIndex);
    setCurrentTrack(queue[prevIndex]);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setSearchQuery(query);
    setIsSearchLoading(true);
    setShowSearchResults(true);

    try {
      const response = await fetch(`${config.API_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSearchResultSelect = (video: { id: string, title: string, uploader?: string, thumbnail?: string, duration?: number }) => {
    if (currentTrack?.id === video.id) {
      setIsPlaying(!isPlaying);
      return;
    }

    const track: Track = {
      id: video.id,
      name: video.title,
      artist: video.uploader || 'Unknown',
      album: 'YouTube Video',
      duration_ms: (video.duration || 0) * 1000,
      thumbnail: video.thumbnail,
      isYoutube: true,
      youtubeId: video.id,
      youtubeCandidates: [video.id],
    };

    const fullQueue: Track[] = searchResults.map(v => ({
      id: v.id,
      name: v.title,
      artist: v.uploader || 'Unknown',
      album: 'YouTube Video',
      duration_ms: (v.duration || 0) * 1000,
      thumbnail: v.thumbnail,
      isYoutube: true,
      youtubeId: v.id,
      youtubeCandidates: [v.id],
    }));

    handleTrackSelect(track, fullQueue);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const updateScrollToTopVisibility = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      setShowScrollToTop(false);
      return;
    }

    const { scrollTop } = node;
    setShowScrollToTop(scrollTop > 24);
  }, []);

  const handleContentScroll = (event: React.UIEvent<HTMLDivElement>) => {
    updateScrollToTopVisibility(event.currentTarget);
  };

  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    updateScrollToTopVisibility(scrollContainerRef.current);
  }, [location.pathname, showSearchResults, searchResults.length, updateScrollToTopVisibility]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
      <div className="sticky top-0 z-20 px-4 py-4 md:px-6 border-b border-border/50 bg-bg-primary/18 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
        <SearchBar
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            if (!val.trim()) {
              setShowSearchResults(false);
              setSearchResults([]);
            }
          }}
          onSearch={handleSearch}
          isLoading={isSearchLoading}
          showHomeButton={!!activePlaylistId}
          onToggleMenu={onToggleMenu}
          isMenuOpen={isMobileMenuOpen}
        />
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleContentScroll}
        className="flex-1 overflow-y-auto scrollbar-thin pb-[calc(160px+env(safe-area-inset-bottom))] md:pb-32"
      >
        <div className={showSearchResults ? "block" : "hidden"}>
          <div className="px-6 py-6 md:px-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-text-primary mb-2">Search Results</h2>
                <p className="text-text-secondary">
                  Showing results for "<span className="text-text-primary font-medium">{searchQuery}</span>"
                </p>
              </div>
              <button
                onClick={clearSearch}
                className="app-button-secondary relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-transparent"
              >
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-text-primary">
                  Back to Library
                </span>
                Back to Library
              </button>
            </div>

            {isSearchLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border-4 border-bg-tertiary border-t-primary rounded-full animate-spin mb-6"></div>
                <p className="text-text-muted text-lg">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <ResultList
                results={searchResults}
                onSelect={handleSearchResultSelect}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-full bg-bg-secondary border border-border flex items-center justify-center mb-6 shadow-card">
                  <Music size={36} className="text-text-muted" />
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-2">No results found</h3>
                <p className="text-text-muted">Try searching with different keywords</p>
              </div>
            )}
          </div>
        </div>

        <div className={showSearchResults ? "hidden" : "block"}>
          <Home
            activePlaylistId={activePlaylistId}
            onTrackSelect={handleTrackSelect}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleScrollToTop}
        className={`app-button-secondary fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full shadow-card transition-all duration-200 md:bottom-28 md:right-6 ${
          showScrollToTop ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
        style={{ right: isNowPlayingSidebarOpen && isLargeScreen ? `${sidebarWidth + 24}px` : undefined }}
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <ChevronUp size={18} className="text-text-primary" />
      </button>

      <Player
        currentTrack={currentTrack}
        nextTrack={queue.length > 0 ? queue[(currentIndex + 1) % queue.length] : null}
        onNext={handleNext}
        onPrev={handlePrev}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onResolveTrackPlayback={handleResolveTrackPlayback}
        onToggleNowPlaying={() => setIsNowPlayingSidebarOpen(!isNowPlayingSidebarOpen)}
        isSidebarOpen={isNowPlayingSidebarOpen}
        sidebarWidth={sidebarWidth}
      />
    </div>
  );
}

function MainLayout() {
  const navigate = useNavigate();
  const [isNowPlayingSidebarOpen, setIsNowPlayingSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem('now_playing_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 280 && parsed <= 600) return parsed;
    }
    return 320;
  });

  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    const saved = localStorage.getItem('player_current_track');
    return enrichTrackWithImportedMetadata(saved ? JSON.parse(saved) : null);
  });
  const [artistDetails, setArtistDetails] = useState<Artist | null>(null);
  const [artistPlaylists, setArtistPlaylists] = useState<ArtistPlaylist[]>([]);
  const [queue, setQueue] = useState<Track[]>(() => {
    const saved = localStorage.getItem('player_queue');
    return saved ? JSON.parse(saved).map((track: Track) => enrichTrackWithImportedMetadata(track) || track) : [];
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem('player_current_index');
    return saved ? parseInt(saved) : 0;
  });
  const artistDetailsCacheRef = useRef<Map<string, Artist>>(new Map());
  const artistPlaylistsCacheRef = useRef<Map<string, ArtistPlaylist[]>>(new Map());
  const artistTopTrackQueue = useMemo(() => buildArtistTopTrackQueue(artistDetails), [artistDetails]);
  const artistDetailsLookupKey = currentTrack
    ? (currentTrack.artistId
      ? `artist:${currentTrack.artistId}`
      : currentTrack.spotifyTrackId
        ? `track:${currentTrack.spotifyTrackId}`
        : '')
    : '';
  const openMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  useEffect(() => {
    document.title = 'Brokeify';
  }, []);

  useEffect(() => {
    return () => {
      applyAlbumTheme(DEFAULT_ALBUM_THEME);
    };
  }, []);

  // Extract colors from current track
  useEffect(() => {
    let ignore = false;

    const syncTheme = async () => {
      if (!currentTrack) {
        applyAlbumTheme(DEFAULT_ALBUM_THEME);
        return;
      }

      const imageUrl = currentTrack.image || currentTrack.thumbnail;
      if (!imageUrl) {
        applyAlbumTheme(DEFAULT_ALBUM_THEME);
        return;
      }

      try {
        const theme = await extractAlbumTheme(imageUrl);
        if (!ignore) {
          applyAlbumTheme(theme);
        }
      } catch {
        if (!ignore) {
          applyAlbumTheme(DEFAULT_ALBUM_THEME);
        }
      }
    };

    syncTheme();

    return () => {
      ignore = true;
    };
  }, [currentTrack]);

  useEffect(() => {
    localStorage.setItem('now_playing_sidebar_width', sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    const controller = new AbortController();

    const repairImportedMetadata = async () => {
      try {
        const changed = await repairImportedPlaylists(config.API_URL, controller.signal);
        if (!changed) return;

        setCurrentTrack(prev => enrichTrackWithImportedMetadata(prev));
        setQueue(prev => prev.map(track => enrichTrackWithImportedMetadata(track) || track));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Imported playlist repair failed', error);
      }
    };

    repairImportedMetadata();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const enrichedCurrentTrack = enrichTrackWithImportedMetadata(currentTrack);
    if (enrichedCurrentTrack !== currentTrack) {
      setCurrentTrack(enrichedCurrentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    setQueue(prev => {
      let changed = false;
      const next = prev.map(track => {
        const enriched = enrichTrackWithImportedMetadata(track) || track;
        if (enriched !== track) changed = true;
        return enriched;
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!currentTrack || currentTrack.isYoutube) {
      setArtistPlaylists([]);
      return;
    }

    const params = new URLSearchParams();
    if (currentTrack.artistId) {
      params.set('artistId', currentTrack.artistId);
    }
    if (currentTrack.spotifyTrackId) {
      params.set('trackId', currentTrack.spotifyTrackId);
    }

    if (!params.toString()) {
      setArtistPlaylists([]);
      return;
    }

    const controller = new AbortController();
    const cachedArtistPlaylists = artistDetailsLookupKey
      ? artistPlaylistsCacheRef.current.get(artistDetailsLookupKey)
      : undefined;

    if (cachedArtistPlaylists) {
      setArtistPlaylists(cachedArtistPlaylists);
      return () => {
        controller.abort();
      };
    }

    setArtistPlaylists([]);

    const loadArtistPlaylists = async () => {
      try {
        const response = await fetch(`${config.API_URL}/api/artist-playlists?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Artist playlists request failed: ${response.status}`);
        }

        const data: ArtistPlaylist[] = await response.json();
        if (artistDetailsLookupKey) {
          artistPlaylistsCacheRef.current.set(artistDetailsLookupKey, data);
        }
        setArtistPlaylists(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Artist playlists fetch failed', error);
        setArtistPlaylists([]);
      }
    };

    loadArtistPlaylists();

    return () => {
      controller.abort();
    };
  }, [artistDetailsLookupKey, currentTrack]);

  useEffect(() => {
    if (!currentTrack || currentTrack.isYoutube) {
      setArtistDetails(null);
      return;
    }

    const params = new URLSearchParams();
    if (currentTrack.artistId) {
      params.set('artistId', currentTrack.artistId);
    }
    if (currentTrack.spotifyTrackId) {
      params.set('trackId', currentTrack.spotifyTrackId);
    }

    if (!params.toString()) {
      setArtistDetails(null);
      return;
    }

    const controller = new AbortController();
    const cachedArtistDetails = artistDetailsLookupKey
      ? artistDetailsCacheRef.current.get(artistDetailsLookupKey)
      : undefined;

    if (cachedArtistDetails) {
      setArtistDetails(cachedArtistDetails);
      return () => {
        controller.abort();
      };
    }

    setArtistDetails(null);

    const loadArtistDetails = async () => {
      try {
        const response = await fetch(`${config.API_URL}/api/artist-details?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Artist details request failed: ${response.status}`);
        }

        const data: Artist = await response.json();
        if (artistDetailsLookupKey) {
          artistDetailsCacheRef.current.set(artistDetailsLookupKey, data);
        }
        setArtistDetails(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Artist details fetch failed', error);
        setArtistDetails(null);
      }
    };

    loadArtistDetails();

    return () => {
      controller.abort();
    };
  }, [artistDetailsLookupKey, currentTrack]);

  const handleSelectQueueIndex = (index: number) => {
    if (index < 0 || index >= queue.length) return;
    setCurrentIndex(index);
    setCurrentTrack(queue[index]);
  };

  const handleRemoveFromQueue = (index: number) => {
    if (index < 0 || index >= queue.length) return;
    const newQueue = [...queue];
    newQueue.splice(index, 1);
    setQueue(newQueue);

    if (index < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (index === currentIndex) {
      if (newQueue.length === 0) {
        setCurrentTrack(null);
        setCurrentIndex(0);
      } else {
        if (index >= newQueue.length) {
          const newIndex = newQueue.length - 1;
          setCurrentIndex(newIndex);
          setCurrentTrack(newQueue[newIndex]);
        } else {
          setCurrentTrack(newQueue[index]);
        }
      }
    }
  };

  const handlePlayArtistTopTrack = useCallback((index: number) => {
    const track = artistTopTrackQueue[index];
    if (!track) return;

    const isSameTrack = currentTrack?.spotifyTrackId === track.id || currentTrack?.id === track.id;

    if (isSameTrack) {
      setIsPlaying(value => !value);
      return;
    }

    setQueue(artistTopTrackQueue);
    setCurrentIndex(index);
    setCurrentTrack(track);
  }, [artistTopTrackQueue, currentTrack]);

  const handleOpenImportedPlaylist = useCallback(async (playlistCard: ArtistPlaylist, shouldPlay: boolean) => {
    const playlist = await importOrReuseSpotifyPlaylist({
      apiUrl: config.API_URL,
      url: playlistCard.spotifyUrl,
    });

    if (shouldPlay) {
      const tracks = importedPlaylistToPlayableTracks(playlist);
      if (tracks.length > 0) {
        setQueue(tracks);
        setCurrentIndex(0);
        setCurrentTrack(tracks[0]);
        setIsPlaying(true);
      }
    }

    navigate(buildAppPlaylistRoute(playlist.id));
    setIsNowPlayingSidebarOpen(false);
  }, [navigate]);

  return (
    <div className="flex h-screen w-screen text-text-primary overflow-hidden relative bg-bg-base">
      <DynamicBackground currentTrack={currentTrack} />
      <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      <MainContent
        currentTrack={currentTrack}
        setCurrentTrack={setCurrentTrack}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        isMobileMenuOpen={isMobileMenuOpen}
        isNowPlayingSidebarOpen={isNowPlayingSidebarOpen}
        setIsNowPlayingSidebarOpen={setIsNowPlayingSidebarOpen}
        sidebarWidth={sidebarWidth}
        queue={queue}
        setQueue={setQueue}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
        onToggleMenu={openMobileMenu}
      />
      {isNowPlayingSidebarOpen && (
        <NowPlayingSidebar
          currentTrack={currentTrack}
          artistDetails={artistDetails}
          artistPlaylists={artistPlaylists}
          isPlaying={isPlaying}
          onClose={() => setIsNowPlayingSidebarOpen(false)}
          queue={queue}
          currentIndex={currentIndex}
          onSelectQueueIndex={handleSelectQueueIndex}
          onRemoveFromQueue={handleRemoveFromQueue}
          onPlayArtistTopTrack={handlePlayArtistTopTrack}
          onOpenArtistPlaylist={playlist => handleOpenImportedPlaylist(playlist, false)}
          onPlayArtistPlaylist={playlist => handleOpenImportedPlaylist(playlist, true)}
          width={sidebarWidth}
          setWidth={setSidebarWidth}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to={APP_HOME_ROUTE} replace />} />
          <Route path={LANDING_ROUTE} element={<LandingPage />} />
          <Route path={APP_PLAYLIST_ROUTE} element={<MainLayout />} />
          <Route path={APP_HOME_ROUTE} element={<MainLayout />} />
          <Route path="*" element={<Navigate to={APP_HOME_ROUTE} replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
