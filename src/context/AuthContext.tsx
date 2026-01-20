import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
    token: string | null;
    login: () => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(() => {
        const saved = sessionStorage.getItem('spotify_token');
        if (saved) return saved;

        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        if (tokenFromUrl) {
            sessionStorage.setItem('spotify_token', tokenFromUrl);
            return tokenFromUrl;
        }
        return null;
    });

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('token')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const login = () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:11700';
        window.location.href = `${apiUrl}/login`;
    };

    const logout = () => {
        setToken(null);
        sessionStorage.removeItem('spotify_token');
    };

    return (
        <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
