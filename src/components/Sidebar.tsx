import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Home, Search, ListMusic, LogOut, Plus } from 'lucide-react';
import { config } from '../config';
import axios from 'axios';

interface Playlist {
    id: string;
    name: string;
    images: { url: string }[];
}

interface SidebarProps {
    onPlaylistSelect: (playlistId: string) => void;
    activePlaylistId: string | null;
}

export function Sidebar({ onPlaylistSelect, activePlaylistId }: SidebarProps) {
    const { token, logout } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (token) {
            setLoading(true);
            axios.get(`${config.API_URL}/playlists`, {
                params: { token: token }
            })
                .then(res => setPlaylists(res.data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [token]);

    return (
        <div className="w-[280px] bg-spotify-black h-screen flex flex-col gap-2 p-2 flex-shrink-0">
            {/* Top Navigation Card */}
            <div className="bg-spotify-gray rounded-lg p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-spotify-green rounded flex items-center justify-center">
                        <span className="text-black font-black text-lg">S</span>
                    </div>
                    <span className="text-xl font-bold text-white">Spotify</span>
                </div>

                <nav className="flex flex-col gap-4">
                    <NavItem 
                        icon={<Home size={24} />} 
                        label="Home" 
                        active={!activePlaylistId} 
                        onClick={() => onPlaylistSelect('')} 
                    />
                    <NavItem 
                        icon={<Search size={24} />} 
                        label="Search" 
                    />
                </nav>
            </div>

            {/* Library Card */}
            <div className="bg-spotify-gray rounded-lg flex-1 flex flex-col overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-spotify-text-gray">
                        <ListMusic size={24} />
                        <span className="font-semibold">Your Library</span>
                    </div>
                    <button className="text-spotify-text-gray hover:text-white transition-colors">
                        <Plus size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-spotify">
                    {loading ? (
                        <div className="p-4 text-spotify-text-gray text-sm">Loading playlists...</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {playlists.map(playlist => (
                                <PlaylistItem
                                    key={playlist.id}
                                    playlist={playlist}
                                    isActive={activePlaylistId === playlist.id}
                                    onClick={() => onPlaylistSelect(playlist.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Logout at bottom */}
                <div className="p-2 border-t border-spotify-light-gray">
                    <button 
                        onClick={logout} 
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-spotify-text-gray hover:text-white hover:bg-spotify-light-gray transition-all group"
                    >
                        <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm">Log out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function NavItem({ icon, label, active, onClick }: { 
    icon: React.ReactNode; 
    label: string; 
    active?: boolean; 
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-4 font-bold transition-all
                ${active 
                    ? 'text-white' 
                    : 'text-spotify-text-gray hover:text-white'
                }
            `}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function PlaylistItem({ playlist, isActive, onClick }: {
    playlist: Playlist;
    isActive: boolean;
    onClick: () => void;
}) {
    const imageUrl = playlist.images?.[0]?.url || 'https://via.placeholder.com/64';
    
    return (
        <div
            onClick={onClick}
            className={`
                flex items-center gap-3 p-2 rounded-md cursor-pointer
                transition-all group
                ${isActive 
                    ? 'bg-spotify-light-gray' 
                    : 'hover:bg-spotify-light-gray'
                }
            `}
        >
            <img 
                src={imageUrl} 
                alt={playlist.name}
                className="w-12 h-12 rounded object-cover flex-shrink-0 shadow-lg"
            />
            <div className="flex flex-col overflow-hidden">
                <span className={`
                    text-sm font-medium truncate
                    ${isActive ? 'text-white' : 'text-white'}
                `}>
                    {playlist.name}
                </span>
                <span className="text-xs text-spotify-text-gray">Playlist</span>
            </div>
        </div>
    );
}
