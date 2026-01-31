import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Music, X, ExternalLink, Trash2 } from 'lucide-react';
import { Track, Artist } from '../types';

interface NowPlayingSidebarProps {
    currentTrack: Track | null;
    artistDetails: Artist | null;
    onClose: () => void;
    queue?: Track[];
    currentIndex?: number;
    onSelectQueueIndex?: (index: number) => void;
    onRemoveFromQueue?: (index: number) => void;
    width: number;
    setWidth: (width: number) => void;
}

export function NowPlayingSidebar({ currentTrack, artistDetails, onClose, queue = [], currentIndex = 0, onSelectQueueIndex, onRemoveFromQueue, width, setWidth }: NowPlayingSidebarProps) {
    const [showAllQueue, setShowAllQueue] = useState(false);
    // Removed local width state in favor of prop
    const [isResizing, setIsResizing] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Track window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - mouseMoveEvent.clientX;
            // Auto-close threshold
            if (newWidth < 240) {
                onClose();
                setIsResizing(false);
            } else if (newWidth >= 280 && newWidth <= 600) {
                setWidth(newWidth);
            }
        }
    }, [isResizing, onClose]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResizing);
        }
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const coverUrl = currentTrack?.image || currentTrack?.thumbnail;

    const upcoming = useMemo(() => {
        const start = currentIndex + 1;
        if (start < 0) return [];
        return showAllQueue ? queue.slice(start) : queue.slice(start, start + 5);
    }, [currentIndex, queue, showAllQueue]);

    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {!isDesktop && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden animate-fadeIn"
                    onClick={onClose}
                />
            )}
            
            <div
                ref={sidebarRef}
                className={`fixed lg:static top-0 right-0 z-[60] h-screen flex flex-col p-5 border-l border-white/10 shadow-elevated backdrop-blur-3xl bg-white/5 ${isResizing ? 'select-none' : ''} transition-transform duration-300 lg:transition-none ${!isDesktop ? 'translate-x-0' : ''}`}
                style={{
                    width: isDesktop ? `${width}px` : '90%',
                    maxWidth: isDesktop ? undefined : '480px',
                    paddingBottom: !isDesktop ? 'calc(1.25rem + env(safe-area-inset-bottom))' : undefined,
                }}
            >
            {/* Resize Handle - Desktop Only */}
            <div
                className="hidden lg:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 transition-colors z-50 group"
                onMouseDown={startResizing}
            >
                {/* Visual indicator on hover/active */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-full h-8 bg-white/50 rounded-full opacity-0 group-hover:opacity-100 ${isResizing ? 'opacity-100 bg-primary' : ''} transition-opacity`} />
            </div>

            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Now Playing</h2>
                <button
                    onClick={onClose}
                    className="transition-colors opacity-70 hover:opacity-100 text-white"
                >
                    <X size={20} />
                </button>
            </div>

            {currentTrack ? (
                <div className="flex-1 overflow-y-auto">
                    <div className="mb-5">
                        {coverUrl ? (
                            <img src={coverUrl} alt={currentTrack.name} className="w-full rounded-lg shadow-card" />
                        ) : (
                            <div className="w-full aspect-square rounded-lg bg-black/20 flex items-center justify-center">
                                <Music size={48} className="text-text-muted" />
                            </div>
                        )}
                    </div>

                    <div className="mb-5">
                        <h3 className="text-xl font-bold leading-tight text-white">{currentTrack.name}</h3>
                        <p className="mt-1 opacity-70 text-gray-300">{currentTrack.artist}</p>
                    </div>

                    {artistDetails && (
                        <div className="mb-5">
                            <h4 className="text-base font-bold mb-3 text-white">About the artist</h4>
                            <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                                {artistDetails.images?.[0]?.url && (
                                    <img src={artistDetails.images[0].url} alt={artistDetails.name} className="w-full rounded-lg mb-3" />
                                )}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h5 className="text-base font-bold text-white truncate">{artistDetails.name}</h5>
                                        {artistDetails.followers?.total !== undefined && (
                                            <p className="text-text-secondary text-sm">
                                                {artistDetails.followers.total.toLocaleString()} followers
                                            </p>
                                        )}
                                        {artistDetails.genres && artistDetails.genres.length > 0 && (
                                            <p className="text-text-muted text-xs mt-1.5 line-clamp-2">
                                                {artistDetails.genres.slice(0, 4).join(' • ')}
                                            </p>
                                        )}
                                    </div>
                                    {artistDetails.id && (
                                        <a
                                            href={`https://open.spotify.com/artist/${artistDetails.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-full transition-colors"
                                            title="Open artist in Spotify"
                                        >
                                            <ExternalLink size={12} />
                                            Open
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-bold text-white">Next in queue</h4>
                            {queue.length > currentIndex + 6 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllQueue((v) => !v)}
                                    className="text-xs font-medium text-text-secondary hover:text-white"
                                >
                                    {showAllQueue ? 'Show less' : 'Show all'}
                                </button>
                            )}
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg backdrop-blur-sm">
                            {upcoming.length > 0 ? (
                                <div className="space-y-2">
                                    {upcoming.map((track, idx) => {
                                        const absoluteIndex = currentIndex + 1 + idx;
                                        return (
                                            <div
                                                key={`${track.id}-${absoluteIndex}`}
                                                className="w-full flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-white/10 group"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectQueueIndex?.(absoluteIndex)}
                                                    className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                                                >
                                                    {track.image ? (
                                                        <img src={track.image} alt={track.name} className="w-10 h-10 rounded" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-black/20 flex items-center justify-center">
                                                            <Music size={18} className="text-text-muted" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-white font-medium text-sm truncate">{track.name}</p>
                                                        <p className="text-text-secondary text-xs truncate">{track.artist}</p>
                                                    </div>
                                                </button>

                                                <div className="flex items-center gap-2">
                                                    {track.duration_ms ? (
                                                        <span className="text-xs text-text-muted tabular-nums">
                                                            {formatDuration(track.duration_ms)}
                                                        </span>
                                                    ) : null}

                                                    {onRemoveFromQueue && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onRemoveFromQueue(absoluteIndex);
                                                            }}
                                                            className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                            title="Remove from queue"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-text-secondary text-sm">No next track.</p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Music size={40} className="text-text-muted mb-3" />
                    <p className="text-text-muted text-sm">No song is currently playing.</p>
                </div>
            )}
        </div>
        </>
    );
}
