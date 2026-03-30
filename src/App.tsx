import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { BrowserRouter as Router, Routes, Route, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { NowPlayingSidebar } from './components/NowPlayingSidebar';
import { Player } from './components/Player';
import { Home } from './components/Home';
import { SearchBar } from './components/SearchBar';
import { ResultList } from './components/ResultList';
import { config } from './config';
import { Track } from './types';
import { ChevronUp, Music } from 'lucide-react';
import { applyAlbumTheme, DEFAULT_ALBUM_THEME, extractAlbumTheme } from './utils/colorExtractor';
import { DynamicBackground } from './components/DynamicBackground';
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

interface MainContentProps {
  currentTrack: Track | null;
  setCurrentTrack: Dispatch<SetStateAction<Track | null>>;
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
  isNowPlayingSidebarOpen,
  setIsNowPlayingSidebarOpen,
  sidebarWidth,
  queue,
  setQueue,
  currentIndex,
  setCurrentIndex,
  onToggleMenu
}: MainContentProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingContextId, setPlayingContextId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const didRestoreLastPath = useRef(false);
  const replayNonceRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const matchPlaylist = useMatch('/playlist/:id');
  const location = useLocation();
  const navigate = useNavigate();
  const activePlaylistId = matchPlaylist?.params.id || null;

  // Restore last visited page
  useEffect(() => {
    if (didRestoreLastPath.current) return;
    didRestoreLastPath.current = true;
    const savedPath = localStorage.getItem('last_visited_path');
    if (savedPath && savedPath !== '/' && location.pathname === '/') {
      navigate(savedPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname !== '/login' && location.pathname !== '/logout') {
      localStorage.setItem('last_visited_path', location.pathname);
    }
  }, [location.pathname]);

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

  const handleTrackSelect = (track: Track, playlist: Track[] = [], contextId?: string) => {
    setCurrentTrack(track);
    setQueue(playlist);
    setPlayingContextId(contextId || null);
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
      <div className="sticky top-0 z-20 px-4 py-4 md:px-6 border-b border-border/60 bg-bg-primary/45 backdrop-blur-3xl shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
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
            playingContextId={playingContextId}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleScrollToTop}
        className={`app-button-secondary fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full shadow-card transition-all duration-200 md:bottom-28 md:right-6 ${
          showScrollToTop ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
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
        backendUrl={config.API_URL}
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
  const [isNowPlayingSidebarOpen, setIsNowPlayingSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    return saved ? JSON.parse(saved) : null;
  });
  const [queue, setQueue] = useState<Track[]>(() => {
    const saved = localStorage.getItem('player_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem('player_current_index');
    return saved ? parseInt(saved) : 0;
  });

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

  return (
    <div className="flex h-screen w-screen text-text-primary overflow-hidden relative bg-bg-base">
      <DynamicBackground currentTrack={currentTrack} />
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <MainContent
        currentTrack={currentTrack}
        setCurrentTrack={setCurrentTrack}
        isNowPlayingSidebarOpen={isNowPlayingSidebarOpen}
        setIsNowPlayingSidebarOpen={setIsNowPlayingSidebarOpen}
        sidebarWidth={sidebarWidth}
        queue={queue}
        setQueue={setQueue}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
        onToggleMenu={() => setIsMobileMenuOpen(true)}
      />
      {isNowPlayingSidebarOpen && (
        <NowPlayingSidebar
          currentTrack={currentTrack}
          artistDetails={null}
          onClose={() => setIsNowPlayingSidebarOpen(false)}
          queue={queue}
          currentIndex={currentIndex}
          onSelectQueueIndex={handleSelectQueueIndex}
          onRemoveFromQueue={handleRemoveFromQueue}
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
          <Route path="/playlist/:id" element={<MainLayout />} />
          <Route path="/" element={<MainLayout />} />
          <Route path="*" element={<MainLayout />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
