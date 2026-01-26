import { useCallback } from 'react';
import { useAuth } from './useAuth';

export const useSpotifyFetch = () => {
    const { getAccessToken, logout } = useAuth();

    const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
        let token = await getAccessToken();

        if (!token) {
            // No token available, and refresh failed or not possible
            logout();
            throw new Error('No access token available');
        }

        // If the URL is absolute and matches our backend API, append the token
        // If it's a Spotify API call, add Authorization header
        let url = input.toString();
        let headers = new Headers(init?.headers);

        if (url.includes('api.spotify.com')) {
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            // For our backend, we usually pass token as query param
            // But we should check if the URL already has a token
            const urlObj = new URL(url, window.location.origin);
            if (!urlObj.searchParams.has('token')) {
                urlObj.searchParams.set('token', token);
                url = urlObj.toString();
            }
        }

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        const signal = init?.signal || controller.signal;

        try {
            let response = await fetch(url, { ...init, headers, signal });
            clearTimeout(timeoutId);

            // If we get a 401, it might be because the token expired *just now*
            // or the check in getAccessToken wasn't sufficient (e.g. clock skew)
            if (response.status === 401) {
                // Try to force refresh the token by calling getAccessToken again
                const newToken = await getAccessToken();
                if (newToken && newToken !== token) {
                     if (url.includes('api.spotify.com')) {
                        headers.set('Authorization', `Bearer ${newToken}`);
                    } else {
                        const urlObj = new URL(url, window.location.origin);
                        urlObj.searchParams.set('token', newToken);
                        url = urlObj.toString();
                    }
                    
                    // Retry with new token (and new timeout)
                    const retryController = new AbortController();
                    const retryTimeoutId = setTimeout(() => retryController.abort(), 15000);
                    try {
                        response = await fetch(url, { ...init, headers, signal: retryController.signal });
                    } finally {
                        clearTimeout(retryTimeoutId);
                    }
                }
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }, [getAccessToken, logout]);

    return fetchWithAuth;
};
