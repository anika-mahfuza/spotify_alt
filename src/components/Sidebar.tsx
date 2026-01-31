import { useState, useEffect } from 'react';
import { Music, Library, Heart, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSpotifyFetch } from '../hooks/useSpotifyFetch';
import { config } from '../config';
import { Playlist } from '../types';


interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { token } = useAuth();
    const fetchWithAuth = useSpotifyFetch();
    const location = useLocation();

    // Close sidebar on route change (mobile)
    useEffect(() => {
        onClose?.();
    }, [location.pathname]);

    useEffect(() => {
        const fetchPlaylists = async () => {
            if (!token) {
                setPlaylists([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                // The fetchWithAuth hook handles appending the token
                const res = await fetchWithAuth(`${config.API_URL}/playlists`);
                if (res.ok) {
                    const data = await res.json();
                    setPlaylists(data);
                }
            } catch (err) {
                console.error('Failed to fetch playlists:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlaylists();
    }, [token, fetchWithAuth]);

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[190] md:hidden"
                    onClick={onClose}
                />
            )}

            <div
                className={`
                    flex flex-col z-[200] border-r border-white/10 transition-all duration-300 bg-transparent
                    fixed inset-y-0 left-0 w-72
                    md:static md:translate-x-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
                style={{
                    height: 'calc(100vh - 6rem)', // Matches player height logic
                }}
            >
                <div className="p-5 pb-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 bg-bg-secondary rounded-lg flex items-center justify-center">
                            <Music size={20} className="text-primary" />
                        </div>
                        <span className="text-xl font-semibold text-white">
                            Music
                        </span>
                    </Link>
                    {/* Mobile Close Button */}
                    <button 
                        onClick={onClose}
                        className="md:hidden p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

            <nav className="px-3 mb-4 space-y-1">
                <Link
                    to="/"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${location.pathname === '/'
                        ? 'bg-white/10 text-white backdrop-blur-sm'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Library size={20} />
                    <span className="font-medium text-sm">Your Library</span>
                </Link>
                <Link
                    to="/collection/tracks"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${location.pathname === '/collection/tracks'
                        ? 'bg-white/10 text-white backdrop-blur-sm hover:bg-white/10'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                        }`}
                >
                    <div className="w-5 h-5 bg-gradient-to-br from-[#450af5] to-[#c4efd9] rounded-sm flex items-center justify-center">
                        <Heart size={12} className="text-white fill-white" />
                    </div>
                    <span className="font-medium text-sm">Liked Songs</span>
                </Link>
            </nav>

            <div className="px-5 pb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Playlists
                </h2>
                {playlists.length > 0 && (
                    <span className="text-xs text-text-muted bg-black/30 px-2 py-0.5 rounded-full">
                        {playlists.length}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
                {isLoading ? (
                    <div className="flex flex-col gap-2 px-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                                <div className="w-10 h-10 bg-black/30 rounded" />
                                <div className="flex-1">
                                    <div className="h-3.5 bg-black/30 rounded w-3/4 mb-1.5" />
                                    <div className="h-3 bg-black/30 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : playlists.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-black/30 flex items-center justify-center">
                            <Music size={22} className="text-text-muted" />
                        </div>
                        <p className="text-text-muted text-sm">
                            No playlists yet
                        </p>
                        <p className="text-text-disabled text-xs mt-1">
                            Create your first playlist
                        </p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {playlists.map((playlist) => {
                            const isActive = location.pathname === `/playlist/${playlist.id}`;
                            return (
                                <Link
                                    key={playlist.id}
                                    to={`/playlist/${playlist.id}`}
                                    className={`
                                        flex items-center gap-3 p-2 rounded-md
                                        transition-all duration-150 group
                                        ${isActive
                                            ? 'bg-white/10 backdrop-blur-sm'
                                            : 'hover:bg-white/5'
                                        }
                                    `}
                                >
                                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-bg-secondary shadow-card">
                                        {playlist.images?.[0]?.url ? (
                                            <img
                                                src={playlist.images[0].url}
                                                alt={playlist.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-bg-tertiary">
                                                <Music size={16} className="text-text-muted" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`
                                            font-medium text-sm truncate
                                            ${isActive ? 'text-white' : 'text-text-primary group-hover:text-white'}
                                        `}>
                                            {playlist.name}
                                        </div>
                                        <div className="text-xs text-text-muted truncate flex items-center gap-1.5">
                                            <span>Playlist</span>
                                            <span className="text-text-disabled">•</span>
                                            <span className="truncate">
                                                {playlist.owner?.display_name || 'You'}
                                            </span>
                                        </div>
                                    </div>

                                    {isActive && (
                                        <div className="w-1 h-6 bg-primary rounded-full animate-scaleIn"></div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
        </>
    );
}
