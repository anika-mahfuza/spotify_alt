/**
 * API Endpoints Configuration
 * 
 * All API endpoints are centralized here for easy maintenance.
 * When backend is added, only update the BASE_URL and endpoints here.
 */

import { config } from '../config';

// ==================== BASE URLS ====================

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
export const BACKEND_API_BASE = config.API_URL;

// ==================== SPOTIFY API ENDPOINTS ====================

export const SPOTIFY_ENDPOINTS = {
  // User
  ME: '/me',
  
  // Player
  RECENTLY_PLAYED: '/me/player/recently-played',
  
  // Browse
  FEATURED_PLAYLISTS: '/browse/featured-playlists',
  NEW_RELEASES: '/browse/new-releases',
  BROWSE_CATEGORIES: '/browse/categories',
  
  // Artists
  ARTIST: (id: string) => `/artists/${id}`,
  ARTIST_TOP_TRACKS: (id: string) => `/artists/${id}/top-tracks`,
  ARTIST_ALBUMS: (id: string) => `/artists/${id}/albums`,
  
  // Playlists
  PLAYLIST: (id: string) => `/playlists/${id}`,
  
  // Categories
  CATEGORY_PLAYLISTS: (id: string) => `/browse/categories/${id}/playlists`,
  
  // Library
  USER_PLAYLISTS: '/me/playlists',
  SAVED_TRACKS: '/me/tracks',
  SAVED_ALBUMS: '/me/albums',
  FOLLOWED_ARTISTS: '/me/following',
  TOP_TRACKS: '/me/top/tracks',
  TOP_ARTISTS: '/me/top/artists',
  
  // Search
  SEARCH: '/search',
} as const;

// ==================== BACKEND API ENDPOINTS ====================

export const BACKEND_ENDPOINTS = {
  // Auth
  LOGIN: '/login',
  CALLBACK: '/callback',
  REFRESH_TOKEN: '/refresh-token',
  
  // Search
  SEARCH: '/search',
  SEARCH_AND_PLAY: '/search-and-play',
  
  // Streaming
  PLAY: (id: string) => `/play/${id}`,
  STREAM: (id: string) => `/stream/${id}`,
  
  // Playlists
  PLAYLISTS: '/playlists',
  PLAYLIST: (id: string) => `/playlist/${id}`,
  
  // Albums
  ALBUM: (id: string) => `/album/${id}`,
  
  // Artists
  ARTIST_DETAILS: '/artist-details',
  
  // User Data
  MADE_FOR_YOU: '/made-for-you',
  TOP_TRACKS: '/top-tracks',
  TOP_ARTISTS: '/top-artists',
  RECOMMENDATIONS: '/recommendations',
  SAVED_ALBUMS: '/saved-albums',
  SAVED_TRACKS: '/saved-tracks',
  FOLLOWED_ARTISTS: '/followed-artists',
  BROWSE_CATEGORIES: '/browse-categories',
} as const;

// ==================== DEFAULT PARAMS ====================

export const DEFAULT_PARAMS = {
  LIMIT: {
    SMALL: 10,
    MEDIUM: 20,
    LARGE: 50,
  },
  MARKET: 'US',
} as const;

// ==================== TIMEOUTS ====================

export const API_TIMEOUTS = {
  DEFAULT: 15000,
  SEARCH: 30000,
  STREAM: 60000,
  PLAYLIST: 30000,
} as const;

// ==================== ERROR MESSAGES ====================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  UNAUTHORIZED: 'Session expired. Please log in again.',
  NOT_FOUND: 'Resource not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const;
