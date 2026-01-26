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

        let response = await fetch(url, { ...init, headers });

        // If we get a 401, it might be because the token expired *just now*
        // or the check in getAccessToken wasn't sufficient (e.g. clock skew)
        if (response.status === 401) {
            // Try to force refresh the token by calling getAccessToken again
            // (Note: getAccessToken implementation currently relies on local state, 
            // so we might need to modify it to force refresh if needed, but for now 
            // let's assume calling it again might pick up a new token if another request refreshed it,
            // or we could add a forceRefresh param to getAccessToken)
            
            // For now, let's just retry once if we think we can get a valid token
            const newToken = await getAccessToken();
            if (newToken && newToken !== token) {
                 if (url.includes('api.spotify.com')) {
                    headers.set('Authorization', `Bearer ${newToken}`);
                } else {
                    const urlObj = new URL(url, window.location.origin);
                    urlObj.searchParams.set('token', newToken);
                    url = urlObj.toString();
                }
                response = await fetch(url, { ...init, headers });
            }
        }

        return response;
    }, [getAccessToken, logout]);

    return fetchWithAuth;
};
