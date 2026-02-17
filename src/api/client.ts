import { config } from '../config';

export interface ApiError extends Error {
  status: number;
  data?: unknown;
}

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestConfig extends RequestInit {
  timeout?: number;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;
  private getToken: (() => Promise<string | null>) | null = null;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.defaultTimeout = config.timeout || 15000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  setTokenProvider(getToken: () => Promise<string | null>) {
    this.getToken = getToken;
  }

  private buildURL(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(endpoint, this.baseURL);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private async request<T>(
    method: RequestMethod,
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { timeout = this.defaultTimeout, params, skipAuth, ...fetchConfig } = config;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      let url = this.buildURL(endpoint, params);
      const headers = new Headers({
        ...this.defaultHeaders,
        ...fetchConfig.headers,
      });

      // Add auth token if available and not skipped
      if (!skipAuth && this.getToken) {
        const token = await this.getToken();
        if (token) {
          if (url.includes('api.spotify.com')) {
            headers.set('Authorization', `Bearer ${token}`);
          } else {
            // For backend API, add token as query param
            const urlObj = new URL(url);
            if (!urlObj.searchParams.has('token')) {
              urlObj.searchParams.set('token', token);
              url = urlObj.toString();
            }
          }
        }
      }

      const response = await fetch(url, {
        ...fetchConfig,
        method,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 - try to refresh token and retry once
      if (response.status === 401 && !skipAuth && this.getToken) {
        const newToken = await this.getToken();
        if (newToken) {
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);
          
          try {
            let retryUrl = this.buildURL(endpoint, params);
            const retryHeaders = new Headers({
              ...this.defaultHeaders,
              ...fetchConfig.headers,
            });

            if (retryUrl.includes('api.spotify.com')) {
              retryHeaders.set('Authorization', `Bearer ${newToken}`);
            } else {
              const urlObj = new URL(retryUrl);
              urlObj.searchParams.set('token', newToken);
              retryUrl = urlObj.toString();
            }

            const retryResponse = await fetch(retryUrl, {
              ...fetchConfig,
              method,
              headers: retryHeaders,
              signal: retryController.signal,
            });

            clearTimeout(retryTimeoutId);
            return this.handleResponse<T>(retryResponse);
          } finally {
            clearTimeout(retryTimeoutId);
          }
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = new Error(
        `API Error: ${response.status} ${response.statusText}`
      ) as ApiError;
      error.status = response.status;
      
      try {
        error.data = await response.json();
      } catch {
        // Ignore JSON parse error
      }
      
      throw error;
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // HTTP methods
  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('GET', endpoint, config);
  }

  post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('POST', endpoint, {
      ...config,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('PUT', endpoint, {
      ...config,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('PATCH', endpoint, {
      ...config,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('DELETE', endpoint, config);
  }
}

// Create API clients
export const spotifyClient = new ApiClient({
  baseURL: 'https://api.spotify.com/v1',
  timeout: 15000,
});

export const backendClient = new ApiClient({
  baseURL: config.API_URL,
  timeout: 30000, // Longer timeout for backend (streaming, search)
});

export { ApiClient };
export default ApiClient;
