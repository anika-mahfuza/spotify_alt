import { useState, useRef, useEffect, useCallback } from 'react';
import { SkipBack, SkipForward, Repeat, Shuffle, Volume2, VolumeX, Music, Video, VideoOff } from 'lucide-react';
import { Track } from '../types';
import { SolidPauseIcon, SolidPlayIcon } from './PlaybackIcons';
import { backendClient } from '../api/client';
import { BACKEND_ENDPOINTS } from '../api/endpoints';

interface YouTubePlayer {
    setVolume: (volume: number) => void;
    loadVideoById: (options: { videoId: string; startSeconds: number }) => void;
    cueVideoById: (options: { videoId: string; startSeconds: number }) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    getPlayerState: () => number;
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    destroy: () => void;
    getVideoData?: () => { video_id?: string };
}

interface YouTubePlayerReadyEvent {
    target: YouTubePlayer;
}

interface YouTubePlayerStateEvent {
    data: number;
    target: YouTubePlayer;
}

interface YouTubeNamespace {
    Player: new (
        elementId: string | HTMLElement,
        config: {
            height: string;
            width: string;
            playerVars: Record<string, number | string>;
            events: {
                onReady?: (event: YouTubePlayerReadyEvent) => void;
                onStateChange?: (event: YouTubePlayerStateEvent) => void;
                onError?: (event: YouTubePlayerStateEvent) => void;
            };
        }
    ) => YouTubePlayer;
    PlayerState: {
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        ENDED: number;
        CUED: number;
    };
}

declare global {
    interface Window {
        YT?: YouTubeNamespace;
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
        .replace(/[([][^)\]]*[)\]]/g, ' ')
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
    const [showVideo, setShowVideo] = useState(() => {
        const saved = localStorage.getItem('player_show_video');
        return saved === 'true';
    });

    const stateRefs = useRef({ isShuffle, repeatMode, onNext });
    useEffect(() => {
        stateRefs.current = { isShuffle, repeatMode, onNext };
    }, [isShuffle, repeatMode, onNext]);

    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

    const ytPlayerRef = useRef<YouTubePlayer | null>(null);
    const ytMountRef = useRef<HTMLDivElement | null>(null);
    const ytHostRef = useRef<HTMLDivElement | null>(null);
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
    useEffect(() => localStorage.setItem('player_show_video', showVideo.toString()), [showVideo]);

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

    const resetPlaybackUi = useCallback((loading: boolean) => {
        setError(null);
        setIsLoading(loading);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
    }, []);

    const setPlaybackFailure = useCallback((message: string) => {
        currentCandidatesRef.current = [];
        currentCandidateIndexRef.current = 0;
        setError(message);
        setIsLoading(false);
        setIsPlaying(false);
    }, [setIsPlaying]);

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
        const trackParams: Record<string, string | undefined> = {
            title: track.name,
            artist: track.artist,
            durationMs: track.duration_ms ? String(track.duration_ms) : undefined,
        };

        for (const query of queries) {
            try {
                const data: BestMatchResponse = await backendClient.get<BestMatchResponse>(
                    BACKEND_ENDPOINTS.BEST_MATCH,
                    {
                        params: { ...trackParams, q: query },
                        timeout: 15000,
                    }
                );
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
                    const searchResults = await backendClient.get<SearchResponseItem[]>(
                        endpoint,
                        {
                            params: { ...trackParams, q: query },
                            timeout: 15000,
                        }
                    );
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
    }, []);

    useEffect(() => {
        const initPlayer = () => {
            const youTubeApi = window.YT;
            if (ytPlayerRef.current || !youTubeApi?.Player) return;
            if (!ytMountRef.current) return;

            if (!ytHostRef.current || !ytMountRef.current.contains(ytHostRef.current)) {
                ytMountRef.current.innerHTML = '';
                const host = document.createElement('div');
                host.style.width = '100%';
                host.style.height = '100%';
                ytMountRef.current.appendChild(host);
                ytHostRef.current = host;
            }

            ytPlayerRef.current = new youTubeApi.Player(ytHostRef.current, {
                height: '100%',
                width: '100%',
                playerVars: {
                    autoplay: 0,
                    controls: 1,
                    disablekb: 0,
                    fs: 1,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    origin: window.location.origin,
                    playsinline: 1,
                    rel: 0,
                },
                events: {
                    onReady: (event: YouTubePlayerReadyEvent) => {
                        ytReadyRef.current = true;
                        event.target.setVolume(volumeRef.current * 100);

                        const pending = pendingPlayerLoadRef.current;
                        if (pending) {
                            loadIntoPlayer(pending.youtubeId, pending.autoplay);
                        }
                    },
                    onStateChange: (event: YouTubePlayerStateEvent) => {
                        switch (event.data) {
                            case youTubeApi.PlayerState.PLAYING:
                                setError(null);
                                setIsPlaying(true);
                                setIsLoading(false);
                                startProgressTimer();
                                break;
                            case youTubeApi.PlayerState.PAUSED:
                                setIsPlaying(false);
                                setIsLoading(false);
                                stopProgressTimer();
                                break;
                            case youTubeApi.PlayerState.BUFFERING:
                                setIsLoading(true);
                                break;
                            case youTubeApi.PlayerState.ENDED: {
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
                            }
                            case youTubeApi.PlayerState.CUED:
                                setIsLoading(false);
                                stopProgressTimer();
                                break;
                            default:
                                break;
                        }
                    },
                    onError: (event: YouTubePlayerStateEvent) => {
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
                        setPlaybackFailure('Playback error');
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
            if (ytMountRef.current) {
                ytMountRef.current.innerHTML = '';
            }
            ytHostRef.current = null;
        };
    }, [loadIntoPlayer, setIsPlaying, setPlaybackFailure, startProgressTimer, stopProgressTimer, tryCandidateAtIndex]);

    useEffect(() => {
        if (!ytPlayerRef.current?.getPlayerState || isLoading) return;
        if (!window.YT) return;

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
            resetPlaybackUi(true);
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
        resetPlaybackUi(true);
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
            } catch (e: unknown) {
                if (gen !== loadGenRef.current) return;
                const message = e instanceof Error ? e.message : String(e);
                console.error('Failed to load track:', message);
                setPlaybackFailure('Failed to load track');
            }
        };

        fetchAndLoad();
    }, [currentTrack, loadIntoPlayer, persistResolvedTrack, resetPlaybackUi, resolveTrackPlayback, setIsPlaying, setPlaybackFailure, stopProgressTimer]);

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
    const toggleVideoVisibility = () => setShowVideo(value => !value);

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!currentTrack) return null;

    const progressStyle = {
        background: `linear-gradient(90deg, rgb(var(--accent-color-rgb)) 0%, rgb(var(--accent-color-rgb)) ${progress}%, rgb(var(--surface-hover-rgb) / 0.52) ${progress}%, rgb(var(--surface-hover-rgb) / 0.52) 100%)`,
    };

    const volumeStyle = {
        background: `linear-gradient(90deg, rgb(var(--accent-color-rgb)) 0%, rgb(var(--accent-color-rgb)) ${volume * 100}%, rgb(var(--surface-hover-rgb) / 0.52) ${volume * 100}%, rgb(var(--surface-hover-rgb) / 0.52) 100%)`,
    };

    const secondaryControlClass = 'text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45 transition-colors';
    const activeControlClass = 'text-primary hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-45 transition-colors';
    const visibleVideoWidth = isLargeScreen
        ? (isSidebarOpen
            ? `min(420px, calc(100vw - ${sidebarWidth + 72}px))`
            : 'min(420px, calc(100vw - 3rem))')
        : 'min(380px, calc(100vw - 2rem))';
    const videoPanelStyle = showVideo
        ? {
            position: 'fixed' as const,
            bottom: isLargeScreen ? '96px' : 'calc(152px + env(safe-area-inset-bottom))',
            left: 'auto',
            right: isLargeScreen
                ? (isSidebarOpen ? `${sidebarWidth + 24}px` : '24px')
                : '16px',
            width: visibleVideoWidth,
            height: isLargeScreen ? '300px' : '220px',
            maxWidth: 'calc(100vw - 2rem)',
            maxHeight: isLargeScreen ? 'calc(100vh - 10rem)' : 'calc(100vh - 12rem)',
            zIndex: 95,
        }
        : {
            position: 'fixed' as const,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none' as const,
            bottom: 0,
            right: 0,
            zIndex: -1,
        };

    return (
        <>
            <div
                className={`flex flex-col overflow-hidden border border-border/70 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-300 ${
                    showVideo
                        ? 'pointer-events-auto rounded-[24px] opacity-100 translate-y-0'
                        : 'pointer-events-none rounded-none opacity-0 translate-y-4'
                }`}
                style={videoPanelStyle}
            >
                {showVideo ? (
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/75 px-4 py-2 text-white">
                        <div className="min-w-0">
                            <p className="truncate text-[11px] uppercase tracking-[0.2em] text-white/55">YouTube Video</p>
                            <p className="truncate text-sm font-medium text-white/90">{currentTrack.name}</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleVideoVisibility}
                            className="rounded-full border border-white/12 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
                            title="Hide video"
                        >
                            Hide
                        </button>
                    </div>
                ) : null}
                <div ref={ytMountRef} className="min-h-0 flex-1 bg-black" />
            </div>

            <div
                className="
                    fixed bottom-0 left-0 right-0
                    z-[100]
                    flex min-h-[128px] flex-col justify-end
                    border-t border-border/70
                    bg-bg-primary/24 backdrop-blur-2xl
                    shadow-player
                    md:h-24 md:min-h-0
                "
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-80"
                    style={{ background: 'linear-gradient(to top, rgb(var(--support-dark-rgb) / 0.22), transparent)' }}
                />

                <div
                    className="relative z-10 flex h-full flex-col items-center justify-between gap-2.5 px-4 py-2.5 transition-all duration-300 md:flex-row md:gap-0 md:px-6 md:py-0"
                    style={{ paddingRight: isSidebarOpen && isLargeScreen ? `${sidebarWidth + 24}px` : undefined }}
                >
                    <div className="flex w-full items-center justify-start gap-3 border-b border-border/40 pb-2 md:w-[30%] md:flex-none md:border-none md:pb-0">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[14px] bg-bg-secondary shadow-card md:h-14 md:w-14 md:rounded-2xl">
                            {currentTrack.image || currentTrack.thumbnail ? (
                                <img
                                    src={currentTrack.image || currentTrack.thumbnail}
                                    className="h-full w-full object-cover"
                                    alt="Cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-bg-secondary">
                                    <Music size={18} className="text-text-muted" />
                                </div>
                            )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                            <span className="truncate text-sm font-medium leading-tight text-text-primary">
                                {currentTrack.name || 'No Title'}
                            </span>
                            <span className="mt-0.5 truncate text-xs leading-tight text-text-secondary">
                                {isLoading ? (
                                    <span className="text-text-muted">Loading...</span>
                                ) : error ? (
                                    <span className="text-danger">{error}</span>
                                ) : (
                                    currentTrack.artist || 'Unknown Artist'
                                )}
                            </span>
                        </div>
                        {onToggleNowPlaying ? (
                            <button
                                onClick={onToggleNowPlaying}
                                className="app-icon-button flex h-9 w-9 items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-45 md:hidden"
                                title="Now Playing"
                                disabled={isLoading}
                            >
                                <Music size={18} className="text-text-primary" strokeWidth={2} />
                            </button>
                        ) : null}
                    </div>

                    <div className="flex w-full flex-col items-center justify-center gap-2 md:w-[40%] md:max-w-[600px] md:flex-1">
                        <div className="flex w-full items-center justify-between px-2 md:justify-center md:gap-6 md:px-0">
                            <button onClick={toggleShuffle} className={isShuffle ? activeControlClass : secondaryControlClass} disabled={isLoading} title="Shuffle">
                                <Shuffle size={18} strokeWidth={2} />
                            </button>
                            <button onClick={() => onPrev(isShuffle, repeatMode)} className={secondaryControlClass} disabled={isLoading} title="Previous">
                                <SkipBack size={22} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="app-button-primary flex h-10 w-10 items-center justify-center rounded-full shadow-glow transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 md:h-11 md:w-11"
                                disabled={isLoading || !currentTrack}
                                title={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isLoading ? (
                                    <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                                ) : isPlaying ? (
                                    <SolidPauseIcon className="h-5 w-5 text-primary-foreground" />
                                ) : (
                                    <SolidPlayIcon className="h-5 w-5 text-primary-foreground" />
                                )}
                            </button>
                            <button onClick={() => onNext(isShuffle, repeatMode)} className={secondaryControlClass} disabled={isLoading} title="Next">
                                <SkipForward size={22} className="md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                            </button>
                            <button onClick={toggleRepeat} className={`relative ${repeatMode > 0 ? activeControlClass : secondaryControlClass}`} disabled={isLoading} title={repeatMode === 0 ? 'Repeat' : repeatMode === 1 ? 'Repeat All' : 'Repeat One'}>
                                <Repeat size={18} strokeWidth={2} />
                                {repeatMode === 2 ? <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold">1</span> : null}
                            </button>
                            <button
                                onClick={toggleVideoVisibility}
                                className={showVideo ? activeControlClass : secondaryControlClass}
                                disabled={isLoading}
                                title={showVideo ? 'Hide video' : 'Show video'}
                            >
                                {showVideo ? <VideoOff size={18} strokeWidth={2} /> : <Video size={18} strokeWidth={2} />}
                            </button>
                            {onToggleNowPlaying ? (
                                <button onClick={onToggleNowPlaying} className="hidden text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45 md:block" title="Now Playing" disabled={isLoading}>
                                    <Music size={18} strokeWidth={2} />
                                </button>
                            ) : null}
                        </div>

                        <div className="flex w-full items-center gap-2 text-xs text-text-secondary">
                            <span className="min-w-[35px] text-right text-[10px] tabular-nums md:text-xs">{formatTime(currentTime)}</span>
                            <div className="relative h-1.5 flex-1 cursor-pointer rounded-full" style={progressStyle}>
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
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    disabled={isLoading}
                                />
                            </div>
                            <span className="min-w-[35px] text-[10px] tabular-nums md:text-xs">{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="hidden w-full min-w-[140px] items-center justify-end gap-2 px-4 pb-2 md:flex md:w-[30%] md:px-0 md:pb-0">
                        <button onClick={toggleMute} className={secondaryControlClass} title={volume === 0 ? 'Unmute' : 'Mute'}>
                            {volume === 0 ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
                        </button>
                        <div className="relative h-1.5 w-16 rounded-full md:w-20" style={volumeStyle}>
                            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolume} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
