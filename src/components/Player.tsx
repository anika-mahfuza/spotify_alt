import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, VolumeX, Music } from 'lucide-react';
import { Track } from '../types';

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

interface BestMatchResponse {
    id?: string;
    candidates?: string[];
}

interface SearchResponseItem {
    id: string;
}

interface PlayerProps {
    currentTrack: Track | null;
    nextTrack: Track | null;
    onNext: (isShuffle?: boolean, repeatMode?: number) => void;
    onPrev: (isShuffle?: boolean, repeatMode?: number) => void;
    backendUrl: string;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    onResolveTrackPlayback?: (trackId: string, updates: Pick<Track, 'youtubeId' | 'youtubeCandidates'>) => void;
    onToggleNowPlaying?: () => void;
    isSidebarOpen?: boolean;
    sidebarWidth?: number;
}

function normalizeCandidateIds(ids: Array<string | undefined> = [], preferredId?: string | null): string[] {
    const unique = new Set<string>();
    const normalized: string[] = [];

    const addId = (id?: string | null) => {
        if (!id || unique.has(id)) return;
        unique.add(id);
        normalized.push(id);
    };

    addId(preferredId);
    ids.forEach(addId);
    return normalized;
}

function cleanSearchTerm(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
        .replace(/\b(?:feat\.?|ft\.?|featuring)\b[^,|/&-]*/gi, ' ')
        .replace(/\b(?:official|lyrics?|audio|video|visualizer|remaster(?:ed)?|explicit|clean)\b/gi, ' ')
        .replace(/[^\w\s&'/-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getPrimaryArtistName(value: string): string {
    const cleaned = cleanSearchTerm(value);
    const parts = cleaned
        .split(/\s*(?:,|&|\/|\||;|\bx\b|\band\b)\s*/i)
        .map(part => part.trim())
        .filter(Boolean);

    return parts[0] || cleaned;
}

function buildTrackQueries(track: Track): string[] {
    const rawName = track.name.trim();
    const rawArtist = track.artist.trim();
    const cleanName = cleanSearchTerm(rawName);
    const cleanArtist = cleanSearchTerm(rawArtist);
    const primaryArtist = getPrimaryArtistName(rawArtist);

    return normalizeCandidateIds([
        `${rawName} ${rawArtist}`.trim(),
        `${cleanName} ${cleanArtist}`.trim(),
        `${cleanName} ${primaryArtist}`.trim(),
        `${primaryArtist} ${cleanName}`.trim(),
        rawName,
        cleanName,
    ]).filter(query => query.length > 1);
}

export function Player({
    currentTrack,
    onNext,
    onPrev,
    backendUrl,
    isPlaying,
    setIsPlaying,
    onResolveTrackPlayback,
    onToggleNowPlaying,
    isSidebarOpen,
    sidebarWidth = 320
}: PlayerProps) {
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
    const ytReadyRef = useRef(false);
    const progressTimerRef = useRef<number | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);
    const currentYoutubeIdRef = useRef<string | null>(null);
    const currentCandidatesRef = useRef<string[]>([]);
    const currentCandidateIndexRef = useRef(0);
    const lastTrackObjRef = useRef<Track | null>(null);
    const lastPlaybackNonceRef = useRef(0);
    const isInitialMountRef = useRef(true);
    const loadGenRef = useRef(0);
    const pendingPlayerLoadRef = useRef<{ youtubeId: string; autoplay: boolean } | null>(null);
    const lastRequestedAutoplayRef = useRef(true);
    const isSeekingRef = useRef(false);
    const pendingSeekTimeRef = useRef<number | null>(null);
    const volumeRef = useRef(volume);

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => localStorage.setItem('player_volume', volume.toString()), [volume]);
    useEffect(() => localStorage.setItem('player_shuffle', isShuffle.toString()), [isShuffle]);
    useEffect(() => localStorage.setItem('player_repeat', repeatMode.toString()), [repeatMode]);

    const stopProgressTimer = useCallback(() => {
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
    }, []);

    const setPlayerVolume = useCallback((nextVolume: number) => {
        if (ytPlayerRef.current?.setVolume) {
            ytPlayerRef.current.setVolume(nextVolume * 100);
        }
    }, []);

    useEffect(() => {
        volumeRef.current = volume;
        setPlayerVolume(volume);
    }, [volume, setPlayerVolume]);

    const startProgressTimer = useCallback(() => {
        stopProgressTimer();
        progressTimerRef.current = window.setInterval(() => {
            if (isSeekingRef.current) return;
            if (!ytPlayerRef.current?.getCurrentTime || !ytPlayerRef.current?.getDuration) return;

            const nextCurrentTime = ytPlayerRef.current.getCurrentTime() || 0;
            const nextDuration = ytPlayerRef.current.getDuration() || 0;

            if (nextDuration > 0) {
                setCurrentTime(nextCurrentTime);
                setDuration(nextDuration);
                setProgress((nextCurrentTime / nextDuration) * 100);
            }
        }, 500);
    }, [stopProgressTimer]);

    const loadIntoPlayer = useCallback((youtubeId: string, autoplay: boolean) => {
        currentYoutubeIdRef.current = youtubeId;
        lastRequestedAutoplayRef.current = autoplay;

        if (!ytReadyRef.current || !ytPlayerRef.current) {
            pendingPlayerLoadRef.current = { youtubeId, autoplay };
            return;
        }

        pendingPlayerLoadRef.current = null;
        setError(null);

        if (autoplay) {
            ytPlayerRef.current.loadVideoById({ videoId: youtubeId, startSeconds: 0 });
        } else {
            ytPlayerRef.current.cueVideoById({ videoId: youtubeId, startSeconds: 0 });
            setIsPlaying(false);
        }
    }, [setIsPlaying]);

    const commitSeek = useCallback((targetTime?: number) => {
        const nextTargetTime = typeof targetTime === 'number' ? targetTime : pendingSeekTimeRef.current;
        pendingSeekTimeRef.current = null;

        if (nextTargetTime == null) {
            isSeekingRef.current = false;
            return;
        }

        isSeekingRef.current = false;
        if (!ytPlayerRef.current?.seekTo) return;

        ytPlayerRef.current.seekTo(nextTargetTime, true);
        setCurrentTime(nextTargetTime);
        if (duration > 0) {
            setProgress((nextTargetTime / duration) * 100);
        }
    }, [duration]);

    useEffect(() => {
        const handleSeekRelease = () => {
            if (!isSeekingRef.current) return;
            commitSeek();
        };

        window.addEventListener('pointerup', handleSeekRelease);
        window.addEventListener('pointercancel', handleSeekRelease);
        window.addEventListener('mouseup', handleSeekRelease);
        window.addEventListener('touchend', handleSeekRelease);
        window.addEventListener('touchcancel', handleSeekRelease);
        window.addEventListener('blur', handleSeekRelease);

        return () => {
            window.removeEventListener('pointerup', handleSeekRelease);
            window.removeEventListener('pointercancel', handleSeekRelease);
            window.removeEventListener('mouseup', handleSeekRelease);
            window.removeEventListener('touchend', handleSeekRelease);
            window.removeEventListener('touchcancel', handleSeekRelease);
            window.removeEventListener('blur', handleSeekRelease);
        };
    }, [commitSeek]);

    const persistResolvedTrack = useCallback((trackId: string, youtubeId: string, candidates: string[]) => {
        onResolveTrackPlayback?.(trackId, {
            youtubeId,
            youtubeCandidates: candidates,
        });
    }, [onResolveTrackPlayback]);

    const tryCandidateAtIndex = useCallback((trackId: string, index: number, autoplay: boolean) => {
        const youtubeId = currentCandidatesRef.current[index];
        if (!youtubeId) return false;

        currentCandidateIndexRef.current = index;
        persistResolvedTrack(trackId, youtubeId, currentCandidatesRef.current);
        setIsLoading(autoplay);
        loadIntoPlayer(youtubeId, autoplay);
        return true;
    }, [loadIntoPlayer, persistResolvedTrack]);

    const resolveTrackPlayback = useCallback(async (track: Track): Promise<{ youtubeId: string; candidates: string[] }> => {
        const directYoutubeId = track.youtubeId || (track.isYoutube ? track.id : undefined);
        if (directYoutubeId) {
            return {
                youtubeId: directYoutubeId,
                candidates: normalizeCandidateIds(track.youtubeCandidates, directYoutubeId),
            };
        }

        const queries = buildTrackQueries(track);
        const trackParams = new URLSearchParams({
            title: track.name,
            artist: track.artist,
        });

        for (const query of queries) {
            try {
                const params = new URLSearchParams(trackParams);
                params.set('q', query);
                const res = await fetch(`${backendUrl}/api/best-match?${params.toString()}`);
                if (!res.ok) continue;

                const data: BestMatchResponse = await res.json();
                const candidateIds = normalizeCandidateIds(data.candidates, data.id);
                if (candidateIds.length > 0) {
                    return {
                        youtubeId: candidateIds[0],
                        candidates: candidateIds,
                    };
                }
            } catch {
                // Fall through to broader search fallback below.
            }
        }

        for (const query of queries) {
            for (const endpoint of ['/api/search', '/search']) {
                try {
                    const params = new URLSearchParams(trackParams);
                    params.set('q', query);
                    const searchRes = await fetch(`${backendUrl}${endpoint}?${params.toString()}`);
                    if (!searchRes.ok) continue;

                    const searchResults: SearchResponseItem[] = await searchRes.json();
                    const fallbackCandidates = normalizeCandidateIds(searchResults.map(result => result.id));
                    if (fallbackCandidates.length > 0) {
                        return {
                            youtubeId: fallbackCandidates[0],
                            candidates: fallbackCandidates,
                        };
                    }
                } catch {
                    // Try the next endpoint/query variant.
                }
            }
        }

        throw new Error(`Failed to find match for "${track.name}"`);
    }, [backendUrl]);

    useEffect(() => {
        const initPlayer = () => {
            if (ytPlayerRef.current || !window.YT?.Player) return;

            ytPlayerRef.current = new window.YT.Player('yt-player-container', {
                height: '1',
                width: '1',
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    origin: window.location.origin,
                    playsinline: 1,
                },
                events: {
                    onReady: (event: any) => {
                        ytReadyRef.current = true;
                        event.target.setVolume(volumeRef.current * 100);

                        const pending = pendingPlayerLoadRef.current;
                        if (pending) {
                            loadIntoPlayer(pending.youtubeId, pending.autoplay);
                        }
                    },
                    onStateChange: (event: any) => {
                        switch (event.data) {
                            case window.YT.PlayerState.PLAYING:
                                setError(null);
                                setIsPlaying(true);
                                setIsLoading(false);
                                startProgressTimer();
                                break;
                            case window.YT.PlayerState.PAUSED:
                                setIsPlaying(false);
                                setIsLoading(false);
                                stopProgressTimer();
                                break;
                            case window.YT.PlayerState.BUFFERING:
                                setIsLoading(true);
                                break;
                            case window.YT.PlayerState.ENDED:
                                setIsPlaying(false);
                                setIsLoading(false);
                                stopProgressTimer();
                                const { isShuffle, repeatMode, onNext } = stateRefs.current;
                                if (repeatMode === 2) {
                                    if (currentYoutubeIdRef.current) {
                                        loadIntoPlayer(currentYoutubeIdRef.current, true);
                                    }
                                } else {
                                    onNext(isShuffle, repeatMode);
                                }
                                break;
                            case window.YT.PlayerState.CUED:
                                setIsLoading(false);
                                stopProgressTimer();
                                break;
                            default:
                                break;
                        }
                    },
                    onError: (event: any) => {
                        const activeTrackId = currentTrackIdRef.current;
                        if (!activeTrackId) return;

                        const loadedVideoId = event?.target?.getVideoData?.()?.video_id;
                        if (loadedVideoId && currentYoutubeIdRef.current && loadedVideoId !== currentYoutubeIdRef.current) {
                            return;
                        }

                        const nextCandidateIndex = currentCandidateIndexRef.current + 1;
                        if (nextCandidateIndex < currentCandidatesRef.current.length) {
                            setError(null);
                            tryCandidateAtIndex(activeTrackId, nextCandidateIndex, lastRequestedAutoplayRef.current);
                            return;
                        }

                        stopProgressTimer();
                        setError('Playback error');
                        setIsLoading(false);
                        setIsPlaying(false);
                    }
                }
            });
        };

        if (window.YT?.Player) {
            ytReadyRef.current = true;
            initPlayer();
        } else {
            const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
            if (!existingScript) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
            }

            window.onYouTubeIframeAPIReady = () => {
                ytReadyRef.current = true;
                initPlayer();
            };
        }

        return () => {
            stopProgressTimer();
            pendingPlayerLoadRef.current = null;
            if (ytPlayerRef.current?.destroy) {
                ytPlayerRef.current.destroy();
                ytPlayerRef.current = null;
            }
        };
    }, [loadIntoPlayer, setIsPlaying, startProgressTimer, stopProgressTimer, tryCandidateAtIndex]);

    useEffect(() => {
        if (!ytPlayerRef.current?.getPlayerState || isLoading) return;

        const playerState = ytPlayerRef.current.getPlayerState();
        if (isPlaying && playerState !== window.YT.PlayerState.PLAYING && playerState !== window.YT.PlayerState.BUFFERING) {
            ytPlayerRef.current.playVideo();
        } else if (!isPlaying && playerState === window.YT.PlayerState.PLAYING) {
            ytPlayerRef.current.pauseVideo();
        }
    }, [isPlaying, isLoading]);

    useEffect(() => {
        if (!currentTrack) return;

        const trackId = currentTrack.id || currentTrack.name;
        const playbackNonce = currentTrack.playbackNonce ?? 0;
        const isSameTrack = trackId === currentTrackIdRef.current;
        const isSameObject = currentTrack === lastTrackObjRef.current;
        const isReplayRequest = isSameTrack && playbackNonce !== lastPlaybackNonceRef.current;

        if (isSameTrack && isSameObject) return;
        lastTrackObjRef.current = currentTrack;

        if (isSameTrack && !isReplayRequest) {
            return;
        }

        if (isReplayRequest) {
            lastPlaybackNonceRef.current = playbackNonce;
            setError(null);
            setIsLoading(true);
            setProgress(0);
            setCurrentTime(0);
            pendingSeekTimeRef.current = null;
            isSeekingRef.current = false;

            const replayCandidates = normalizeCandidateIds(
                currentTrack.youtubeCandidates,
                currentTrack.youtubeId || currentYoutubeIdRef.current || (currentTrack.isYoutube ? currentTrack.id : undefined)
            );
            const replayYoutubeId = replayCandidates[0];

            if (replayYoutubeId) {
                currentCandidatesRef.current = replayCandidates;
                currentCandidateIndexRef.current = 0;
                persistResolvedTrack(trackId, replayYoutubeId, replayCandidates);
                loadIntoPlayer(replayYoutubeId, true);
                return;
            }
        }

        const gen = ++loadGenRef.current;
        currentTrackIdRef.current = trackId;
        lastPlaybackNonceRef.current = playbackNonce;
        setIsLoading(true);
        setError(null);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        pendingSeekTimeRef.current = null;
        isSeekingRef.current = false;
        stopProgressTimer();

        const autoplay = !isInitialMountRef.current;
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
        }

        const fetchAndLoad = async () => {
            try {
                const resolution = await resolveTrackPlayback(currentTrack);
                if (gen !== loadGenRef.current) return;

                currentCandidatesRef.current = resolution.candidates;
                currentCandidateIndexRef.current = Math.max(resolution.candidates.indexOf(resolution.youtubeId), 0);
                persistResolvedTrack(trackId, resolution.youtubeId, resolution.candidates);
                loadIntoPlayer(resolution.youtubeId, autoplay);

                if (!autoplay) {
                    setIsLoading(false);
                    setIsPlaying(false);
                }
            } catch (e: any) {
                if (gen !== loadGenRef.current) return;
                console.error('Failed to load track:', e?.name || 'Error', e?.message || e);
                currentCandidatesRef.current = [];
                currentCandidateIndexRef.current = 0;
                setError('Failed to load track');
                setIsLoading(false);
                setIsPlaying(false);
            }
        };

        fetchAndLoad();
    }, [currentTrack, loadIntoPlayer, persistResolvedTrack, resolveTrackPlayback, setIsPlaying, stopProgressTimer]);

    const togglePlay = useCallback(() => {
        if (isLoading) return;
        setIsPlaying(!isPlaying);
    }, [isLoading, isPlaying, setIsPlaying]);

    const handleSeekStart = useCallback(() => {
        isSeekingRef.current = true;
    }, []);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        const targetTime = duration > 0 ? (value / 100) * duration : 0;

        setProgress(value);
        setCurrentTime(targetTime);
        pendingSeekTimeRef.current = targetTime;

        if (!isSeekingRef.current) {
            commitSeek(targetTime);
        }
    }, [commitSeek, duration]);

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextVolume = Number(e.target.value);
        setVolume(nextVolume);
        setPlayerVolume(nextVolume);
    };

    const toggleMute = () => {
        const nextVolume = volume > 0 ? 0 : 0.7;
        setVolume(nextVolume);
        setPlayerVolume(nextVolume);
    };

    const toggleShuffle = () => setIsShuffle(!isShuffle);
    const toggleRepeat = () => setRepeatMode((repeatMode + 1) % 3);

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return '0:00';
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
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }}
                />

                <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 md:hidden block z-20">
                    <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div
                    className="relative z-10 flex flex-col md:flex-row items-center justify-between h-full px-4 md:px-6 py-3 md:py-0 transition-all duration-300 gap-3 md:gap-0"
                    style={{ paddingRight: isSidebarOpen && isLargeScreen ? `${sidebarWidth + 24}px` : undefined }}
                >
                    <div className="flex items-center gap-3 w-full md:w-[30%] md:flex-none justify-start border-b border-white/5 md:border-none pb-2 md:pb-0">
                        <div className="relative group/img flex-shrink-0">
                            <img
                                src={currentTrack.image || currentTrack.thumbnail || 'https://via.placeholder.com/56'}
                                className="h-12 w-12 md:h-14 md:w-14 object-cover rounded shadow-card"
                                alt="Cover"
                            />
                        </div>
                        <div className="flex flex-col justify-center overflow-hidden min-w-0 flex-1">
                            <span className="text-sm font-medium truncate hover:underline cursor-pointer text-white leading-tight">
                                {currentTrack.name || 'No Title'}
                            </span>
                            <span className="text-xs truncate opacity-70 text-[#E0E0E0] leading-tight mt-0.5">
                                {isLoading ? (
                                    <span className="opacity-70">Loading...</span>
                                ) : error ? (
                                    <span className="text-accent-pink">{error}</span>
                                ) : (
                                    currentTrack.artist || 'Unknown Artist'
                                )}
                            </span>
                        </div>
                        {onToggleNowPlaying && (
                            <button onClick={onToggleNowPlaying} className="md:hidden transition-all text-white/60 hover:text-white p-2" title="Now Playing" disabled={isLoading}>
                                <Music size={20} strokeWidth={2} />
                            </button>
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
                                title={isPlaying ? 'Pause' : 'Play'}
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
                            <button onClick={toggleRepeat} className={`transition-all duration-150 relative hover:scale-105 ${repeatMode > 0 ? 'text-[#1DB954]' : 'text-white/70 hover:text-white'}`} disabled={isLoading} title={repeatMode === 0 ? 'Repeat' : repeatMode === 1 ? 'Repeat All' : 'Repeat One'}>
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
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={progress || 0}
                                    onChange={handleSeek}
                                    onPointerDown={handleSeekStart}
                                    onPointerUp={() => commitSeek()}
                                    onPointerCancel={() => commitSeek()}
                                    onMouseDown={handleSeekStart}
                                    onMouseUp={() => commitSeek()}
                                    onTouchStart={handleSeekStart}
                                    onTouchEnd={() => commitSeek()}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={isLoading}
                                />
                            </div>
                            <span className="min-w-[35px] tabular-nums text-[10px] md:text-xs">{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center justify-end w-full md:w-[30%] min-w-[140px] gap-2 px-4 md:px-0 pb-2 md:pb-0">
                        <button onClick={toggleMute} className="transition-all text-white/70 hover:text-white" title={volume === 0 ? 'Unmute' : 'Mute'}>
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
