import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useSpotifyFetch } from './hooks/useSpotifyFetch';
import { Sidebar } from './components/Sidebar';
import { NowPlayingSidebar } from './components/NowPlayingSidebar';
import { Player } from './components/Player';
import { Home } from './components/Home';
import { SearchBar } from './components/SearchBar';
import { ResultList } from './components/ResultList';
import { config } from './config';
import { Track, Artist } from './types';
import { Music } from 'lucide-react';
import { extractDominantColor, normalizeAccentColor, setAccentColor } from './utils/colorExtractor';
import { DynamicBackground } from './components/DynamicBackground';
import { Spotlight } from './components/Spotlight';
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

function Login() {
  const { login } = useAuth();

  return (
    <Spotlight className="min-h-screen w-full bg-[#0a0a0f] text-white flex flex-col">
      {/* Logo - Minimal */}
      <div className="absolute top-0 left-0 p-8 md:p-12 z-20">
        <div className="flex items-center gap-3 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
          <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
            <Music size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-semibold tracking-tight text-white/90">Spotify Alt</span>
        </div>
      </div>

      {/* Main Content - Centered */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10 min-h-screen pt-20 pb-20">
        {/* Headline */}
        <h1 
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 max-w-5xl leading-[1.1] opacity-0 animate-slide-up"
          style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
        >
          <span className="text-white">Don't just listen.</span>
          <br />
          <span className="text-white/40 italic font-light">Feel</span>
          <span className="text-white"> it.</span>
        </h1>

        {/* Subheadline */}
        <p 
          className="text-lg md:text-xl text-white/50 mb-12 max-w-xl font-normal leading-relaxed opacity-0 animate-slide-up"
          style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
        >
          Millions of tracks. One seamless experience.
          <br className="hidden md:block" />
          No compromises.
        </p>

        {/* Login Button */}
        <button
          onClick={login}
          className="group relative opacity-0 animate-scale-in"
          style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative flex items-center gap-3 bg-white text-black font-semibold py-4 px-10 rounded-full text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]">
            <span>Continue with Spotify</span>
            <svg 
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </button>

        {/* Optional: Subtle feature hints */}
        <div 
          className="flex flex-wrap items-center justify-center gap-4 mt-16 opacity-0 animate-fade-in"
          style={{ animationDelay: '0.9s', animationFillMode: 'forwards' }}
        >
          {['Ad-free', 'High Quality', 'Offline Mode'].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-white/30">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full py-6 px-8 text-center opacity-0 animate-fade-in" style={{ animationDelay: '1s', animationFillMode: 'forwards' }}>
        <p className="text-xs text-white/20">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </footer>
    </Spotlight>
  );
}

interface MainContentProps {
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  setArtistDetails: (artist: Artist | null) => void;
  isNowPlayingSidebarOpen: boolean;
  setIsNowPlayingSidebarOpen: (isOpen: boolean) => void;
  sidebarWidth: number;
  queue: Track[];
  setQueue: (queue: Track[]) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onToggleMenu: () => void;
}

function MainContent({
  currentTrack,
  setCurrentTrack,
  setArtistDetails,
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
  // Removed local color state as it is now passed via props

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const didRestoreLastPath = useRef(false);

  const { token } = useAuth();
  const fetchWithAuth = useSpotifyFetch();

  const matchPlaylist = useMatch('/playlist/:id');
  const matchAlbum = useMatch('/album/:id');
  const matchArtist = useMatch('/artist/:id');
  const matchLikedSongs = useMatch('/collection/tracks');
  const location = useLocation();
  const navigate = useNavigate();
  const activePlaylistId = matchPlaylist?.params.id || (matchLikedSongs ? 'liked-songs' : null);
  const activeAlbumId = matchAlbum?.params.id || null;
  const activeArtistId = matchArtist?.params.id || null;

  // Restore last visited page on mount
  useEffect(() => {
    if (didRestoreLastPath.current) return;
    didRestoreLastPath.current = true;
    const savedPath = localStorage.getItem('last_visited_path');
    if (savedPath && savedPath !== '/' && location.pathname === '/') {
      navigate(savedPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  // Save current path to localStorage
  useEffect(() => {
    if (location.pathname !== '/login' && location.pathname !== '/logout') {
      localStorage.setItem('last_visited_path', location.pathname);
    }
  }, [location.pathname]);

  // Save current track to localStorage
  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem('player_current_track', JSON.stringify(currentTrack));
    } else {
      localStorage.removeItem('player_current_track');
    }
  }, [currentTrack]);

  // Save queue to localStorage
  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('player_queue', JSON.stringify(queue));
    } else {
      localStorage.removeItem('player_queue');
    }
  }, [queue]);

  // Save current index to localStorage
  useEffect(() => {
    localStorage.setItem('player_current_index', currentIndex.toString());
  }, [currentIndex]);



  useEffect(() => {
    if (currentTrack && currentTrack.artist) {
      const fetchArtistDetails = async () => {
        try {
          const artistName = currentTrack.artist.split(',')[0].trim();
          // Use fetchWithAuth instead of direct fetch
          const response = await fetchWithAuth(`${config.API_URL}/artist-details?artistName=${encodeURIComponent(artistName)}`);
          const data = await response.json();
          const isValidArtist =
            data &&
            typeof data === 'object' &&
            typeof (data as { name?: unknown }).name === 'string' &&
            (data as { name: string }).name.trim().length > 0;
          setArtistDetails(isValidArtist ? data : null);
        } catch (error) {
          console.error("Failed to fetch artist details", error);
          setArtistDetails(null);
        }
      };
      fetchArtistDetails();
    } else {
      setArtistDetails(null);
    }
  }, [currentTrack, token, setArtistDetails, fetchWithAuth]);

  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  }, [location.pathname]);

  const handleTrackSelect = (track: Track, playlist: Track[] = [], contextId?: string) => {
    setCurrentTrack(track);
    setQueue(playlist);
    setPlayingContextId(contextId || null);
    const index = playlist.findIndex(t => t.id === track.id);
    setCurrentIndex(index >= 0 ? index : 0);
  };

  const handleNext = () => {
    if (queue.length > 0 && currentIndex < queue.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
    }
  };

  const handlePrev = () => {
    if (queue.length > 0 && currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
    }
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
      const response = await fetchWithAuth(`${config.API_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSearchResultSelect = (video: { id: string, title: string, uploader?: string, thumbnail?: string, duration?: number }) => {
    // Check if we are already playing this track
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
      isYoutube: true
    };
    setCurrentTrack(track);
    setQueue([track]);
    setCurrentIndex(0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
      {/* Search Bar Header */}
      <div className="sticky top-0 z-20 px-6 py-4 border-b border-white/10 bg-black/30 backdrop-blur-3xl">
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
          showHomeButton={!!(activePlaylistId || activeAlbumId)}
          onToggleMenu={onToggleMenu}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-32">
        {showSearchResults ? (
          <div className="px-8 py-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Search Results
                </h2>
                <p className="text-text-secondary">
                  Showing results for "<span className="text-white font-medium">{searchQuery}</span>"
                </p>
              </div>
              <button
                onClick={clearSearch}
                className="
                  px-6 py-3 rounded-full
                  bg-[#121212] hover:bg-[#1a1a1a]
                  text-text-secondary hover:text-white
                  transition-all hover:scale-105
                  flex items-center gap-2
                "
              >
                ← Back to Library
              </button>
            </div>

            {isSearchLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border-4 border-[#1a1a1a] border-t-primary rounded-full animate-spin mb-6"></div>
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
                <div className="w-20 h-20 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-6">
                  <Music size={36} className="text-text-muted" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No results found</h3>
                <p className="text-text-muted">Try searching with different keywords</p>
              </div>
            )}
          </div>
        ) : (
          <Home
            activePlaylistId={activePlaylistId}
            activeAlbumId={activeAlbumId}
            activeArtistId={activeArtistId}
            onTrackSelect={handleTrackSelect}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            playingContextId={playingContextId}
          />
        )}
      </div>

      {/* Player */}
      <Player
        currentTrack={currentTrack}
        nextTrack={queue.length > 0 && currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null}
        onNext={handleNext}
        onPrev={handlePrev}
        backendUrl={config.API_URL}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
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
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default width
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [artistDetails, setArtistDetails] = useState<Artist | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Extract colors from current track (Hazy-style)
  useEffect(() => {
    const extractColors = async () => {
      if (!currentTrack) {
        setAccentColor('#ffffff'); // White as default
        return;
      }

      const imageUrl = currentTrack.image || currentTrack.thumbnail;
      if (!imageUrl) {
        setAccentColor('#ffffff');
        return;
      }

      try {
        const hexColor = await extractDominantColor(imageUrl);
        const safeColor = normalizeAccentColor(hexColor);
        setAccentColor(safeColor);
      } catch (error) {
        console.error('Failed to extract colors:', error);
        setAccentColor('#ffffff');
      }
    };
    extractColors();
  }, [currentTrack]);

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
    <div className="flex h-screen w-screen text-white overflow-hidden relative">
      {/* Global dynamic background */}
      <DynamicBackground currentTrack={currentTrack} />

      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      <MainContent
        currentTrack={currentTrack}
        setCurrentTrack={setCurrentTrack}
        setArtistDetails={setArtistDetails}
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
          artistDetails={artistDetails}
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

function LogoutPage() {
  const { logout } = useAuth();
  useEffect(() => {
    // Clear player state on logout
    localStorage.removeItem('player_current_track');
    localStorage.removeItem('player_queue');
    localStorage.removeItem('player_current_index');
    localStorage.removeItem('player_last_position');
    localStorage.removeItem('last_visited_path');
    logout();
  }, [logout]);
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/album/:id" element={<RequireAuth><MainLayout /></RequireAuth>} />
          <Route path="/playlist/:id" element={<RequireAuth><MainLayout /></RequireAuth>} />
          <Route path="/artist/:id" element={<RequireAuth><MainLayout /></RequireAuth>} />
          <Route path="/collection/tracks" element={<RequireAuth><MainLayout /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default App;
