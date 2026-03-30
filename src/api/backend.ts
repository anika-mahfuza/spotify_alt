/**
 * Backend API Service
 * 
 * All backend API calls are centralized here.
 */

import { backendClient } from './client';
import { BACKEND_ENDPOINTS, API_TIMEOUTS } from './endpoints';
import { BackendSearchResponse, BackendStreamResponse } from './types';
import { Track } from '../types';

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
