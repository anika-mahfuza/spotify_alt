import { useCallback } from 'react';

export const useSpotifyFetch = () => {
  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const signal = init?.signal || controller.signal;

    try {
      const response = await fetch(input, { ...init, signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, []);

  return fetchWithAuth;
};
