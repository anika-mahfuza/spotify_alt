import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Player } from './components/Player';
import { Home } from './components/Home';
import { SearchBar } from './components/SearchBar';
import { ResultList } from './components/ResultList';
import { config } from './config';
import './index.css';
import './App.css';

function Login() {
  const { login } = useAuth();
  return (
    <div className="h-screen w-screen bg-spotify-black flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-6xl font-black text-spotify-white tracking-tight mb-4">
          Spotify Alt
        </h1>
        <p className="text-spotify-text-gray text-xl">Your music, your way.</p>
      </div>
      <button 
        onClick={login} 
        className="bg-spotify-green text-spotify-black font-bold py-4 px-10 rounded-full uppercase tracking-widest text-sm transition-transform hover:scale-105"
      >
        Log in with Spotify
      </button>
    </div>
  );
}

interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  image?: string;
  thumbnail?: string;
  isYoutube?: boolean;
}

function MainLayout() {
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [view, setView] = useState<'playlist' | 'search'>('playlist');
  const [searchResults, setSearchResults] = useState([]);

  const handlePlaylistSelect = (id: string) => {
    setActivePlaylistId(id);
    setView('playlist');
  };

  const handleTrackSelect = (track: Track, playlist: Track[] = []) => {
    setCurrentTrack(track);
    setQueue(playlist);
    const index = playlist.findIndex(t => t.id === track.id);
    setCurrentIndex(index >= 0 ? index : 0);
  };

  const handleSearch = async (query: string) => {
    setView('search');
    try {
      const response = await fetch(`${config.API_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search failed", error);
    }
  };

  const handleSearchResultSelect = (video: any) => {
    const track: Track = {
      id: video.id,
      name: video.title,
      artist: video.uploader || 'Unknown',
      thumbnail: video.thumbnail,
      isYoutube: true
    };
    setCurrentTrack(track);
    setQueue([track]);
    setCurrentIndex(0);
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

  return (
    <div className="flex h-screen w-screen bg-spotify-black text-spotify-white overflow-hidden">
      <Sidebar
        onPlaylistSelect={handlePlaylistSelect}
        activePlaylistId={activePlaylistId}
      />

      {view === 'playlist' ? (
        <div className="flex-1 bg-spotify-dark-gray overflow-y-auto pb-24 scrollbar-spotify">
          <Home
            activePlaylistId={activePlaylistId}
            onTrackSelect={handleTrackSelect}
            onSearch={handleSearch}
          />
        </div>
      ) : (
        <div className="flex-1 bg-spotify-dark-gray overflow-y-auto pb-24 p-6 scrollbar-spotify">
          <div className="mb-6">
            <button 
              onClick={() => setView('playlist')} 
              className="text-white mb-4 hover:underline flex items-center gap-2"
            >
              ← Back to Playlist
            </button>
            <SearchBar onSearch={handleSearch} isLoading={false} />
          </div>
          <ResultList results={searchResults} onSelect={handleSearchResultSelect} />
        </div>
      )}

      <Player
        currentTrack={currentTrack}
        onNext={handleNext}
        onPrev={handlePrev}
        backendUrl={config.API_URL}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default App;
