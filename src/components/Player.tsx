import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2 } from 'lucide-react';

interface PlayerProps {
    currentTrack: any;
    onNext: () => void;
    onPrev: () => void;
    backendUrl: string;
}

export function Player({ currentTrack, onNext, onPrev, backendUrl }: PlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);

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
                audioRef.current.src = '';
            }
            
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);

            try {
                let url: string;
                
                if (currentTrack.isYoutube) {
                    const res = await fetch(`${backendUrl}/play/${currentTrack.id}`);
                    if (!res.ok) throw new Error('Failed to fetch stream');
                    const data = await res.json();
                    url = data.url;
                } else {
                    const query = `${currentTrack.name} ${currentTrack.artist} audio`;
                    const res = await fetch(`${backendUrl}/search-and-play?q=${encodeURIComponent(query)}`);
                    if (!res.ok) throw new Error('Failed to fetch stream');
                    const data = await res.json();
                    url = data.url;
                }

                if (audioRef.current && url) {
                    audioRef.current.src = url;
                    audioRef.current.volume = volume;
                    
                    await audioRef.current.play();
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
    }, [currentTrack, backendUrl, volume]);

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

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleEnded = () => {
        setIsPlaying(false);
        onNext();
    };

    const handleError = () => {
        setError('Audio playback error');
        setIsPlaying(false);
    };

    return (
        <div className="fixed bottom-0 w-full h-24 bg-spotify-black border-t border-spotify-light-gray flex items-center justify-between px-4 z-[100]">
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onError={handleError}
                preload="metadata"
            />

            {/* Track Info */}
            <div className="flex items-center gap-4 w-[30%]">
                {currentTrack && (
                    <>
                        <img
                            src={currentTrack.image || currentTrack.thumbnail || 'https://via.placeholder.com/56'}
                            className="h-14 w-14 rounded object-cover bg-spotify-light-gray"
                            alt="Cover"
                        />
                        <div className="flex flex-col justify-center overflow-hidden">
                            <span className="text-white text-sm font-medium truncate">
                                {isLoading ? 'Loading...' : (currentTrack.name || currentTrack.title || "No Title")}
                            </span>
                            <span className="text-spotify-text-gray text-xs">
                                {error || (currentTrack.artist || currentTrack.uploader || "Unknown Artist")}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-2 w-[40%] max-w-[722px]">
                <div className="flex items-center gap-6">
                    <button 
                        className="text-spotify-text-gray hover:text-white transition-colors disabled:opacity-50" 
                        disabled={isLoading}
                    >
                        <Shuffle size={16} />
                    </button>
                    
                    <button 
                        onClick={onPrev} 
                        className="text-spotify-text-gray hover:text-white transition-colors disabled:opacity-50" 
                        disabled={isLoading}
                    >
                        <SkipBack size={20} fill="currentColor" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
                        disabled={isLoading || !currentTrack}
                    >
                        {isPlaying ? (
                            <Pause size={20} fill="currentColor" />
                        ) : (
                            <Play size={20} fill="currentColor" className="ml-0.5" />
                        )}
                    </button>

                    <button 
                        onClick={onNext} 
                        className="text-spotify-text-gray hover:text-white transition-colors disabled:opacity-50" 
                        disabled={isLoading}
                    >
                        <SkipForward size={20} fill="currentColor" />
                    </button>
                    
                    <button 
                        className="text-spotify-text-gray hover:text-white transition-colors disabled:opacity-50" 
                        disabled={isLoading}
                    >
                        <Repeat size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2 w-full">
                    <span className="text-[11px] text-[#a7a7a7] min-w-[40px]">
                        {formatTime(currentTime)}
                    </span>
                    
                    <div className="relative h-1 w-full bg-[#4d4d4d] rounded group">
                        <div
                            className="h-full bg-white rounded group-hover:bg-spotify-green transition-colors"
                            style={{ width: `${progress}%` }}
                        />
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={progress || 0}
                            onChange={handleSeek}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={isLoading}
                        />
                    </div>
                    
                    <span className="text-[11px] text-[#a7a7a7] min-w-[40px] text-right">
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Volume */}
            <div className="flex items-center justify-end gap-3 w-[30%]">
                <Volume2 size={20} className="text-spotify-text-gray" />
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolume}
                    className="w-24 h-1 bg-[#4d4d4d] rounded appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                             [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white 
                             [&::-webkit-slider-thumb]:rounded-full"
                />
            </div>
        </div>
    );
}
