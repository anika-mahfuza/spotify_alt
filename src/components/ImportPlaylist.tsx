import { useState, useRef, useEffect } from 'react';
import { X, Link, Loader2 } from 'lucide-react';
import { config } from '../config';
import { ImportedPlaylist, ImportedTrack } from '../types';

interface ImportPlaylistProps {
  onClose: () => void;
  onImported: (playlist: ImportedPlaylist) => void;
}

export function ImportPlaylist({ onClose, onImported }: ImportPlaylistProps) {
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ tracks: number; status: string }>({ tracks: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed.includes('spotify.com/playlist/')) {
      setError('Please enter a valid Spotify playlist URL');
      return;
    }

    setError(null);
    setIsImporting(true);
    setProgress({ tracks: 0, status: 'Connecting to Spotify...' });

    let meta: { name: string; description?: string; owner?: string; image?: string; trackCount: number } | null = null;
    const allTracks: ImportedTrack[] = [];

    const sse = new EventSource(`${config.API_URL}/api/import-playlist?url=${encodeURIComponent(trimmed)}`);

    sse.addEventListener('meta', (e) => {
      meta = JSON.parse(e.data);
      setProgress(prev => ({ ...prev, status: `Importing "${meta!.name}"...` }));
    });

    sse.addEventListener('tracks', (e) => {
      const newTracks: ImportedTrack[] = JSON.parse(e.data);
      allTracks.push(...newTracks);
      setProgress({ tracks: allTracks.length, status: `Found ${allTracks.length} tracks...` });
    });

    sse.addEventListener('done', () => {
      sse.close();
      setIsImporting(false);

      if (!meta || allTracks.length === 0) {
        setError('No tracks found. The playlist might be empty or private.');
        return;
      }

      const playlistId = `imported-${Date.now()}`;
      const playlist: ImportedPlaylist = {
        id: playlistId,
        name: meta.name,
        description: meta.description,
        owner: meta.owner,
        image: meta.image,
        trackCount: meta.trackCount,
        tracks: allTracks,
        sourceUrl: trimmed,
        importedAt: Date.now(),
      };

      // Save to localStorage
      const existing = JSON.parse(localStorage.getItem('imported_playlists') || '[]');
      existing.push(playlist);
      localStorage.setItem('imported_playlists', JSON.stringify(existing));

      // Dispatch event so other components (Sidebar) can sync
      window.dispatchEvent(new CustomEvent('playlist-imported', { detail: playlist }));

      onImported(playlist);
    });

    sse.addEventListener('error', () => {
      sse.close();
      setIsImporting(false);
      setError('Import failed. Please try again.');
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Import Playlist</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <X size={18} className="text-white/60" />
          </button>
        </div>

        <div className="p-5">
          {!isImporting ? (
            <>
              <p className="text-sm text-white/60 mb-4">
                Paste a public Spotify playlist URL to import its tracks. No login required.
              </p>
              <form onSubmit={handleImport}>
                <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 px-4 py-3 focus-within:border-primary/50 transition-colors">
                  <Link size={16} className="text-white/40 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError(null); }}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 outline-none"
                    required
                  />
                </div>

                {error && (
                  <p className="text-accent-pink text-xs mt-2">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full mt-4 py-3 bg-primary hover:bg-primary-hover text-black font-semibold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] text-sm"
                >
                  Import Playlist
                </button>
              </form>

              <p className="text-xs text-white/20 mt-3 text-center">
                Works with any public Spotify playlist
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Loader2 size={28} className="text-primary animate-spin" />
              </div>
              <p className="text-white font-medium mb-1">{progress.status}</p>
              {progress.tracks > 0 && (
                <p className="text-white/40 text-sm">{progress.tracks} tracks found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
