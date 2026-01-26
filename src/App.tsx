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
import { extractDominantColor, getTextColor, setAccentColor, hexToRgb } from './utils/colorExtractor';
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

function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen w-full text-white flex flex-col relative z-50" style={{ backgroundColor: '#000000' }}>
      {/* Navigation */}
      <nav className="w-full px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
             <Music size={16} className="text-black" strokeWidth={3} />
           </div>
           <span className="text-xl font-bold tracking-tight">Spotify Alt</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
           <a href="#" className="hover:text-white transition-colors">Premium</a>
           <a href="#" className="hover:text-white transition-colors">Support</a>
           <a href="#" className="hover:text-white transition-colors">Download</a>
           <div className="w-px h-4 bg-zinc-800"></div>
           <a href="#" className="hover:text-white transition-colors">Sign up</a>
           <button onClick={login} className="hover:text-white transition-colors">Log in</button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 pb-20">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 max-w-4xl leading-tight">
           Music for everyone.
        </h1>
        <p className="text-xl text-zinc-400 mb-10 max-w-2xl font-medium">
           Millions of songs. No credit card needed.
        </p>

        <button
          onClick={login}
          className="
            group
            bg-[#1DB954] hover:bg-[#1ed760]
            text-black font-bold
            py-3.5 px-8 rounded-full
            text-base
            transition-all duration-300
            transform hover:scale-[1.02] active:scale-[0.98]
            flex items-center gap-3
          "
        >
          <span>GET SPOTIFY FREE</span>
        </button>

        {/* Feature Grid (Public Info) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-24 max-w-5xl text-left">
           <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </div>
              <h3 className="text-lg font-bold">Play your favorites.</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                 Listen to the songs you love, and discover new music and podcasts.
              </p>
           </div>
           
           <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <h3 className="text-lg font-bold">Playlists made easy.</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                 We'll help you make playlists. Or enjoy playlists made by music experts.
              </p>
           </div>

           <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold">Make it yours.</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                 Tell us what you like, and we'll recommend music for you.
              </p>
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-black py-12 px-8 border-t border-zinc-900">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex items-center gap-2">
               <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                 <Music size={12} className="text-black" strokeWidth={3} />
               </div>
               <span className="text-lg font-bold tracking-tight">Spotify Alt</span>
            </div>
            <div className="flex flex-wrap gap-8 text-xs font-bold text-zinc-400 uppercase tracking-widest">
               <a href="#" className="hover:text-[#1DB954] transition-colors">Legal</a>
               <a href="#" className="hover:text-[#1DB954] transition-colors">Privacy Center</a>
               <a href="#" className="hover:text-[#1DB954] transition-colors">Privacy Policy</a>
               <a href="#" className="hover:text-[#1DB954] transition-colors">Cookies</a>
               <a href="#" className="hover:text-[#1DB954] transition-colors">About Ads</a>
            </div>
            <p className="text-xs text-zinc-500">
               © 2025 Spotify Alt AB
            </p>
         </div>
      </footer>
    </div>
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
      <div className="sticky top-0 z-20 px-6 py-4 border-b border-white/5">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
  const [textColor, setTextColor] = useState('#ffffff');

  // Extract colors from current track (Hazy-style)
  useEffect(() => {
    const extractColors = async () => {
      if (!currentTrack) {
        setAccentColor('#ffffff'); // White as default
        setTextColor('#000000');
        return;
      }

      const imageUrl = currentTrack.image || currentTrack.thumbnail;
      if (!imageUrl) {
        setAccentColor('#ffffff');
        setTextColor('#000000');
        return;
      }

      try {
        const hexColor = await extractDominantColor(imageUrl);
        setAccentColor(hexColor);
        setTextColor(getTextColor(hexToRgb(hexColor)));
      } catch (error) {
        console.error('Failed to extract colors:', error);
        setAccentColor('#ffffff');
        setTextColor('#000000');
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
          textColor={textColor}
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
