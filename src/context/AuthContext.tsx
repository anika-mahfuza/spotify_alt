import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserProfile } from '../types';

export interface AuthContextType {
    token: string | null;
    login: () => void;
    logout: () => void;
    isAuthenticated: boolean;
    userProfile: UserProfile | null;
    isUserProfileLoading: boolean;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(() => {
        const saved = localStorage.getItem('spotify_token');
        if (saved) return saved;

        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        if (tokenFromUrl) {
            localStorage.setItem('spotify_token', tokenFromUrl);
            return tokenFromUrl;
        }
        return null;
    });

    const [refreshToken, setRefreshToken] = useState<string | null>(() => {
        const saved = localStorage.getItem('spotify_refresh_token');
        if (saved) return saved;

        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('refresh_token');
        if (tokenFromUrl) {
            localStorage.setItem('spotify_refresh_token', tokenFromUrl);
            return tokenFromUrl;
        }
        return null;
    });

    const [expiresAt, setExpiresAt] = useState<number | null>(() => {
        const saved = localStorage.getItem('spotify_token_expires_at');
        if (saved) return parseInt(saved, 10);

        const urlParams = new URLSearchParams(window.location.search);
        const expiresIn = urlParams.get('expires_in');
        if (expiresIn) {
            // Calculate expiration time (current time + expires_in seconds)
            // Subtract a small buffer (e.g., 60 seconds) to refresh before actual expiration
            const expirationTime = Date.now() + (parseInt(expiresIn, 10) * 1000);
            localStorage.setItem('spotify_token_expires_at', expirationTime.toString());
            return expirationTime;
        }
        return null;
    });

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isUserProfileLoading, setIsUserProfileLoading] = useState(false);

    const logout = useCallback(() => {
        setToken(null);
        setRefreshToken(null);
        setExpiresAt(null);
        setUserProfile(null);
        setIsUserProfileLoading(false);
        
        // Clear auth data from localStorage
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expires_at');
    }, []);

    const login = () => {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) {
            console.error("VITE_API_URL is missing!");
            return;
        }
        // Pass current frontend URL (origin) to backend so it knows where to redirect back
        const frontendUrl = encodeURIComponent(window.location.origin);
        // Add timestamp to force new login and prevent caching
        window.location.href = `${apiUrl}/login?frontend_url=${frontendUrl}&t=${Date.now()}`;
    };

    // Handle Token Refresh
    useEffect(() => {
        if (!token || !refreshToken || !expiresAt) return;

        const timeUntilRefresh = expiresAt - Date.now() - 60000; // Refresh 1 minute before expiry

        const refresh = async () => {
            try {
                const apiUrl = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:11946';
                const response = await fetch(`${apiUrl}/refresh-token?refresh_token=${refreshToken}`);
                
                if (!response.ok) {
                    throw new Error('Failed to refresh token');
                }

                const data = await response.json();
                
                if (data.access_token) {
                    setToken(data.access_token);
                    localStorage.setItem('spotify_token', data.access_token);
                    
                    if (data.expires_in) {
                        const newExpiresAt = Date.now() + (data.expires_in * 1000);
                        setExpiresAt(newExpiresAt);
                        localStorage.setItem('spotify_token_expires_at', newExpiresAt.toString());
                    }
                    
                    if (data.refresh_token) {
                        setRefreshToken(data.refresh_token);
                        localStorage.setItem('spotify_refresh_token', data.refresh_token);
                    }
                }
            } catch (error) {
                console.error("Error refreshing token:", error);
                // If refresh fails, we might want to logout or just let it fail naturally
                // logout(); // Optional: logout on refresh failure
            }
        };

        // If token is already expired or about to expire, refresh immediately
        if (timeUntilRefresh <= 0) {
            refresh();
        } else {
            const timer = setTimeout(refresh, timeUntilRefresh);
            return () => clearTimeout(timer);
        }
    }, [token, refreshToken, expiresAt, logout]);

    // Cleanup URL parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('token')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // Function to get a valid access token (refreshes if necessary)
    const getAccessToken = useCallback(async () => {
        if (!refreshToken) return null;
        
        // If token exists and is valid (with 60s buffer), return it
        if (token && expiresAt && expiresAt > Date.now() + 60000) {
            return token;
        }

        // Otherwise, refresh token
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            if (!apiUrl) throw new Error("VITE_API_URL missing");

            const response = await fetch(`${apiUrl}/refresh-token?refresh_token=${refreshToken}`);
            
            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            
                if (data.access_token) {
                    setToken(data.access_token);
                    localStorage.setItem('spotify_token', data.access_token);

                    if (data.expires_in) {
                        const newExpiresAt = Date.now() + (data.expires_in * 1000);
                        setExpiresAt(newExpiresAt);
                        localStorage.setItem('spotify_token_expires_at', newExpiresAt.toString());
                    }

                    if (data.refresh_token) {
                        setRefreshToken(data.refresh_token);
                        localStorage.setItem('spotify_refresh_token', data.refresh_token);
                    }
                    return data.access_token;
                }
        } catch (error) {
            console.error("Error refreshing token:", error);
            logout();
            return null;
        }
        return null;
    }, [token, refreshToken, expiresAt, logout]);

    // Fetch User Profile
    useEffect(() => {
        if (!refreshToken) return;
        
        const abortController = new AbortController();
        setIsUserProfileLoading(true);

        const fetchProfile = async () => {
            try {
                const validToken = await getAccessToken();
                if (abortController.signal.aborted) return;
                
                if (!validToken) {
                    setIsUserProfileLoading(false);
                    return;
                }

                const res = await fetch('https://api.spotify.com/v1/me', {
                    headers: { Authorization: `Bearer ${validToken}` },
                    signal: abortController.signal
                });

                if (res.status === 401) {
                    throw new Error('Unauthorized');
                }
                
                if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`);
                
                const data = await res.json();
                if (!abortController.signal.aborted) {
                    setUserProfile(data);
                }
            } catch (err: any) {
                if (abortController.signal.aborted) return;
                console.error(err);
                if (err.message === 'Unauthorized') {
                    // Token is invalid despite refresh attempt, logout to force re-login
                    logout();
                }
                setUserProfile(null);
            } finally {
                if (!abortController.signal.aborted) {
                    setIsUserProfileLoading(false);
                }
            }
        };

        fetchProfile();

        return () => abortController.abort();
    }, [refreshToken, getAccessToken, logout]);



    return (
        <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token, userProfile, isUserProfileLoading, getAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
};
