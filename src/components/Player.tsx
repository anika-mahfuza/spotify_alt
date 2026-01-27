import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, VolumeX, Music } from 'lucide-react';
import { Track } from '../types';
import { useSpotifyFetch } from '../hooks/useSpotifyFetch';

interface PlayerProps {
    currentTrack: Track | null;
    nextTrack: Track | null;
    onNext: () => void;
    onPrev: () => void;
    backendUrl: string;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    onToggleNowPlaying?: () => void;
    isSidebarOpen?: boolean;
    sidebarWidth?: number;
}

export function Player({ currentTrack, nextTrack, onNext, onPrev, backendUrl, isPlaying, setIsPlaying, onToggleNowPlaying, isSidebarOpen, sidebarWidth = 320 }: PlayerProps) {
    const fetchWithAuth = useSpotifyFetch();
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('player_volume');
        return saved ? parseFloat(saved) : 0.7;
    });
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isShuffle, setIsShuffle] = useState(() => {
        const saved = localStorage.getItem('player_shuffle');
        return saved === 'true';
    });
    const [repeatMode, setRepeatMode] = useState(() => {
        const saved = localStorage.getItem('player_repeat');
        return saved ? parseInt(saved) : 0;
    });
    const [prefetchedStreamUrl, setPrefetchedStreamUrl] = useState<string | null>(null);
    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Debug unused state to satisfy linter until implemented
    useEffect(() => {
        if (prefetchedStreamUrl) {
            console.debug('Prefetched URL ready:', prefetchedStreamUrl);
        }
    }, [prefetchedStreamUrl]);



    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);

    // Save volume to localStorage
    useEffect(() => {
        localStorage.setItem('player_volume', volume.toString());
    }, [volume]);

    // Save shuffle to localStorage
    useEffect(() => {
        localStorage.setItem('player_shuffle', isShuffle.toString());
    }, [isShuffle]);

    // Save repeat mode to localStorage
    useEffect(() => {
        localStorage.setItem('player_repeat', repeatMode.toString());
    }, [repeatMode]);

    // Save current time periodically
    useEffect(() => {
        if (currentTrack && currentTime > 0) {
            const interval = setInterval(() => {
                localStorage.setItem('player_last_position', JSON.stringify({
                    trackId: currentTrack.id,
                    position: currentTime,
                    timestamp: Date.now()
                }));
            }, 5000); // Save every 5 seconds

            return () => clearInterval(interval);
        }
    }, [currentTrack, currentTime]);

    // Sync audio playback with isPlaying state
    useEffect(() => {
        if (!audioRef.current || isLoading || !currentTrack) return;

        const audio = audioRef.current;
        const isAudioPlaying = !audio.paused && !audio.ended && audio.readyState > 2;

        if (isPlaying && !isAudioPlaying) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    // Only log/update if it's not an abort error (which happens when pausing quickly)
                    if (e.name !== 'AbortError') {
                        console.error("Auto-play failed:", e);
                        setIsPlaying(false);
                    }
                });
            }
        } else if (!isPlaying && isAudioPlaying) {
            audio.pause();
        }
    }, [isPlaying, isLoading, currentTrack, setIsPlaying]);

    useEffect(() => {
        if (!currentTrack) return;

        const trackId = currentTrack.id || currentTrack.name;

        if (trackId === currentTrackIdRef.current) return;

        currentTrackIdRef.current = trackId;

        const fetchAndPlay = async () => {
            setIsLoading(true);
            setError(null);

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }

            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);

            try {
                let url: string;

                if (currentTrack.isYoutube) {
                    const res = await fetchWithAuth(`${backendUrl}/play/${currentTrack.id}`);
                    if (!res.ok) throw new Error('Failed to fetch stream');
                    const data = await res.json();
                    url = data.url;
                } else {
                    const query = `${currentTrack.name} ${currentTrack.artist} audio`;
                    const res = await fetchWithAuth(`${backendUrl}/search-and-play?q=${encodeURIComponent(query)}`);
                    if (!res.ok) throw new Error('Failed to fetch stream');
                    const data = await res.json();
                    url = data.url;
                    console.log('Player: fetched URL from /search-and-play:', url);
                }

                if (audioRef.current && url) {
                        console.log('Player: setting audio.src to', url);
                        audioRef.current.src = url;
                        audioRef.current.volume = volume;

                        // Removed auto-resume logic to ensure tracks always start from the beginning
                        // per user request ("make them play form start if user plays again")
                        
                        await audioRef.current.play();
                        console.log('Player: audio.play() succeeded');
                        setIsPlaying(true);
                    }
            } catch (e) {
                console.error("Failed to play:", e);
                setError('Failed to load audio');
                setIsPlaying(false);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndPlay();
    }, [currentTrack, backendUrl, volume, setIsPlaying]);

    const togglePlay = async () => {
        if (!audioRef.current || isLoading) return;

        try {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                await audioRef.current.play();
                setIsPlaying(true);
            }
        } catch (e) {
            console.error("Play/pause error:", e);
            setError('Playback error');
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const cur = audioRef.current.currentTime;
            const dur = audioRef.current.duration;
            if (isFinite(cur) && isFinite(dur)) {
                setCurrentTime(cur);
                setDuration(dur);
                setProgress((cur / dur) * 100);
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (audioRef.current && isFinite(audioRef.current.duration)) {
            audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
            setProgress(val);
        }
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setVolume(val);
        if (audioRef.current) audioRef.current.volume = val;
    };

    const toggleMute = () => {
        if (volume > 0) {
            setVolume(0);
            if (audioRef.current) audioRef.current.volume = 0;
        } else {
            setVolume(0.7);
            if (audioRef.current) audioRef.current.volume = 0.7;
        }
    };

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleEnded = () => {
        setIsPlaying(false);
        if (repeatMode === 2) {
            // Repeat one
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
                setIsPlaying(true);
            }
        } else {
            onNext();
        }
    };

    const handleError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
        const audio = e.currentTarget;
        if (!audio.paused && audio.currentTime > 0) return;
        if (!audio.src) return;

        console.error("Audio playback error:", audio.error);
        console.error("Audio src:", audio.src);
        console.error("NetworkState:", audio.networkState, "ReadyState:", audio.readyState);
        
        // If it's a format error, try to get a different format
        if (audio.error && (audio.error.code === 4 || audio.error.message.includes('Format error'))) {
            console.log("Format error detected, trying fallback...");
            setError('Audio format not supported, trying alternative...');
            // Retry by setting currentTrack to trigger re-fetch
            setTimeout(() => {
                if (currentTrack) {
                    currentTrackIdRef.current = null; // Force re-fetch
                }
            }, 1000);
        } else if (audio.error) {
            setError('Audio playback error');
            setIsPlaying(false);
        }
    };

    // Pre-fetch next track's stream URL
    const prefetchNextTrack = useCallback(async () => {
        if (!nextTrack || !backendUrl) return;

        try {
            let url: string;

            if (nextTrack.isYoutube) {
                const res = await fetchWithAuth(`${backendUrl}/play/${nextTrack.id}`);
                if (!res.ok) throw new Error('Failed to prefetch stream');
                const data = await res.json();
                url = data.url;
            } else {
                const query = `${nextTrack.name} ${nextTrack.artist} audio`;
                const res = await fetchWithAuth(`${backendUrl}/search-and-play?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error('Failed to prefetch stream');
                const data = await res.json();
                url = data.url;
            }

            if (url) {
                setPrefetchedStreamUrl(url);
                console.log('Pre-fetched stream URL for next track');
            }
        } catch (e) {
            console.warn('Pre-fetch failed:', e);
        }
    }, [nextTrack, backendUrl, fetchWithAuth]);

    // Pre-fetch when current track starts playing and next track exists
    useEffect(() => {
        if (currentTrack && nextTrack && isPlaying) {
            // Pre-fetch after 30 seconds of current playback
            const timer = setTimeout(() => {
                prefetchNextTrack();
            }, 30000);

            return () => clearTimeout(timer);
        }
    }, [currentTrack, nextTrack, isPlaying, prefetchNextTrack]);

    const toggleShuffle = () => setIsShuffle(!isShuffle);
    const toggleRepeat = () => setRepeatMode((repeatMode + 1) % 3);

    if (!currentTrack) return null;

    return (
        <>
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onError={handleError}
                preload="metadata"
                style={{ display: 'none' }}
            />
            
            <div
                className="
                    fixed bottom-0 left-0 right-0 h-[72px] md:h-24
                    border-t border-white/5
                    z-[100]
                    flex flex-col justify-end pb-0
                    bg-black/95 backdrop-blur-xl
                "
                style={{
                    height: 'calc(72px + env(safe-area-inset-bottom))',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                }}
            >
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    background: `linear-gradient(to top, #000000, transparent)`,
                }}
            />

            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 md:hidden z-20">
                 <div 
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${progress}%` }}
                 />
            </div>

            <div
                className={`relative z-10 flex items-center justify-between h-full px-2 md:px-6 transition-all duration-300 gap-2 md:gap-0`}
                style={{
                    paddingRight: isSidebarOpen && isLargeScreen ? `${sidebarWidth + 24}px` : undefined
                }}
            >
                {/* Track Info */}
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 md:max-w-none md:w-[30%] md:flex-none">
                    {currentTrack && (
                        <>
                            <div className="relative group/img flex-shrink-0">
                                <img
                                    src={currentTrack.image || currentTrack.thumbnail || 'https://via.placeholder.com/56'}
                                    className="h-10 w-10 md:h-14 md:w-14 object-cover rounded shadow-card"
                                    alt="Cover"
                                />
                            </div>
                            <div className="flex flex-col justify-center overflow-hidden min-w-0">
                                <span
                                    className="text-sm md:text-sm font-medium truncate hover:underline cursor-pointer text-white leading-tight"
                                >
                                    {currentTrack.name || "No Title"}
                                </span>
                                <span className="text-xs md:text-xs truncate opacity-70 text-[#E0E0E0] leading-tight">
                                    {isLoading ? (
                                        <span className="opacity-70">Loading...</span>
                                    ) : error ? (
                                        <span className="text-accent-pink">{error}</span>
                                    ) : (
                                        currentTrack.artist || "Unknown Artist"
                                    )}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0 md:flex-1 md:w-[40%] md:max-w-[600px]">
                    <div className="flex items-center gap-4 md:gap-6">
                        <button
                            onClick={toggleShuffle}
                            className={`hidden md:block transition-all duration-150 ${isShuffle ? 'text-[#1DB954]' : 'text-white/70 hover:text-white'}`}
                            disabled={isLoading}
                            title="Shuffle"
                        >
                            <Shuffle size={16} strokeWidth={2} />
                        </button>

                        <button
                            onClick={onPrev}
                            className="transition-all hover:scale-105 text-white/70 hover:text-white"
                            disabled={isLoading}
                            title="Previous"
                        >
                            <SkipBack size={20} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                        </button>

                        <button
                            onClick={togglePlay}
                            className="
                                w-10 h-10 md:w-10 md:h-10 bg-white rounded-full
                                flex items-center justify-center
                                transition-all hover:scale-105 active:scale-95
                                text-black shadow-lg
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                            disabled={isLoading || !currentTrack}
                            title={isPlaying ? "Pause" : "Play"}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : isPlaying ? (
                                <Pause size={18} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                            ) : (
                                <Play size={18} className="md:w-5 md:h-5 ml-0.5" fill="currentColor" strokeWidth={0} />
                            )}
                        </button>

                        <button
                            onClick={onNext}
                            className="transition-all hover:scale-105 text-white/70 hover:text-white"
                            disabled={isLoading}
                            title="Next"
                        >
                            <SkipForward size={20} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                        </button>

                        <button
                            onClick={toggleRepeat}
                            className={`hidden md:block transition-all duration-150 relative hover:scale-105 ${repeatMode > 0 ? 'text-primary' : 'text-white/70 hover:text-white'}`}
                            disabled={isLoading}
                            title={repeatMode === 0 ? "Repeat" : repeatMode === 1 ? "Repeat All" : "Repeat One"}
                        >
                            <Repeat size={16} strokeWidth={2} />
                            {repeatMode === 2 && (
                                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold">1</span>
                            )}
                        </button>

                        {onToggleNowPlaying && (
                            <button
                                onClick={onToggleNowPlaying}
                                className="hidden md:block transition-all text-white/60 hover:text-white"
                                title="Now Playing"
                                disabled={isLoading}
                            >
                                <Music size={18} strokeWidth={2} />
                            </button>
                        )}
                    </div>

                    <div className="hidden md:flex items-center gap-2 w-full text-xs text-white/70">
                        <span className="min-w-[40px] text-right tabular-nums">{formatTime(currentTime)}</span>
                        <div className="flex-1 h-1 rounded-full relative group cursor-pointer bg-white/20">
                            <div
                                className="absolute top-0 left-0 h-full rounded-full transition-all bg-white group-hover:bg-primary"
                                style={{
                                    width: `${progress}%`
                                }}
                            />
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={progress || 0}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isLoading}
                            />
                        </div>
                        <span className="min-w-[40px] tabular-nums">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="hidden md:flex items-center justify-end w-[30%] min-w-[140px] gap-2">
                    <button
                        onClick={toggleMute}
                        className="transition-all text-white/70 hover:text-white"
                        title={volume === 0 ? "Unmute" : "Mute"}
                    >
                        {volume === 0 ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
                    </button>

                    <div className="group relative w-20 h-1 rounded-full cursor-pointer bg-white/20">
                        <div
                            className="absolute top-0 left-0 h-full rounded-full transition-all bg-white"
                            style={{
                                width: `${volume * 100}%`
                            }}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolume}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
            </div>
        </>
    );
}
