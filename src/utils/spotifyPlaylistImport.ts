import { ImportedPlaylist, ImportedTrack } from '../types';

interface PlaylistImportMeta {
  name: string;
  description?: string;
  owner?: string;
  image?: string;
  trackCount: number;
}

export interface PlaylistImportProgress {
  tracks: number;
  status: string;
}

interface ImportSpotifyPlaylistOptions {
  apiUrl: string;
  url: string;
  onProgress?: (progress: PlaylistImportProgress) => void;
  signal?: AbortSignal;
}

export function extractSpotifyPlaylistId(url: string): string | null {
  const match = String(url || '').match(/playlist\/([a-zA-Z0-9]+)/);
  return match?.[1] || null;
}

export function getStoredImportedPlaylists(): ImportedPlaylist[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem('imported_playlists');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function dispatchImportedPlaylist(playlist: ImportedPlaylist) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('playlist-imported', { detail: playlist }));
}

function storeImportedPlaylist(playlist: ImportedPlaylist, spotifyPlaylistId: string, existingPlaylists?: ImportedPlaylist[]) {
  const playlists = existingPlaylists || getStoredImportedPlaylists();
  const existingPlaylist = playlists.find(item => extractSpotifyPlaylistId(item.sourceUrl) === spotifyPlaylistId);

  const nextPlaylist: ImportedPlaylist = {
    ...playlist,
    id: existingPlaylist?.id || playlist.id || `imported-${spotifyPlaylistId}`,
  };

  const updatedPlaylists = existingPlaylist
    ? playlists.map(item => (item.id === existingPlaylist.id ? nextPlaylist : item))
    : [...playlists, nextPlaylist];

  window.localStorage.setItem('imported_playlists', JSON.stringify(updatedPlaylists));
  dispatchImportedPlaylist(nextPlaylist);
  return nextPlaylist;
}

export async function importOrReuseSpotifyPlaylist({
  apiUrl,
  url,
  onProgress,
  signal,
}: ImportSpotifyPlaylistOptions): Promise<ImportedPlaylist> {
  const trimmedUrl = url.trim();
  const spotifyPlaylistId = extractSpotifyPlaylistId(trimmedUrl);

  if (!trimmedUrl.includes('spotify.com/playlist/') || !spotifyPlaylistId) {
    throw new Error('Please enter a valid Spotify playlist URL');
  }

  const existingPlaylists = getStoredImportedPlaylists();
  const existingPlaylist = existingPlaylists.find(item => extractSpotifyPlaylistId(item.sourceUrl) === spotifyPlaylistId);

  if (existingPlaylist) {
    onProgress?.({
      tracks: existingPlaylist.tracks.length,
      status: `Using saved playlist "${existingPlaylist.name}"...`,
    });
    dispatchImportedPlaylist(existingPlaylist);
    return existingPlaylist;
  }

  return new Promise<ImportedPlaylist>((resolve, reject) => {
    let meta: PlaylistImportMeta | null = null;
    const allTracks: ImportedTrack[] = [];
    const sse = new EventSource(`${apiUrl}/api/import-playlist?url=${encodeURIComponent(trimmedUrl)}`);

    const cleanup = () => {
      sse.close();
      signal?.removeEventListener('abort', handleAbort);
    };

    const fail = (message: string, error?: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(message));
    };

    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Playlist import was aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    onProgress?.({ tracks: 0, status: 'Connecting to Spotify...' });

    sse.addEventListener('meta', eventData => {
      meta = JSON.parse(eventData.data);
      onProgress?.({ tracks: allTracks.length, status: `Importing "${meta?.name}"...` });
    });

    sse.addEventListener('tracks', eventData => {
      const nextTracks: ImportedTrack[] = JSON.parse(eventData.data);
      allTracks.push(...nextTracks);
      onProgress?.({ tracks: allTracks.length, status: `Found ${allTracks.length} tracks...` });
    });

    sse.addEventListener('done', () => {
      cleanup();

      if (!meta || allTracks.length === 0) {
        reject(new Error('No tracks found. The playlist might be empty or private.'));
        return;
      }

      const playlist = storeImportedPlaylist({
        id: `imported-${spotifyPlaylistId}`,
        name: meta.name,
        description: meta.description,
        owner: meta.owner,
        image: meta.image,
        trackCount: meta.trackCount,
        tracks: allTracks,
        sourceUrl: trimmedUrl,
        importedAt: Date.now(),
      }, spotifyPlaylistId, existingPlaylists);

      resolve(playlist);
    });

    sse.addEventListener('error', () => {
      fail('Import failed. Please try again.');
    });
  });
}
