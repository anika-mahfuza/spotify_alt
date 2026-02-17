/**
 * Search and Stream hooks
 */

import { useData, useLazyData } from './useData';
import * as backendAPI from '../api/backend';
import * as spotifyAPI from '../api/spotify';
import { Track, Artist, Album, Playlist } from '../types';

// ==================== SEARCH ====================

export interface SearchResult {
  id: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
}

export function useYouTubeSearch(query: string) {
  return useData<SearchResult[]>(
    async () => {
      if (!query.trim()) return [];
      return backendAPI.searchYouTube(query);
    },
    {
      enabled: !!query.trim(),
      deps: [query],
    }
  );
}

export function useLazyYouTubeSearch() {
  return useLazyData<SearchResult[]>(
    (query) => backendAPI.searchYouTube(query as string)
  );
}

export function useLazySearchAndPlay() {
  return useLazyData<Track | null>(
    (query) => backendAPI.searchAndPlay(query as string)
  );
}

export interface SpotifySearchResults {
  tracks?: Track[];
  artists?: Artist[];
  albums?: Album[];
  playlists?: Playlist[];
}

export function useSpotifySearch(query: string, types: string = 'track,artist,album,playlist') {
  return useData<SpotifySearchResults>(
    async () => {
      if (!query.trim()) return {};
      return spotifyAPI.searchSpotify(query, types);
    },
    {
      enabled: !!query.trim(),
      deps: [query, types],
    }
  );
}

export function useLazySpotifySearch() {
  return useLazyData<SpotifySearchResults>(
    (query, types) => spotifyAPI.searchSpotify(query as string, types as string | undefined)
  );
}

// ==================== STREAM ====================

export function useStreamUrl(videoId: string | null) {
  return useData<string>(
    async () => {
      if (!videoId) return '';
      return backendAPI.getPlayUrl(videoId);
    },
    {
      enabled: !!videoId,
      deps: [videoId],
    }
  );
}

export function useLazyStreamUrl() {
  return useLazyData<string>(
    (videoId) => backendAPI.getPlayUrl(videoId as string)
  );
}

// ==================== ARTIST DETAILS ====================

export function useArtist(artistId: string | null) {
  return useData<Artist>(
    async () => {
      if (!artistId) return {} as Artist;
      return spotifyAPI.getArtist(artistId);
    },
    {
      enabled: !!artistId,
      deps: [artistId],
    }
  );
}

export function useArtistTopTracks(artistId: string | null) {
  return useData<Track[]>(
    async () => {
      if (!artistId) return [];
      return spotifyAPI.getArtistTopTracks(artistId);
    },
    {
      enabled: !!artistId,
      deps: [artistId],
    }
  );
}

export function useArtistAlbums(artistId: string | null) {
  return useData<Album[]>(
    async () => {
      if (!artistId) return [];
      return spotifyAPI.getArtistAlbums(artistId);
    },
    {
      enabled: !!artistId,
      deps: [artistId],
    }
  );
}

export function useBackendArtistDetails(artistName: string | null) {
  return useData<{ artist: Artist; albums: Album[]; top_tracks: Track[] }>(
    async () => {
      if (!artistName) return { artist: {} as Artist, albums: [], top_tracks: [] };
      return backendAPI.getBackendArtistDetails(artistName);
    },
    {
      enabled: !!artistName,
      deps: [artistName],
    }
  );
}
