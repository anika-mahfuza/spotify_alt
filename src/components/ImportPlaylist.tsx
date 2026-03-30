import { useEffect, useRef, useState } from 'react';
import { Link, Loader2, X } from 'lucide-react';
import { config } from '../config';
import { ImportedPlaylist, ImportedTrack } from '../types';

interface ImportPlaylistProps {
  onClose: () => void;
  onImported: (playlist: ImportedPlaylist) => void;
}

function extractSpotifyPlaylistId(url: string): string | null {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match?.[1] || null;
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

  const handleImport = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = url.trim();
    if (!trimmed.includes('spotify.com/playlist/')) {
      setError('Please enter a valid Spotify playlist URL');
      return;
    }

    const spotifyPlaylistId = extractSpotifyPlaylistId(trimmed);
    if (!spotifyPlaylistId) {
      setError('Please enter a valid Spotify playlist URL');
      return;
    }

    setError(null);
    setIsImporting(true);
    setProgress({ tracks: 0, status: 'Connecting to Spotify...' });

    let meta: { name: string; description?: string; owner?: string; image?: string; trackCount: number } | null = null;
    const allTracks: ImportedTrack[] = [];

    const sse = new EventSource(`${config.API_URL}/api/import-playlist?url=${encodeURIComponent(trimmed)}`);

    sse.addEventListener('meta', eventData => {
      meta = JSON.parse(eventData.data);
      setProgress(prev => ({ ...prev, status: `Importing "${meta?.name}"...` }));
    });

    sse.addEventListener('tracks', eventData => {
      const nextTracks: ImportedTrack[] = JSON.parse(eventData.data);
      allTracks.push(...nextTracks);
      setProgress({ tracks: allTracks.length, status: `Found ${allTracks.length} tracks...` });
    });

    sse.addEventListener('done', () => {
      sse.close();
      setIsImporting(false);

      if (!meta || allTracks.length === 0) {
        setError('No tracks found. The playlist might be empty or private.');
        return;
      }

      const existingPlaylists: ImportedPlaylist[] = JSON.parse(localStorage.getItem('imported_playlists') || '[]');
      const existingPlaylist = existingPlaylists.find(item =>
        extractSpotifyPlaylistId(item.sourceUrl) === spotifyPlaylistId
      );

      const playlist: ImportedPlaylist = {
        id: existingPlaylist?.id || `imported-${spotifyPlaylistId}`,
        name: meta.name,
        description: meta.description,
        owner: meta.owner,
        image: meta.image,
        trackCount: meta.trackCount,
        tracks: allTracks,
        sourceUrl: trimmed,
        importedAt: Date.now(),
      };

      const updatedPlaylists = existingPlaylist
        ? existingPlaylists.map(item => (item.id === existingPlaylist.id ? playlist : item))
        : [...existingPlaylists, playlist];

      localStorage.setItem('imported_playlists', JSON.stringify(updatedPlaylists));
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="app-panel-strong w-full max-w-xl overflow-hidden rounded-[30px]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Import Playlist</h2>
            <p className="mt-1 text-xs text-text-muted">Bring in any public Spotify playlist</p>
          </div>
          <button onClick={onClose} className="app-icon-button flex h-10 w-10 items-center justify-center rounded-full">
            <X size={18} className="text-text-primary" />
          </button>
        </div>

        <div className="px-6 py-6">
          {!isImporting ? (
            <>
              <p className="mb-5 text-sm leading-6 text-text-secondary">
                Paste a public Spotify playlist URL and we will import its tracks into your local library. No extra login is required.
              </p>

              <form onSubmit={handleImport}>
                <div className="app-input-shell flex items-center gap-3 rounded-2xl px-4 py-3">
                  <Link size={16} className="shrink-0 text-text-muted" />
                  <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={event => {
                      setUrl(event.target.value);
                      setError(null);
                    }}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                    required
                  />
                </div>

                {error ? (
                  <p className="mt-3 text-xs text-danger">{error}</p>
                ) : null}

                <button
                  type="submit"
                  className="app-button-primary mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold"
                >
                  Import Playlist
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-text-muted">Works with any public Spotify playlist</p>
            </>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="app-card mb-5 flex h-16 w-16 items-center justify-center rounded-full">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
              <p className="text-sm font-medium text-text-primary">{progress.status}</p>
              {progress.tracks > 0 ? (
                <p className="mt-2 text-sm text-text-secondary">{progress.tracks} tracks found</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
