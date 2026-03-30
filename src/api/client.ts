import { config } from '../config';

export interface ApiError extends Error {
  status: number;
  data?: unknown;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, timeout: number = 15000) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
    this.defaultHeaders = { 'Content-Type': 'application/json' };
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

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = new Error(`API Error: ${response.status} ${response.statusText}`) as ApiError;
      error.status = response.status;
      try { error.data = await response.json(); } catch { /* ignore */ }
      throw error;
    }
    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { timeout = this.defaultTimeout, params, ...fetchConfig } = config;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = this.buildURL(endpoint, params);
      const response = await fetch(url, {
        ...fetchConfig,
        method: 'GET',
        headers: { ...this.defaultHeaders, ...fetchConfig.headers as Record<string, string> },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Request timeout');
      throw error;
    }
  }
}

export const backendClient = new ApiClient(config.API_URL, 30000);
export { ApiClient };
export default ApiClient;
