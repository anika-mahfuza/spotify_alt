/**
 * Backend API Service
 * 
 * All Backend API calls are centralized here.
 * Uses the backendClient with automatic token injection.
 */

import { backendClient } from './client';
import { BACKEND_ENDPOINTS, API_TIMEOUTS } from './endpoints';
import {
  BackendSearchResponse,
  BackendStreamResponse,
  BackendPlaylistResponse,
  BackendAlbumResponse,
  BackendMadeForYouResponse,
  BackendTopTracksResponse,
  BackendTopArtistsResponse,
  BackendRecommendationsResponse,
  BackendSavedAlbumsResponse,
  BackendUserPlaylistsResponse,
  BackendBrowseCategoriesResponse,
  BackendSavedTracksResponse,
  BackendFollowedArtistsResponse,
  BackendArtistDetailsResponse,
  RefreshTokenResponse,
} from './types';
import { Track, Playlist, Album, Artist, BrowseCategory } from '../types';

// ==================== AUTH ====================

export const refreshToken = async (refreshTokenValue: string): Promise<RefreshTokenResponse> => {
  return backendClient.get<RefreshTokenResponse>(
    BACKEND_ENDPOINTS.REFRESH_TOKEN,
    {
      params: { refresh_token: refreshTokenValue },
      skipAuth: true, // Don't need auth to refresh token
    }
  );
};

export const getLoginUrl = (frontendUrl: string): string => {
  const url = new URL(BACKEND_ENDPOINTS.LOGIN, backendClient['baseURL']);
  url.searchParams.set('frontend_url', frontendUrl);
  url.searchParams.set('t', Date.now().toString());
  return url.toString();
};

// ==================== SEARCH ====================

export const searchYouTube = async (query: string): Promise<BackendSearchResponse['results']> => {
  const response = await backendClient.get<BackendSearchResponse>(
    BACKEND_ENDPOINTS.SEARCH,
    {
      params: { q: query },
      timeout: API_TIMEOUTS.SEARCH,
    }
  );
  
  return response.results || [];
};

export const searchAndPlay = async (query: string): Promise<Track | null> => {
  const response = await backendClient.get<{ track: Track } | Track>(
    BACKEND_ENDPOINTS.SEARCH_AND_PLAY,
    {
      params: { q: query },
      timeout: API_TIMEOUTS.SEARCH,
    }
  );
  
  // Handle both response formats
  if ('track' in response) {
    return response.track;
  }
  return response;
};

// ==================== STREAMING ====================

export const getPlayUrl = async (videoId: string): Promise<string> => {
  const response = await backendClient.get<BackendStreamResponse>(
    BACKEND_ENDPOINTS.PLAY(videoId),
    {
      timeout: API_TIMEOUTS.STREAM,
    }
  );
  
  return response.url;
};

export const getStreamUrl = async (videoId: string): Promise<BackendStreamResponse> => {
  return backendClient.get<BackendStreamResponse>(
    BACKEND_ENDPOINTS.STREAM(videoId),
    {
      timeout: API_TIMEOUTS.STREAM,
    }
  );
};

// ==================== PLAYLISTS ====================

export const getBackendPlaylists = async (): Promise<Playlist[]> => {
  const response = await backendClient.get<BackendUserPlaylistsResponse | Playlist[]>(
    BACKEND_ENDPOINTS.PLAYLISTS
  );
  
  // Handle both response formats
  if (Array.isArray(response)) {
    return response.filter((p) => p && p.id);
  }
  return response.playlists?.filter((p) => p && p.id) || [];
};

export const getBackendPlaylist = async (id: string): Promise<BackendPlaylistResponse> => {
  const response = await backendClient.get<BackendPlaylistResponse | Track[]>(
    BACKEND_ENDPOINTS.PLAYLIST(id)
  );
  
  // Handle both response formats
  if (Array.isArray(response)) {
    return {
      id,
      name: 'Playlist',
      tracks: response,
    };
  }
  
  return response;
};

// ==================== ALBUMS ====================

export const getBackendAlbum = async (id: string): Promise<BackendAlbumResponse> => {
  return backendClient.get<BackendAlbumResponse>(
    BACKEND_ENDPOINTS.ALBUM(id)
  );
};

// ==================== ARTISTS ====================

export const getBackendArtistDetails = async (artistName: string): Promise<BackendArtistDetailsResponse> => {
  return backendClient.get<BackendArtistDetailsResponse>(
    BACKEND_ENDPOINTS.ARTIST_DETAILS,
    {
      params: { artistName },
    }
  );
};

// ==================== USER DATA ====================

export const getMadeForYou = async (): Promise<Playlist[]> => {
  const response = await backendClient.get<BackendMadeForYouResponse | Playlist[]>(
    BACKEND_ENDPOINTS.MADE_FOR_YOU
  );
  
  if (Array.isArray(response)) {
    return response.filter((p) => p && p.id);
  }
  return response.playlists?.filter((p) => p && p.id) || [];
};

export const getBackendTopTracks = async (): Promise<Track[]> => {
  const response = await backendClient.get<BackendTopTracksResponse | Track[]>(
    BACKEND_ENDPOINTS.TOP_TRACKS
  );
  
  if (Array.isArray(response)) {
    return response;
  }
  return response.tracks || [];
};

export const getBackendTopArtists = async (): Promise<Artist[]> => {
  const response = await backendClient.get<BackendTopArtistsResponse | Artist[]>(
    BACKEND_ENDPOINTS.TOP_ARTISTS
  );
  
  if (Array.isArray(response)) {
    return response.filter((a) => a && a.id);
  }
  return response.artists?.filter((a) => a && a.id) || [];
};

export const getBackendRecommendations = async (): Promise<Track[]> => {
  const response = await backendClient.get<BackendRecommendationsResponse | Track[]>(
    BACKEND_ENDPOINTS.RECOMMENDATIONS
  );
  
  if (Array.isArray(response)) {
    return response;
  }
  return response.tracks || [];
};

export const getBackendSavedAlbums = async (): Promise<Album[]> => {
  const response = await backendClient.get<BackendSavedAlbumsResponse | Album[]>(
    BACKEND_ENDPOINTS.SAVED_ALBUMS
  );
  
  if (Array.isArray(response)) {
    return response.filter((a) => a && a.id);
  }
  return response.albums?.filter((a) => a && a.id) || [];
};

export const getBackendSavedTracks = async (): Promise<Track[]> => {
  const response = await backendClient.get<BackendSavedTracksResponse | Track[]>(
    BACKEND_ENDPOINTS.SAVED_TRACKS
  );
  
  if (Array.isArray(response)) {
    return response;
  }
  return response.tracks || [];
};

export const getBackendFollowedArtists = async (): Promise<Artist[]> => {
  const response = await backendClient.get<BackendFollowedArtistsResponse | Artist[]>(
    BACKEND_ENDPOINTS.FOLLOWED_ARTISTS
  );
  
  if (Array.isArray(response)) {
    return response.filter((a) => a && a.id);
  }
  return response.artists?.filter((a) => a && a.id) || [];
};

export const getBackendBrowseCategories = async (): Promise<BrowseCategory[]> => {
  const response = await backendClient.get<BackendBrowseCategoriesResponse | BrowseCategory[]>(
    BACKEND_ENDPOINTS.BROWSE_CATEGORIES
  );
  
  if (Array.isArray(response)) {
    return response.filter((c) => c && c.id);
  }
  return response.categories?.filter((c) => c && c.id) || [];
};
