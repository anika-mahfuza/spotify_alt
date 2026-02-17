import { Track, Playlist, Album, Artist, BrowseCategory } from '../types';

// ==================== SPOTIFY API TYPES ====================

export interface SpotifyTrackResponse {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: { 
    name: string; 
    images?: Array<{ url: string }> 
  };
  duration_ms: number;
  preview_url?: string;
}

export interface SpotifyRecentlyPlayedItemResponse {
  track: SpotifyTrackResponse;
  played_at: string;
}

export interface SpotifyRecentlyPlayedResponse {
  items: SpotifyRecentlyPlayedItemResponse[];
  next?: string;
  cursors?: {
    after: string;
    before: string;
  };
}

export interface SpotifyFeaturedPlaylistsResponse {
  message: string;
  playlists: {
    items: Playlist[];
    next?: string;
    total: number;
  };
}

export interface SpotifyNewReleasesResponse {
  albums: {
    items: Album[];
    next?: string;
    total: number;
  };
}

export interface SpotifyArtistTopTracksResponse {
  tracks: SpotifyTrackResponse[];
}

export interface SpotifyArtistAlbumsResponse {
  items: Album[];
  next?: string;
  total: number;
}

export interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  description?: string;
  images: Array<{ url: string }>;
  owner: {
    display_name?: string;
    id: string;
  };
  tracks: {
    items: Array<{
      track: SpotifyTrackResponse;
    }>;
    next?: string;
    total: number;
  };
  followers?: {
    total: number;
  };
}

export interface SpotifyBrowseCategoriesResponse {
  categories: {
    items: Array<{
      id: string;
      name: string;
      icons?: Array<{ url: string }>;
    }>;
  };
}

export interface SpotifyCategoryPlaylistsResponse {
  playlists: {
    items: Playlist[];
  };
}

// ==================== BACKEND API TYPES ====================

export interface BackendPlaylistResponse {
  id: string;
  name: string;
  tracks: Track[];
  images?: Array<{ url: string }>;
  description?: string;
  owner?: {
    display_name?: string;
  };
}

export interface BackendAlbumResponse {
  id: string;
  name: string;
  tracks: Track[];
  images: Array<{ url: string }>;
  artists: Array<{ name: string; id: string }>;
  release_date?: string;
}

export interface BackendSearchResponse {
  results: Array<{
    id: string;
    title: string;
    duration?: number;
    thumbnail?: string;
    uploader?: string;
  }>;
}

export interface BackendStreamResponse {
  url: string;
  expires_in?: number;
}

export interface BackendMadeForYouResponse {
  playlists: Playlist[];
}

export interface BackendTopTracksResponse {
  tracks: Track[];
}

export interface BackendTopArtistsResponse {
  artists: Artist[];
}

export interface BackendRecommendationsResponse {
  tracks: Track[];
}

export interface BackendSavedAlbumsResponse {
  albums: Album[];
}

export interface BackendUserPlaylistsResponse {
  playlists: Playlist[];
}

export interface BackendBrowseCategoriesResponse {
  categories: BrowseCategory[];
}

export interface BackendSavedTracksResponse {
  tracks: Track[];
}

export interface BackendFollowedArtistsResponse {
  artists: Artist[];
}

export interface BackendArtistDetailsResponse {
  artist: Artist;
  albums: Album[];
  top_tracks: Track[];
}

// ==================== AUTH TYPES ====================

export interface LoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

// ==================== ERROR TYPES ====================

export interface ApiErrorResponse {
  error: string;
  message?: string;
  status: number;
}

// ==================== PAGINATION TYPES ====================

export interface PaginatedResponse<T> {
  items: T[];
  next?: string;
  previous?: string;
  total: number;
  limit: number;
  offset: number;
}

// ==================== UTILITY TYPES ====================

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiState<T> {
  data: T | null;
  status: ApiStatus;
  error: Error | null;
}
