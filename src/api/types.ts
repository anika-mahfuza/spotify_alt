// ==================== BACKEND API TYPES ====================

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
  title?: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
}

export interface BackendBestMatchResponse {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  candidates?: string[];
}

// ==================== ERROR TYPES ====================

export interface ApiErrorResponse {
  error: string;
  message?: string;
  status: number;
}
