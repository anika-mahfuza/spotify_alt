import { useEffect, useState, useRef, Dispatch, SetStateAction, useMemo } from 'react';
import { Clock, Play, Pause, Search as SearchIcon, X, Music, Disc, Shuffle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSpotifyFetch } from '../hooks/useSpotifyFetch';
import { useNavigate } from 'react-router-dom';
import { config } from '../config';
import { Track, Playlist, RecentlyPlayedItem, Album, Artist, BrowseCategory } from '../types';

type SpotifyTrack = {
    id: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    album: { name: string; images?: Array<{ url: string }> };
    duration_ms: number;
};

type SpotifyRecentlyPlayedItem = {
    track: SpotifyTrack;
    played_at: string;
};

interface HomeProps {
    activePlaylistId: string | null;
    activeAlbumId?: string | null;
    activeArtistId?: string | null;
    onTrackSelect: (track: Track, playlist: Track[], contextId?: string) => void;
    playlistName?: string;
    currentTrack?: Track | null;
    isPlaying?: boolean;
    setIsPlaying?: Dispatch<SetStateAction<boolean>>;
    playingContextId?: string | null;
}

const SONGS_PER_PAGE = 50;

function MediaCard({
    image,
    title,
    subtitle,
    onClick,
    onPlay,
    isRound = false,
    showPlayButton = true,
    isPlaying = false,
    isActive = false
}: {
    image?: string;
    title: string;
    subtitle?: string;
    onClick: () => void;
    onPlay?: () => void;
    isRound?: boolean;
    showPlayButton?: boolean;
    isPlaying?: boolean;
    isActive?: boolean;
}) {
    return (
        <div
            className="group bg-white/5 hover:bg-white/10 backdrop-blur-md p-3 md:p-4 rounded-md transition-all duration-200 cursor-pointer border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl hover:scale-[1.02] flex-shrink-0 w-[140px] md:w-auto snap-start"
            onClick={onClick}
        >
            <div className={`relative mb-3 aspect-square ${isRound ? 'rounded-full' : 'rounded'} overflow-hidden`}>
                {image ? (
                    <img
                        src={image}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className={`w-full h-full bg-white/5 backdrop-blur-sm flex items-center justify-center ${isRound ? 'rounded-full' : ''}`}>
                        <Music size={32} className="text-text-muted" />
                    </div>
                )}

                {showPlayButton && (
                    <button
                        className={`absolute right-1.5 bottom-1.5 md:right-2 md:bottom-2 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg play-btn-hover
                            ${isActive 
                                ? 'bg-primary opacity-100 translate-y-0' 
                                : 'bg-white/60 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                            }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onPlay) onPlay();
                            else onClick();
                        }}
                    >
                        {isActive && isPlaying ? (
                            <Pause size={16} className="md:w-[18px] md:h-[18px] text-white" fill="white" />
                        ) : (
                            <Play size={16} className="md:w-[18px] md:h-[18px] ml-0.5 text-white" fill="white" />
                        )}
                    </button>
                )}
            </div>

            <h3 className={`font-medium text-sm truncate mb-0.5 ${isActive ? 'text-primary' : 'text-white'}`} title={title}>
                {title}
            </h3>
            {subtitle && (
                <p
                    className="text-xs text-text-muted line-clamp-2 leading-normal"
                    dangerouslySetInnerHTML={{ __html: subtitle }}
                />
            )}
        </div>
    );
}

function QuickPlayCard({
    image,
    title,
    onClick,
    onPlay,
    isActive = false,
    isPlaying = false
}: {
    image?: string;
    title: string;
    onClick: () => void;
    onPlay?: () => void;
    isActive?: boolean;
    isPlaying?: boolean;
}) {
    return (
        <div
            className="group flex items-center bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-md overflow-hidden transition-all duration-200 cursor-pointer h-[56px] md:h-[64px] border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl hover:scale-[1.02]"
            onClick={onClick}
        >
            <div className="w-14 h-14 md:w-16 md:h-16 flex-shrink-0 shadow-card">
                {image ? (
                    <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="w-full h-full bg-white/5 backdrop-blur-sm flex items-center justify-center">
                        <Music size={20} className="text-text-muted" />
                    </div>
                )}
            </div>
            <span className={`flex-1 font-medium text-xs sm:text-sm px-2 sm:px-3 truncate ${isActive ? 'text-primary' : 'text-white'}`}>{title}</span>
            <button
                className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-200 mr-1.5 md:mr-2 shadow-lg flex-shrink-0 play-btn-hover
                    ${isActive 
                        ? 'bg-primary opacity-100' 
                        : 'bg-white/60 opacity-0 group-hover:opacity-100'
                    }`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onPlay) onPlay();
                }}
            >
                {isActive && isPlaying ? (
                    <Pause size={16} className="md:w-[18px] md:h-[18px] text-white" fill="white" />
                ) : (
                    <Play size={16} className="md:w-[18px] md:h-[18px] ml-0.5 text-white" fill="white" />
                )}
            </button>
        </div>
    );
}

function SectionHeader({ title, showAll, onShowAll }: { title: string; showAll?: boolean; onShowAll?: () => void }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white hover:underline cursor-pointer tracking-tight">{title}</h2>
            {showAll && onShowAll && (
                <button
                    onClick={onShowAll}
                    className="text-sm font-medium text-text-secondary hover:text-white uppercase tracking-wider transition-colors"
                >
                    Show all
                </button>
            )}
        </div>
    );
}

function ScrollSection({
    title,
    children,
    isEmpty
}: {
    title: string;
    children: React.ReactNode;
    isEmpty?: boolean;
}) {
    if (isEmpty) return null;

    return (
        <section className="mb-6">
            <SectionHeader title={title} />
            <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 md:gap-4 md:overflow-visible md:pb-0">
                {children}
            </div>
        </section>
    );
}

export function Home({ activePlaylistId, activeAlbumId, activeArtistId, onTrackSelect, currentTrack, isPlaying, setIsPlaying, playingContextId }: HomeProps) {
    const { token } = useAuth();
    const fetchWithAuth = useSpotifyFetch();
    const navigate = useNavigate();
    const [allTracks, setAllTracks] = useState<Track[]>([]);
    const [displayedTracks, setDisplayedTracks] = useState<Track[]>([]);
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [artist, setArtist] = useState<Artist | null>(null);
    const [artistAlbums, setArtistAlbums] = useState<Album[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);
    const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
    const [displayCount, setDisplayCount] = useState(SONGS_PER_PAGE);
    const observerTarget = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Dashboard State
    const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>([]);
    const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>([]);
    const [newReleases, setNewReleases] = useState<Album[]>([]);
    const [madeForYou, setMadeForYou] = useState<Playlist[]>([]);
    const [topTracks, setTopTracks] = useState<Track[]>([]);
    const [topArtists, setTopArtists] = useState<Artist[]>([]);
    const [recommendations, setRecommendations] = useState<Track[]>([]);
    const [savedAlbums, setSavedAlbums] = useState<Album[]>([]);
    const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
    const [browseCategories, setBrowseCategories] = useState<BrowseCategory[]>([]);
    const [likedSongs, setLikedSongs] = useState<Track[]>([]);
    const [followedArtists, setFollowedArtists] = useState<Artist[]>([]);

    // Helper to convert Spotify track to internal Track format
    const toTrack = (t: SpotifyTrack): Track => ({
        id: t.id,
        name: t.name,
        artist: t.artists?.map(a => a.name).join(', ') || 'Unknown',
        album: t.album?.name || 'Unknown',
        duration_ms: t.duration_ms || 0,
        image: t.album?.images?.[0]?.url
    });

    // Greeting based on time
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Fetch Dashboard Data
    useEffect(() => {
        if (!activePlaylistId && !activeAlbumId && token) {
            setLoading(true);

            const fetchDashboard = async () => {
                try {
                    // Helper to parse JSON from fetch response
                    const fetchJson = async (url: string) => {
                        const res = await fetchWithAuth(url);
                        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
                        return res.json();
                    };

                    // Fetch ALL dashboard data in parallel - NO COUNTRY for featured playlists (avoids 404)
                    const [
                        recentRes,
                        featuredRes,
                        releasesRes,
                        madeForYouRes,
                        topTracksRes,
                        topArtistsRes,
                        recommendationsRes,
                        savedAlbumsRes,
                        userPlaylistsRes,
                        browseCategoriesRes,
                        likedSongsRes,
                        followedArtistsRes
                    ] = await Promise.allSettled([
                        // Recently Played - Direct Spotify API
                        fetchJson('https://api.spotify.com/v1/me/player/recently-played?limit=20'),
                        // Featured Playlists
                        fetchJson('https://api.spotify.com/v1/browse/featured-playlists?limit=20'),
                        // New Releases
                        fetchJson('https://api.spotify.com/v1/browse/new-releases?limit=20'),
                        // Made For You (via backend)
                        fetchJson(`${config.API_URL}/made-for-you`),
                        // Top Tracks (via backend)
                        fetchJson(`${config.API_URL}/top-tracks`),
                        // Top Artists (via backend)
                        fetchJson(`${config.API_URL}/top-artists`),
                        // Recommendations (via backend)
                        fetchJson(`${config.API_URL}/recommendations`),
                        // Saved Albums (via backend)
                        fetchJson(`${config.API_URL}/saved-albums`),
                        // User Playlists (via backend)
                        fetchJson(`${config.API_URL}/playlists`),
                        // Browse Categories (via backend)
                        fetchJson(`${config.API_URL}/browse-categories`),
                        // Liked Songs (via backend)
                        fetchJson(`${config.API_URL}/saved-tracks`),
                        // Followed Artists (via backend)
                        fetchJson(`${config.API_URL}/followed-artists`)
                    ]);

                    // Process Recently Played - deduplicate
                    if (recentRes.status === 'fulfilled') {
                        const items = (recentRes.value as { items: SpotifyRecentlyPlayedItem[] }).items || [];
                        const seen = new Set<string>();
                        const uniqueItems = items.filter(item => {
                            if (!item?.track?.id || seen.has(item.track.id)) return false;
                            seen.add(item.track.id);
                            return true;
                        });
                        setRecentlyPlayed(uniqueItems.map((i) => ({
                            track: toTrack(i.track),
                            played_at: i.played_at
                        })));
                    }

                    // Process Featured Playlists
                    if (featuredRes.status === 'fulfilled') {
                        const items = (featuredRes.value as any).playlists?.items || [];
                        setFeaturedPlaylists(items.filter((p: Playlist) => p && p.id));
                    }

                    // Process New Releases
                    if (releasesRes.status === 'fulfilled') {
                        const items = (releasesRes.value as any).albums?.items || [];
                        setNewReleases(items.filter((a: Album) => a && a.id));
                    }

                    // Process Made For You
                    if (madeForYouRes.status === 'fulfilled' && Array.isArray(madeForYouRes.value)) {
                        setMadeForYou(madeForYouRes.value.filter((p: Playlist) => p && p.id));
                    }

                    // Process Top Tracks
                    if (topTracksRes.status === 'fulfilled' && Array.isArray(topTracksRes.value)) {
                        setTopTracks(topTracksRes.value.map(toTrack));
                    }

                    // Process Top Artists
                    if (topArtistsRes.status === 'fulfilled' && Array.isArray(topArtistsRes.value)) {
                        setTopArtists(topArtistsRes.value.filter((a: Artist) => a && a.id));
                    }

                    // Process Recommendations
                    if (recommendationsRes.status === 'fulfilled' && Array.isArray(recommendationsRes.value)) {
                        setRecommendations(recommendationsRes.value.map(toTrack));
                    }

                    // Process Saved Albums
                    if (savedAlbumsRes.status === 'fulfilled' && Array.isArray(savedAlbumsRes.value)) {
                        setSavedAlbums(savedAlbumsRes.value.filter((a: Album) => a && a.id));
                    }

                    // Process User Playlists
                    if (userPlaylistsRes.status === 'fulfilled' && Array.isArray(userPlaylistsRes.value)) {
                        setUserPlaylists(userPlaylistsRes.value.filter((p: Playlist) => p && p.id));
                    }

                    // Process Browse Categories
                    if (browseCategoriesRes.status === 'fulfilled' && Array.isArray(browseCategoriesRes.value)) {
                        setBrowseCategories(browseCategoriesRes.value.filter((c: BrowseCategory) => c && c.id));
                    }

                    // Process Liked Songs
                    if (likedSongsRes.status === 'fulfilled' && Array.isArray(likedSongsRes.value)) {
                        setLikedSongs(likedSongsRes.value.map(toTrack));
                    }

                    // Process Followed Artists
                    if (followedArtistsRes.status === 'fulfilled' && Array.isArray(followedArtistsRes.value)) {
                        setFollowedArtists(followedArtistsRes.value.filter((a: Artist) => a && a.id));
                    }

                } catch (err) {
                    console.error("Dashboard fetch error", err);
                    setError('Failed to load dashboard data. Please check your internet connection or try again later.');
                } finally {
                    setLoading(false);
                }
            };

            fetchDashboard();
        }
    }, [activePlaylistId, activeAlbumId, token, fetchWithAuth, retryTrigger]);

    useEffect(() => {
        if ((activePlaylistId || activeAlbumId || activeArtistId) && token) {
            setLoading(true);
            setError(null);
            setPlaylistSearchQuery('');
            setDisplayCount(SONGS_PER_PAGE);

            if (activeArtistId) {
                const fetchJson = async (url: string) => {
                    const res = await fetchWithAuth(url);
                    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
                    return res.json();
                };

                Promise.all([
                    fetchJson(`https://api.spotify.com/v1/artists/${activeArtistId}`),
                    fetchJson(`https://api.spotify.com/v1/artists/${activeArtistId}/top-tracks?market=US`),
                    fetchJson(`https://api.spotify.com/v1/artists/${activeArtistId}/albums?include_groups=album,single&limit=50`)
                ])
                .then(([artistData, tracksData, albumsData]) => {
                    setArtist(artistData);
                    const tracks = tracksData.tracks.map(toTrack);
                    setAllTracks(tracks);
                    setFilteredTracks(tracks);
                    setDisplayedTracks(tracks.slice(0, SONGS_PER_PAGE));
                    
                    const uniqueAlbums = new Map();
                    albumsData.items.forEach((album: Album) => {
                        if (!uniqueAlbums.has(album.name)) {
                            uniqueAlbums.set(album.name, album);
                        }
                    });
                    setArtistAlbums(Array.from(uniqueAlbums.values()));
                })
                .catch(err => {
                    console.error(err);
                    setError('Failed to load artist details');
                })
                .finally(() => setLoading(false));
                return;
            }

            const isAlbum = !!activeAlbumId;
            const isLikedSongs = activePlaylistId === 'liked-songs';
            
            if (isLikedSongs) {
                 setAllTracks(likedSongs);
                 setFilteredTracks(likedSongs);
                 setDisplayedTracks(likedSongs.slice(0, SONGS_PER_PAGE));
                 setPlaylist({
                     id: 'liked-songs',
                     name: 'Liked Songs',
                     images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-64.png' }],
                     description: 'Your liked songs'
                 });
                 setLoading(false);
                 return;
            }

            const endpoint = isAlbum ? `/album/${activeAlbumId}` : `/playlist/${activePlaylistId}`;

            fetchWithAuth(`${config.API_URL}${endpoint}`)
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
                    return res.json();
                })
                .then(data => {
                    if (isAlbum) {
                        setAllTracks(data.tracks);
                        setFilteredTracks(data.tracks);
                        setDisplayedTracks(data.tracks.slice(0, SONGS_PER_PAGE));
                        setPlaylist({
                            id: activeAlbumId!,
                            name: data.name,
                            images: data.images
                        });
                    } else {
                        setAllTracks(data);
                        setFilteredTracks(data);
                        setDisplayedTracks(data.slice(0, SONGS_PER_PAGE));
                    }
                })
                .catch(err => {
                    console.error(err);
                    setError(isAlbum ? 'Failed to load album' : 'Failed to load playlist');
                })
                .finally(() => setLoading(false));

            if (!isAlbum) {
                fetchWithAuth(`https://api.spotify.com/v1/playlists/${activePlaylistId}`)
                    .then(res => {
                        if (!res.ok) throw new Error('Failed to fetch playlist details');
                        return res.json();
                    })
                    .then(data => {
                        setPlaylist({
                            id: data.id,
                            name: data.name,
                            description: data.description,
                            images: data.images
                        });
                    })
                    .catch(err => console.error('Failed to fetch playlist details:', err));
            }
        } else {
            setAllTracks([]);
            setFilteredTracks([]);
            setDisplayedTracks([]);
            setPlaylist(null);
            setArtist(null);
            setArtistAlbums([]);
            setPlaylistSearchQuery('');
        }
    }, [activePlaylistId, activeAlbumId, activeArtistId, token, fetchWithAuth, likedSongs]);

    // Filter tracks based on playlist search query
    useEffect(() => {
        if (playlistSearchQuery.trim()) {
            const query = playlistSearchQuery.toLowerCase();
            const filtered = allTracks.filter(track =>
                track.name.toLowerCase().includes(query) ||
                track.artist.toLowerCase().includes(query) ||
                track.album.toLowerCase().includes(query)
            );
            setFilteredTracks(filtered);
            setDisplayCount(SONGS_PER_PAGE);
            setDisplayedTracks(filtered.slice(0, SONGS_PER_PAGE));
        } else {
            setFilteredTracks(allTracks);
            setDisplayCount(SONGS_PER_PAGE);
            setDisplayedTracks(allTracks.slice(0, SONGS_PER_PAGE));
        }
    }, [playlistSearchQuery, allTracks]);

    useEffect(() => {
        setDisplayedTracks(filteredTracks.slice(0, displayCount));
    }, [displayCount, filteredTracks]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && displayCount < filteredTracks.length) {
                    setDisplayCount(prev => Math.min(prev + SONGS_PER_PAGE, filteredTracks.length));
                }
            },
            { threshold: 0.1 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) observer.observe(currentTarget);
        return () => { if (currentTarget) observer.unobserve(currentTarget); };
    }, [displayCount, filteredTracks.length]);

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return minutes + ":" + (Number(seconds) < 10 ? '0' : '') + seconds;
    };

    const handleTrackClick = (track: Track) => onTrackSelect(track, allTracks);

    const handleTrackCardClick = (track: Track, trackList: Track[], contextId?: string) => {
        if (currentTrack?.id === track.id) {
            setIsPlaying && setIsPlaying(!isPlaying);
        } else {
            onTrackSelect(track, trackList.length > 0 ? trackList : [track], contextId);
        }
    };

    const playPlaylist = async (id: string, type: 'playlist' | 'album' | 'artist') => {
        if (playingContextId === id) {
             setIsPlaying && setIsPlaying(!isPlaying);
             return;
        }

        try {
            let tracks: Track[] = [];
            if (type === 'playlist') {
                if (id === 'liked-songs') {
                     if (likedSongs.length > 0) tracks = likedSongs;
                     else {
                         const res = await fetchWithAuth(`${config.API_URL}/saved-tracks`);
                         if (!res.ok) throw new Error('Failed to fetch saved tracks');
                         const data = await res.json();
                         if (Array.isArray(data)) tracks = data.map(toTrack);
                     }
                } else {
                     // For user playlists, we might need to fetch tracks if not already loaded
                     // We don't have a direct "get tracks for playlist" endpoint that returns just tracks?
                     // The /playlist/:id endpoint returns playlist object with tracks.
                     const res = await fetchWithAuth(`${config.API_URL}/playlist/${id}`);
                     if (!res.ok) throw new Error('Failed to fetch playlist');
                     const data = await res.json();
                     tracks = Array.isArray(data) ? data : (data.tracks || []);
                }
            } else if (type === 'album') {
                 const res = await fetchWithAuth(`${config.API_URL}/album/${id}`);
                 if (!res.ok) throw new Error('Failed to fetch album');
                 const data = await res.json();
                 tracks = data.tracks || [];
            } else if (type === 'artist') {
                 const res = await fetchWithAuth(`https://api.spotify.com/v1/artists/${id}/top-tracks?market=US`);
                 if (!res.ok) throw new Error('Failed to fetch artist top tracks');
                 const data = await res.json();
                 tracks = data.tracks.map(toTrack);
            }

            if (tracks.length > 0) {
                 onTrackSelect(tracks[0], tracks, id);
                 setIsPlaying && setIsPlaying(true);
            }
        } catch (err) {
            console.error("Failed to play playlist", err);
        }
    };

    const handlePlayPauseClick = (track: Track) => {
        if (!setIsPlaying) { handleTrackClick(track); return; }
        if (currentTrack?.id === track.id) { setIsPlaying(prev => !prev); return; }
        const contextId = activePlaylistId || activeAlbumId || activeArtistId || undefined;
        onTrackSelect(track, allTracks, contextId);
        setIsPlaying(true);
    };

    const playTrackFromSection = (track: Track, trackList: Track[], contextId?: string) => {
        onTrackSelect(track, trackList.length > 0 ? trackList : [track], contextId);
    };

    // Generate dominant color for header gradient from playlist image
    const headerGradient = useMemo(() => {
        const colors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#4a0e4e', '#2c3e50', '#1e3c72'];
        const key = activeAlbumId || activePlaylistId || activeArtistId || 'home';
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        return colors[hash % colors.length];
    }, [activePlaylistId, activeAlbumId, activeArtistId]);

    return (
        <>
            <style>{`
                .play-btn-hover:hover {
                    background-color: var(--accent-color-hover, var(--accent-color, #1ed760)) !important;
                    background: var(--accent-color-hover, var(--accent-color, #1ed760)) !important;
                }
            `}</style>
            <div className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))]">
            {!activePlaylistId && !activeAlbumId && !activeArtistId && !loading && (
                <div className="min-h-full">
                    <div className="px-6 pt-6 pb-5">
                        <h1 className="text-2xl font-bold text-white tracking-tight mb-5">{greeting}</h1>

                        {(likedSongs.length > 0 || userPlaylists.length > 0 || recentlyPlayed.length > 0) && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-6">
                                {/* Recently Played (Fill slots) - Prioritizing Recently Played as per user request to remove static library links from here */}
                                {recentlyPlayed.slice(0, 8).map((item, idx) => (
                                    <QuickPlayCard
                                        key={`${item.track.id}-${idx}`}
                                        image={item.track.image}
                                        title={item.track.name}
                                        onClick={() => {
                                             handleTrackCardClick(item.track, recentlyPlayed.map(r => r.track));
                                        }}
                                        onPlay={() => handleTrackCardClick(item.track, recentlyPlayed.map(r => r.track))}
                                        isActive={currentTrack?.id === item.track.id}
                                        isPlaying={isPlaying}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 space-y-6">
                        <ScrollSection title="Made For You" isEmpty={madeForYou.length === 0}>
                            {madeForYou.slice(0, 7).map(playlist => (
                                <MediaCard
                                    key={playlist.id}
                                    image={playlist.images?.[0]?.url}
                                    title={playlist.name}
                                    subtitle={playlist.description}
                                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                                    onPlay={() => playPlaylist(playlist.id, 'playlist')}
                                    isActive={playingContextId === playlist.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Recommended For You" isEmpty={recommendations.length === 0}>
                            {recommendations.slice(0, 7).map(track => (
                                <MediaCard
                                    key={track.id}
                                    image={track.image}
                                    title={track.name}
                                    subtitle={track.artist}
                                    onClick={() => handleTrackCardClick(track, recommendations)}
                                    isActive={currentTrack?.id === track.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Your Top Tracks" isEmpty={topTracks.length === 0}>
                            {topTracks.slice(0, 7).map(track => (
                                <MediaCard
                                    key={track.id}
                                    image={track.image}
                                    title={track.name}
                                    subtitle={track.artist}
                                    onClick={() => handleTrackCardClick(track, topTracks)}
                                    isActive={currentTrack?.id === track.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Your Top Artists" isEmpty={topArtists.length === 0}>
                            {topArtists.slice(0, 7).map(artist => (
                                <MediaCard
                                    key={artist.id}
                                    image={artist.images?.[0]?.url}
                                    title={artist.name}
                                    subtitle="Artist"
                                    onClick={() => navigate(`/artist/${artist.id}`)}
                                    isRound
                                    showPlayButton={false}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Artists You Follow" isEmpty={followedArtists.length === 0}>
                            {followedArtists.slice(0, 7).map(artist => (
                                <MediaCard
                                    key={artist.id}
                                    image={artist.images?.[0]?.url}
                                    title={artist.name}
                                    subtitle="Artist"
                                    onClick={() => navigate(`/artist/${artist.id}`)}
                                    isRound
                                    showPlayButton={false}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Your Playlists" isEmpty={userPlaylists.length === 0}>
                            {userPlaylists.slice(0, 7).map(playlist => (
                                <MediaCard
                                    key={playlist.id}
                                    image={playlist.images?.[0]?.url}
                                    title={playlist.name}
                                    subtitle={playlist.description || 'Playlist'}
                                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                                    onPlay={() => playPlaylist(playlist.id, 'playlist')}
                                    isActive={playingContextId === playlist.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Your Albums" isEmpty={savedAlbums.length === 0}>
                            {savedAlbums.slice(0, 7).map(album => (
                                <MediaCard
                                    key={album.id}
                                    image={album.images?.[0]?.url}
                                    title={album.name}
                                    subtitle={album.artists?.map(a => a.name).join(', ')}
                                    onClick={() => navigate(`/album/${album.id}`)}
                                    onPlay={() => playPlaylist(album.id, 'album')}
                                    isActive={playingContextId === album.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="Featured Playlists" isEmpty={featuredPlaylists.length === 0}>
                            {featuredPlaylists.slice(0, 7).map(playlist => (
                                <MediaCard
                                    key={playlist.id}
                                    image={playlist.images?.[0]?.url}
                                    title={playlist.name}
                                    subtitle={playlist.description}
                                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                                    onPlay={() => playPlaylist(playlist.id, 'playlist')}
                                    isActive={playingContextId === playlist.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        <ScrollSection title="New Releases" isEmpty={newReleases.length === 0}>
                            {newReleases.slice(0, 7).map(album => (
                                <MediaCard
                                    key={album.id}
                                    image={album.images?.[0]?.url}
                                    title={album.name}
                                    subtitle={album.artists?.map(a => a.name).join(', ')}
                                    onClick={() => navigate(`/album/${album.id}`)}
                                    onPlay={() => playPlaylist(album.id, 'album')}
                                    isActive={playingContextId === album.id}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </ScrollSection>

                        {browseCategories.length > 0 && (
                            <section className="mb-6">
                                <SectionHeader title="Browse All" />
                                <div className="space-y-8">
                                    {browseCategories.slice(0, 3).map((category) => (
                                        category.playlists && category.playlists.length > 0 && (
                                            <div key={category.id}>
                                                <h3 className="text-lg font-bold text-white mb-3">{category.name}</h3>
                                                <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 md:gap-4 md:overflow-visible md:pb-0">
                                                    {category.playlists.slice(0, 7).map(playlist => (
                                                        <MediaCard
                                                            key={playlist.id}
                                                            image={playlist.images?.[0]?.url}
                                                            title={playlist.name}
                                                            subtitle={playlist.description}
                                                            onClick={() => navigate(`/playlist/${playlist.id}`)}
                                                            onPlay={() => playPlaylist(playlist.id, 'playlist')}
                                                            isActive={playingContextId === playlist.id}
                                                            isPlaying={isPlaying}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </section>
                        )}

                        {recentlyPlayed.length === 0 &&
                            featuredPlaylists.length === 0 &&
                            newReleases.length === 0 &&
                            topTracks.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10">
                                        <Music size={36} className="text-primary" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-2">Start listening</h2>
                                    <p className="text-text-muted max-w-md mx-auto">
                                        Play some music to see your personalized recommendations and recently played tracks here.
                                    </p>
                                </div>
                            )}
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-2 border-bg-tertiary border-t-primary rounded-full animate-spin"></div>
                        <p className="text-text-muted text-sm">Loading...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mx-6 my-4 bg-accent-pink/20 text-accent-pink p-4 rounded-md text-sm font-medium flex flex-col items-start gap-3">
                    <p>{error}</p>
                    <button 
                        onClick={() => setRetryTrigger(prev => prev + 1)}
                        className="px-4 py-2 bg-accent-pink text-white rounded hover:bg-accent-pink/90 transition-colors font-bold"
                    >
                        Retry
                    </button>
                </div>
            )}

            {(activePlaylistId || activeAlbumId || activeArtistId) && allTracks.length > 0 && !loading && (
                <div className="min-h-full">
                    <div
                        className="px-6 pt-12 pb-5"
                        style={{
                            background: `linear-gradient(180deg, ${headerGradient} 0%, transparent 100%)`,
                        }}
                    >
                        <div className="flex gap-5 items-end mb-5">
                            <div className="w-40 h-40 lg:w-48 lg:h-48 flex-shrink-0 shadow-elevated">
                                {(activeArtistId ? artist?.images?.[0]?.url : playlist?.images?.[0]?.url) ? (
                                    <img
                                        src={(activeArtistId ? artist?.images?.[0]?.url : playlist?.images?.[0]?.url) || ''}
                                        alt={activeArtistId ? artist?.name : playlist?.name}
                                        className={`w-full h-full object-cover shadow-card ${activeArtistId ? 'rounded-full' : 'rounded'}`}
                                    />
                                ) : (
                                    <div className={`w-full h-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 ${activeArtistId ? 'rounded-full' : 'rounded'}`}>
                                        <Disc size={56} className="text-text-muted" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col justify-end">
                                <span className="text-xs font-medium uppercase text-white mb-1.5">
                                    {activeAlbumId ? 'Album' : activeArtistId ? 'Artist' : 'Playlist'}
                                </span>
                                <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3 leading-tight">
                                    {activeArtistId ? artist?.name : (playlist?.name || 'Playlist')}
                                </h1>
                                {playlist?.description && !activeArtistId && (
                                    <p className="text-text-muted text-sm mb-1.5" dangerouslySetInnerHTML={{ __html: playlist.description }} />
                                )}
                                <p className="text-text-muted text-sm">
                                    <span className="font-medium text-white">
                                        {activeArtistId 
                                            ? (artist?.followers?.total ? artist.followers.total.toLocaleString() + ' followers' : 'Artist') 
                                            : allTracks.length + ' songs'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-3 flex items-center gap-5 bg-white/5 backdrop-blur-xl border-b border-white/10">
                        <button
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-[1.05] 
                                ${isPlaying && currentTrack && allTracks.some(t => t.id === currentTrack.id)
                                    ? 'bg-primary hover:bg-primary-hover' 
                                    : 'bg-white hover:bg-gray-200'
                                }`}
                            onClick={() => {
                                // Logic: If playing any track from this playlist, toggle play/pause.
                                // If not playing or playing something else, start playlist.
                                
                                // We need a more robust check for "is playing from this playlist"
                                // Checking if currentTrack ID exists in allTracks is a decent proxy.
                                const isTrackInPlaylist = currentTrack && allTracks.some(t => t.id === currentTrack.id);
                                
                                if (isTrackInPlaylist) {
                                    if (setIsPlaying) setIsPlaying(!isPlaying);
                                } else {
                                    if (allTracks.length > 0) {
                                        playTrackFromSection(allTracks[0], allTracks);
                                    }
                                }
                            }}
                        >
                            {isPlaying && currentTrack && allTracks.some(t => t.id === currentTrack.id) ? (
                                <Pause size={28} fill="black" className="text-black" />
                            ) : (
                                <Play size={28} fill="black" className="text-black ml-1" />
                            )}
                        </button>
                        <button className="text-text-secondary hover:text-white transition-colors">
                            <Shuffle size={24} />
                        </button>

                        <div className="ml-auto flex items-center gap-4">
                            <div
                                className={`flex items-center rounded-md overflow-hidden transition-all duration-200 ${isSearchExpanded
                                    ? 'w-56 bg-white/10 backdrop-blur-md border border-white/20'
                                    : 'w-8 h-8 hover:text-white cursor-pointer'
                                    }`}
                                onClick={() => {
                                    if (!isSearchExpanded) {
                                        setIsSearchExpanded(true);
                                        setTimeout(() => searchInputRef.current?.focus(), 100);
                                    }
                                }}
                            >
                                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8">
                                    <SearchIcon size={16} className={isSearchExpanded ? 'text-white' : 'text-text-secondary'} />
                                </div>
                                <div className={`flex-1 overflow-hidden transition-all duration-200 ${isSearchExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={playlistSearchQuery}
                                        onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                                        onBlur={() => { if (!playlistSearchQuery) setIsSearchExpanded(false); }}
                                        placeholder="Search in playlist"
                                        className="w-full bg-transparent text-sm text-white placeholder:text-text-muted outline-none py-2 pr-2"
                                    />
                                </div>
                                {isSearchExpanded && playlistSearchQuery && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPlaylistSearchQuery('');
                                            searchInputRef.current?.focus();
                                        }}
                                        className="mr-2 text-text-secondary hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {playlistSearchQuery && (
                                <span className="text-xs text-text-muted">{filteredTracks.length} results</span>
                            )}
                        </div>
                    </div>

                    <div className="px-6 pb-6">
                        {filteredTracks.length > 0 ? (
                            <>
                                <div className="grid grid-cols-[16px_1fr_auto] md:grid-cols-[16px_4fr_3fr_minmax(80px,1fr)] gap-3 px-3 py-2 text-xs font-bold text-white uppercase tracking-wider border-b border-white/20 sticky top-0 bg-transparent z-10 rounded-t-lg drop-shadow-md">
                                    <div className="text-center">#</div>
                                    <div>Title</div>
                                    <div className="hidden md:block">Album</div>
                                    <div className="flex justify-end">
                                        <Clock size={14} />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 mt-1">
                                    {displayedTracks.map((track, index) => (
                                        <div
                                            key={`${track.id}-${index}`}
                                            className={`grid grid-cols-[16px_1fr_auto] md:grid-cols-[16px_4fr_3fr_minmax(80px,1fr)] gap-3 px-3 py-2 group bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-md cursor-pointer transition-all border border-white/10 hover:border-white/20 ${currentTrack?.id === track.id ? 'bg-white/10 border-white/30' : ''
                                                }`}
                                            onClick={() => handleTrackClick(track)}
                                            onMouseEnter={() => setHoveredTrack(track.id)}
                                            onMouseLeave={() => setHoveredTrack(null)}
                                        >
                                            <div className="flex items-center justify-center text-text-muted w-4">
                                                {hoveredTrack === track.id || currentTrack?.id === track.id ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handlePlayPauseClick(track); }}
                                                        className={currentTrack?.id === track.id ? 'text-primary' : 'text-white'}
                                                    >
                                                        {currentTrack?.id === track.id && isPlaying ? (
                                                            <Pause size={14} fill="currentColor" />
                                                        ) : (
                                                            <Play size={14} fill="currentColor" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className={`text-sm ${currentTrack?.id === track.id ? 'text-primary' : ''}`}>
                                                        {index + 1}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={track.image || 'https://via.placeholder.com/40'}
                                                    className="w-9 h-9 object-cover flex-shrink-0 rounded shadow-card"
                                                    alt=""
                                                    loading="lazy"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-sm font-medium truncate ${currentTrack?.id === track.id ? 'text-primary' : 'text-white'
                                                        }`}>
                                                        {track.name}
                                                    </span>
                                                    <span className="text-xs text-text-muted truncate hover:text-white cursor-pointer">
                                                        {track.artist}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={`hidden md:flex items-center text-sm truncate hover:text-white cursor-pointer ${currentTrack?.id === track.id ? 'text-white/90' : 'text-text-muted'}`}>
                                                {track.album}
                                            </div>

                                            <div className={`flex items-center justify-end text-sm tabular-nums ${currentTrack?.id === track.id ? 'text-white/90' : 'text-text-muted'}`}>
                                                {formatDuration(track.duration_ms)}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {displayCount < filteredTracks.length && (
                                    <div ref={observerTarget} className="flex justify-center py-6">
                                        <div className="flex items-center gap-2 text-text-muted text-xs">
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            Loading more...
                                        </div>
                                    </div>
                                )}

                                {displayCount >= filteredTracks.length && filteredTracks.length > 20 && (
                                    <div className="text-center py-6 text-text-muted text-xs">
                                        {filteredTracks.length} songs
                                    </div>
                                )}

                                {activeArtistId && artistAlbums.length > 0 && (
                                    <div className="mt-8">
                                        <SectionHeader title="Discography" />
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                                            {artistAlbums.map(album => (
                                                <MediaCard
                                                    key={album.id}
                                                    image={album.images?.[0]?.url}
                                                    title={album.name}
                                                    subtitle={`${album.release_date.split('-')[0]} • ${album.album_type}`}
                                                    onClick={() => navigate(`/album/${album.id}`)}
                                                    onPlay={() => playPlaylist(album.id, 'album')}
                                                    isActive={playingContextId === album.id}
                                                    isPlaying={isPlaying}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : playlistSearchQuery ? (
                            <div className="text-center py-12">
                                <p className="text-text-muted text-base">No songs match "{playlistSearchQuery}"</p>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
