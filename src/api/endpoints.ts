/**
 * API Endpoints Configuration
 */

import { config } from '../config';

// ==================== BASE URLS ====================

export const BACKEND_API_BASE = config.API_URL;

// ==================== BACKEND API ENDPOINTS ====================

export const BACKEND_ENDPOINTS = {
  // Search
  SEARCH: '/search',
  SEARCH_AND_PLAY: '/search-and-play',
  BEST_MATCH: '/api/best-match',

  // Streaming
  PLAY: (id: string) => `/play/${id}`,
  STREAM: (id: string) => `/stream/${id}`,

  // Playlist Import
  IMPORT_PLAYLIST: '/api/import-playlist',
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
  NOT_FOUND: 'Resource not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const;
