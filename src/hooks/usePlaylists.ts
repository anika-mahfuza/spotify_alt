/**
 * Playlist data fetching hooks
 */

import { useData } from './useData';
import * as spotifyAPI from '../api/spotify';
import * as backendAPI from '../api/backend';
import { Playlist, Track } from '../types';

// ==================== USER PLAYLISTS ====================

export function useUserPlaylists() {
  return useData<Playlist[]>(
    () => spotifyAPI.getUserPlaylists(),
    { enabled: true }
  );
}

export function useBackendPlaylists() {
  return useData<Playlist[]>(
    () => backendAPI.getBackendPlaylists(),
    { enabled: true }
  );
}

// ==================== PLAYLIST DETAILS ====================

export function usePlaylist(playlistId: string | null) {
  return useData<Playlist | null>(
    async () => {
      if (!playlistId) return null;
      return spotifyAPI.getPlaylist(playlistId);
    },
    { 
      enabled: !!playlistId,
      deps: [playlistId],
    }
  );
}

export function usePlaylistTracks(playlistId: string | null) {
  return useData<Track[]>(
    async () => {
      if (!playlistId) return [];
      
      // Handle liked songs specially
      if (playlistId === 'liked-songs') {
        return spotifyAPI.getSavedTracks();
      }
      
      return spotifyAPI.getPlaylistTracks(playlistId);
    },
    {
      enabled: !!playlistId,
      deps: [playlistId],
    }
  );
}

export function useBackendPlaylist(playlistId: string | null) {
  return useData<{ id: string; name: string; tracks: Track[] }>(
    async () => {
      if (!playlistId) return { id: '', name: '', tracks: [] };
      return backendAPI.getBackendPlaylist(playlistId);
    },
    {
      enabled: !!playlistId,
      deps: [playlistId],
    }
  );
}

// ==================== ALBUM ====================

export function useBackendAlbum(albumId: string | null) {
  return useData<{ id: string; name: string; tracks: Track[]; images: Array<{ url: string }> }>(
    async () => {
      if (!albumId) return { id: '', name: '', tracks: [], images: [] };
      const album = await backendAPI.getBackendAlbum(albumId);
      return {
        id: albumId,
        name: album.name,
        tracks: album.tracks,
        images: album.images,
      };
    },
    {
      enabled: !!albumId,
      deps: [albumId],
    }
  );
}
