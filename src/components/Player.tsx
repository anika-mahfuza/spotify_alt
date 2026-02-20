import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, VolumeX, Music } from 'lucide-react';
import { Track } from '../types';

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface PlayerProps {
    currentTrack: Track | null;
    nextTrack: Track | null;
    onNext: (isShuffle?: boolean, repeatMode?: number) => void;
    onPrev: (isShuffle?: boolean, repeatMode?: number) => void;
    backendUrl: string;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    onToggleNowPlaying?: () => void;
    isSidebarOpen?: boolean;
    sidebarWidth?: number;
}

export function Player({ currentTrack, onNext, onPrev, backendUrl, isPlaying, setIsPlaying, onToggleNowPlaying, isSidebarOpen, sidebarWidth = 320 }: PlayerProps) {
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

    const stateRefs = useRef({ isShuffle, repeatMode, onNext });
    useEffect(() => {
        stateRefs.current = { isShuffle, repeatMode, onNext };
    }, [isShuffle, repeatMode, onNext]);

    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

    const ytPlayerRef = useRef<any>(null);
    const ytReadyRef = useRef<boolean>(false);
    const currentTrackIdRef = useRef<string | null>(null);
    const currentYoutubeIdRef = useRef<string | null>(null);
    const isInitialLoadRef = useRef(true);
    const progressTimerRef = useRef<number | null>(null);

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Save preferences to localStorage
    useEffect(() => localStorage.setItem('player_volume', volume.toString()), [volume]);
    useEffect(() => localStorage.setItem('player_shuffle', isShuffle.toString()), [isShuffle]);
    useEffect(() => localStorage.setItem('player_repeat', repeatMode.toString()), [repeatMode]);

    // Initialize YouTube IFrame API
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                ytReadyRef.current = true;
                initPlayer();
            };
        } else if (window.YT && window.YT.Player) {
            ytReadyRef.current = true;
            initPlayer();
        }

        return () => stopProgressTimer();
    }, []);

    const initPlayer = () => {
        if (ytPlayerRef.current) return;
        ytPlayerRef.current = new window.YT.Player('yt-player-container', {
            height: '1', width: '1',
            playerVars: { autoplay: 1, controls: 0, origin: window.location.origin },
            events: {
                onReady: (e: any) => {
                    e.target.setVolume(volume * 100);
                    if (currentYoutubeIdRef.current) {
                        playYoutubeId(currentYoutubeIdRef.current);
                    }
                },
                onStateChange: (e: any) => {
                    if (e.data === window.YT.PlayerState.PLAYING) {
                        setIsPlaying(true);
                        setIsLoading(false);
                        startProgressTimer();
                    }
                    if (e.data === window.YT.PlayerState.PAUSED) {
                        setIsPlaying(false);
                        stopProgressTimer();
                    }
                    if (e.data === window.YT.PlayerState.ENDED) {
                        setIsPlaying(false);
                        stopProgressTimer();
                        handleEnded();
                    }
                    if (e.data === window.YT.PlayerState.BUFFERING) {
                        setIsLoading(true);
                    }
                },
                onError: () => {
                    console.error("YT Player Error");
                    setError('Playback error');
                    setIsLoading(false);
                    stateRefs.current.onNext(stateRefs.current.isShuffle, stateRefs.current.repeatMode); // Auto skip on error like test.html
                }
            }
        });
    };

    const startProgressTimer = () => {
        stopProgressTimer();
        progressTimerRef.current = window.setInterval(() => {
            if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
                const cur = ytPlayerRef.current.getCurrentTime() || 0;
                const dur = ytPlayerRef.current.getDuration() || 0;
                if (dur > 0) {
                    setCurrentTime(cur);
                    setDuration(dur);
                    setProgress((cur / dur) * 100);

                    if (currentTrackIdRef.current) {
                        localStorage.setItem('player_last_position', JSON.stringify({
                            trackId: currentTrackIdRef.current,
                            position: cur,
                            timestamp: Date.now()
                        }));
                    }
                }
            }
        }, 500);
    };

    const stopProgressTimer = () => {
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
    };

    const playYoutubeId = (ytId: string) => {
        if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
            const lastPos = localStorage.getItem('player_last_position');
            let startSeconds = 0;
            // ONLY restore position if this is the first load
            if (isInitialLoadRef.current && lastPos && currentTrackIdRef.current) {
                const { trackId, position } = JSON.parse(lastPos);
                if (trackId === currentTrackIdRef.current) {
                    startSeconds = position;
                }
            }

            if (!isInitialLoadRef.current) {
                // Ensure in-session clicks always play from 0
                ytPlayerRef.current.loadVideoById({ videoId: ytId, startSeconds: 0 });
            } else {
                ytPlayerRef.current.cueVideoById({ videoId: ytId, startSeconds });
                setIsPlaying(false);
            }
            isInitialLoadRef.current = false;
        }
    };

    // Sync isPlaying state with YT player
    useEffect(() => {
        if (!ytPlayerRef.current || !ytPlayerRef.current.getPlayerState || isLoading) return;
        const state = ytPlayerRef.current.getPlayerState();

        if (isPlaying && state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
            ytPlayerRef.current.playVideo();
        } else if (!isPlaying && state === window.YT.PlayerState.PLAYING) {
            ytPlayerRef.current.pauseVideo();
        }
    }, [isPlaying, isLoading]);

    // Handle Track Change
    useEffect(() => {
        if (!currentTrack) return;

        const trackId = currentTrack.id || currentTrack.name;
        if (trackId === currentTrackIdRef.current) return;

        stopProgressTimer(); // Prevent old track's progress from saving under new trackId
        currentTrackIdRef.current = trackId;
        setIsLoading(true);
        setError(null);
        setProgress(0);
        setCurrentTime(0);

        const fetchAndPlay = async () => {
            try {
                let ytId: string;
                if (currentTrack.isYoutube) {
                    ytId = currentTrack.id;
                } else {
                    const query = `${currentTrack.name} ${currentTrack.artist} audio`;
                    // Use smart best-match endpoint that scores results for accuracy
                    let matched = false;
                    try {
                        const res = await fetch(`${backendUrl}/api/best-match?q=${encodeURIComponent(query)}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.id) {
                                ytId = data.id;
                                matched = true;
                            }
                        }
                    } catch {
                        // best-match failed, fall through to regular search
                    }

                    // Fallback: use regular search if best-match failed
                    if (!matched!) {
                        const res = await fetch(`${backendUrl}/api/search?q=${encodeURIComponent(query)}`);
                        if (!res.ok) throw new Error('Failed to search');
                        const data = await res.json();
                        if (data && data.length > 0) {
                            ytId = data[0].id;
                        } else {
                            throw new Error('No results found');
                        }
                    }
                }

                currentYoutubeIdRef.current = ytId!;

                if (ytReadyRef.current && ytPlayerRef.current) {
                    playYoutubeId(ytId!);
                }
            } catch (e: any) {
                console.error("Failed to load track:", e);
                setError("Failed to load track");
                setIsLoading(false);
                setIsPlaying(false);
            }
        };

        fetchAndPlay();
    }, [currentTrack, backendUrl]);

    const togglePlay = () => {
        if (isLoading) return;
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
            const targetTime = (val / 100) * duration;
            ytPlayerRef.current.seekTo(targetTime, true);
            setProgress(val);
            setCurrentTime(targetTime);
        }
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setVolume(val);
        if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
            ytPlayerRef.current.setVolume(val * 100);
        }
    };

    const toggleMute = () => {
        const newVol = volume > 0 ? 0 : 0.7;
        setVolume(newVol);
        if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
            ytPlayerRef.current.setVolume(newVol * 100);
        }
    };

    const handleEnded = () => {
        const { isShuffle, repeatMode, onNext } = stateRefs.current;
        if (repeatMode === 2) {
            if (ytPlayerRef.current) {
                if (currentYoutubeIdRef.current) {
                    ytPlayerRef.current.loadVideoById({ videoId: currentYoutubeIdRef.current, startSeconds: 0 });
                } else {
                    ytPlayerRef.current.seekTo(0, true);
                    ytPlayerRef.current.playVideo();
                }
                setIsPlaying(true);
            }
        } else {
            onNext(isShuffle, repeatMode);
        }
    };

    const toggleShuffle = () => setIsShuffle(!isShuffle);
    const toggleRepeat = () => setRepeatMode((repeatMode + 1) % 3);

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!currentTrack) return null;

    return (
        <>
            <div id="yt-player-container" style={{ position: 'absolute', width: 1, height: 1, top: -9999, left: -9999 }} />

            <div
                className="
                    fixed bottom-0 left-0 right-0 
                    h-auto min-h-[140px] md:h-24 md:min-h-0
                    border-t border-white/10
                    z-[100]
                    flex flex-col justify-end pb-0
                    bg-black/30 backdrop-blur-3xl
                "
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ background: `linear-gradient(to top, rgba(0,0,0,0.3), transparent)` }}
                />

                <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 md:hidden block z-20">
                    <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div
                    className={`relative z-10 flex flex-col md:flex-row items-center justify-between h-full px-4 md:px-6 py-3 md:py-0 transition-all duration-300 gap-3 md:gap-0`}
                    style={{ paddingRight: isSidebarOpen && isLargeScreen ? `${sidebarWidth + 24}px` : undefined }}
                >
                    <div className="flex items-center gap-3 w-full md:w-[30%] md:flex-none justify-start border-b border-white/5 md:border-none pb-2 md:pb-0">
                        {currentTrack && (
                            <>
                                <div className="relative group/img flex-shrink-0">
                                    <img
                                        src={currentTrack.image || currentTrack.thumbnail || 'https://via.placeholder.com/56'}
                                        className="h-12 w-12 md:h-14 md:w-14 object-cover rounded shadow-card"
                                        alt="Cover"
                                    />
                                </div>
                                <div className="flex flex-col justify-center overflow-hidden min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate hover:underline cursor-pointer text-white leading-tight">
                                        {currentTrack.name || "No Title"}
                                    </span>
                                    <span className="text-xs truncate opacity-70 text-[#E0E0E0] leading-tight mt-0.5">
                                        {isLoading ? (
                                            <span className="opacity-70">Loading...</span>
                                        ) : error ? (
                                            <span className="text-accent-pink">{error}</span>
                                        ) : (
                                            currentTrack.artist || "Unknown Artist"
                                        )}
                                    </span>
                                </div>
                                {onToggleNowPlaying && (
                                    <button onClick={onToggleNowPlaying} className="md:hidden transition-all text-white/60 hover:text-white p-2" title="Now Playing" disabled={isLoading}>
                                        <Music size={20} strokeWidth={2} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex flex-col items-center justify-center w-full md:flex-1 md:w-[40%] md:max-w-[600px] gap-2">
                        <div className="flex items-center justify-between w-full md:justify-center md:gap-6 px-4 md:px-0">
                            <button onClick={toggleShuffle} className={`transition-all duration-150 ${isShuffle ? 'text-[#1DB954]' : 'text-white/70 hover:text-white'}`} disabled={isLoading} title="Shuffle">
                                <Shuffle size={18} strokeWidth={2} />
                            </button>
                            <button onClick={() => onPrev(isShuffle, repeatMode)} className="transition-all hover:scale-105 text-white/70 hover:text-white" disabled={isLoading} title="Previous">
                                <SkipBack size={22} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-10 h-10 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-black shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading || !currentTrack}
                                title={isPlaying ? "Pause" : "Play"}
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 md:w-4 md:h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : isPlaying ? (
                                    <Pause size={20} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                                ) : (
                                    <Play size={20} className="md:w-5 md:h-5 ml-0.5" fill="currentColor" strokeWidth={0} />
                                )}
                            </button>
                            <button onClick={() => onNext(isShuffle, repeatMode)} className="transition-all hover:scale-105 text-white/70 hover:text-white" disabled={isLoading} title="Next">
                                <SkipForward size={22} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                            </button>
                            <button onClick={toggleRepeat} className={`transition-all duration-150 relative hover:scale-105 ${repeatMode > 0 ? 'text-[#1DB954]' : 'text-white/70 hover:text-white'}`} disabled={isLoading} title={repeatMode === 0 ? "Repeat" : repeatMode === 1 ? "Repeat All" : "Repeat One"}>
                                <Repeat size={18} strokeWidth={2} />
                                {repeatMode === 2 && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold">1</span>}
                            </button>
                            {onToggleNowPlaying && (
                                <button onClick={onToggleNowPlaying} className="hidden md:block transition-all text-white/60 hover:text-white" title="Now Playing" disabled={isLoading}>
                                    <Music size={18} strokeWidth={2} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 w-full text-xs text-white/70">
                            <span className="min-w-[35px] text-right tabular-nums text-[10px] md:text-xs">{formatTime(currentTime)}</span>
                            <div className="flex-1 h-1 rounded-full relative group cursor-pointer bg-white/20">
                                <div className="absolute top-0 left-0 h-full rounded-full transition-all bg-white group-hover:bg-primary" style={{ width: `${progress}%` }} />
                                <input type="range" min="0" max="100" value={progress || 0} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLoading} />
                            </div>
                            <span className="min-w-[35px] tabular-nums text-[10px] md:text-xs">{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center justify-end w-full md:w-[30%] min-w-[140px] gap-2 px-4 md:px-0 pb-2 md:pb-0">
                        <button onClick={toggleMute} className="transition-all text-white/70 hover:text-white" title={volume === 0 ? "Unmute" : "Mute"}>
                            {volume === 0 ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
                        </button>
                        <div className="group relative w-16 md:w-20 h-1 rounded-full cursor-pointer bg-white/20">
                            <div className="absolute top-0 left-0 h-full rounded-full transition-all bg-white" style={{ width: `${volume * 100}%` }} />
                            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolume} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
