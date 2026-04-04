import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Loader2, X } from 'lucide-react';
import { config } from '../config';
import { ImportedPlaylist } from '../types';
import { extractSpotifyPlaylistId, importOrReuseSpotifyPlaylist } from '../utils/spotifyPlaylistImport';

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
  const importAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();

    return () => {
      importAbortRef.current?.abort();
    };
  }, []);

  const handleImport = async (event: React.FormEvent) => {
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

    const controller = new AbortController();
    importAbortRef.current = controller;

    try {
      const playlist = await importOrReuseSpotifyPlaylist({
        apiUrl: config.API_URL,
        url: trimmed,
        signal: controller.signal,
        onProgress: nextProgress => setProgress(nextProgress),
      });

      setIsImporting(false);
      onImported(playlist);
    } catch (importError) {
      if (controller.signal.aborted) return;
      setIsImporting(false);
      setError(importError instanceof Error ? importError.message : 'Import failed. Please try again.');
    } finally {
      if (importAbortRef.current === controller) {
        importAbortRef.current = null;
      }
    }
  };

  const modal = (
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

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
}
