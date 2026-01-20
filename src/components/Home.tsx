import { useEffect, useState } from 'react';
import { SearchBar } from './SearchBar';
import { Clock, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import axios from 'axios';

interface Track {
    id: string;
    name: string;
    artist: string;
    album: string;
    duration_ms: number;
    image: string;
}

interface HomeProps {
    activePlaylistId: string | null;
    onTrackSelect: (track: Track, playlist: Track[]) => void;
    onSearch: (query: string) => void;
}

export function Home({ activePlaylistId, onTrackSelect, onSearch }: HomeProps) {
    const { token } = useAuth();
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);

    useEffect(() => {
        if (activePlaylistId && token) {
            setLoading(true);
            setError(null);
            axios.get(`${config.API_URL}/playlist/${activePlaylistId}`, {
                params: { token: token }
            })
                .then(res => {
                    setTracks(res.data);
                })
                .catch(err => {
                    console.error(err);
                    setError('Failed to load playlist');
                })
                .finally(() => setLoading(false));
        }
    }, [activePlaylistId, token]);

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return minutes + ":" + (Number(seconds) < 10 ? '0' : '') + seconds;
    };

    const handleTrackClick = (track: Track) => {
        onTrackSelect(track, tracks);
    };

    return (
        <div className="flex-1 bg-gradient-to-b from-[#1a1a1a] to-spotify-dark-gray overflow-y-auto pb-24 scrollbar-spotify">
            {/* Header with gradient overlay */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a1a]/95 to-transparent backdrop-blur-md px-8 py-4">
                <div className="max-w-md">
                    <SearchBar onSearch={onSearch} isLoading={false} />
                </div>
            </div>

            <div className="px-8 py-6">
                {!activePlaylistId && !loading && (
                    <div className="py-20 text-center">
                        <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
                            Good Evening
                        </h1>
                        <p className="text-spotify-text-gray text-lg">
                            Select a playlist from your library to start listening
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-spotify-text-gray border-t-spotify-green"></div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-red-400">
                        {error}
                    </div>
                )}

                {activePlaylistId && tracks.length > 0 && !loading && (
                    <div className="mt-6">
                        {/* Table Header */}
                        <div className="grid grid-cols-[16px_6fr_4fr_minmax(120px,1fr)] gap-4 px-4 py-2 text-sm font-medium text-spotify-text-gray border-b border-white/10 mb-2">
                            <div className="text-center">#</div>
                            <div>Title</div>
                            <div className="hidden md:block">Album</div>
                            <div className="flex justify-end">
                                <Clock size={16} />
                            </div>
                        </div>

                        {/* Track List */}
                        <div className="flex flex-col">
                            {tracks.map((track, index) => (
                                <div
                                    key={track.id + index}
                                    className="grid grid-cols-[16px_6fr_4fr_minmax(120px,1fr)] gap-4 px-4 py-2 rounded-md group hover:bg-white/5 cursor-pointer transition-all"
                                    onClick={() => handleTrackClick(track)}
                                    onMouseEnter={() => setHoveredTrack(track.id)}
                                    onMouseLeave={() => setHoveredTrack(null)}
                                >
                                    {/* Track Number / Play Button */}
                                    <div className="flex items-center justify-center text-spotify-text-gray">
                                        {hoveredTrack === track.id ? (
                                            <Play size={14} fill="white" className="text-white" />
                                        ) : (
                                            <span className="text-sm">{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Track Info */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img 
                                            src={track.image || 'https://via.placeholder.com/40'} 
                                            className="w-10 h-10 rounded shadow-lg flex-shrink-0" 
                                            alt="Album art" 
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-white text-sm font-medium truncate group-hover:text-spotify-green transition-colors">
                                                {track.name}
                                            </span>
                                            <span className="text-spotify-text-gray text-xs truncate">
                                                {track.artist}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Album */}
                                    <div className="hidden md:flex items-center text-sm text-spotify-text-gray truncate">
                                        {track.album}
                                    </div>

                                    {/* Duration */}
                                    <div className="flex items-center justify-end text-sm text-spotify-text-gray">
                                        {formatDuration(track.duration_ms)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
