import { Play, Pause, Music2, Clock } from 'lucide-react';
import { useState } from 'react';
import { Track } from '../types';

interface Video {
    id: string;
    title: string;
    duration?: number;
    thumbnail?: string;
    uploader?: string;
}

interface ResultListProps {
    results: Video[];
    onSelect: (video: Video) => void;
    currentTrack?: Track | null;
    isPlaying?: boolean;
}

export const ResultList = ({ results, onSelect, currentTrack, isPlaying = false }: ResultListProps) => {
    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 mb-6 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Music2 size={36} className="text-text-muted" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
                <p className="text-text-muted text-sm">Try searching with different keywords</p>
            </div>
        );
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-2 animate-fadeIn">
            {results.map((video) => (
                <VideoItem 
                    key={video.id} 
                    video={video} 
                    onSelect={onSelect} 
                    formatDuration={formatDuration}
                    isActive={currentTrack?.id === video.id}
                    isPlaying={isPlaying}
                />
            ))}
        </div>
    );
};

function VideoItem({ video, onSelect, formatDuration, isActive = false, isPlaying = false }: { 
    video: Video; 
    onSelect: (video: Video) => void; 
    formatDuration: (seconds: number) => string;
    isActive?: boolean;
    isPlaying?: boolean;
}) {
    const [imageError, setImageError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const thumbnailUrl = video.thumbnail || '';
    
    const getThumbnailUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('youtube.com/vi/')) {
            return url.replace('/maxresdefault.jpg', '/hqdefault.jpg');
        }
        return url;
    };
    
    return (
        <div
            onClick={() => onSelect(video)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                flex items-center gap-4 p-3 rounded-lg
                backdrop-blur-md
                cursor-pointer transition-all duration-200
                group border shadow-lg hover:shadow-xl
                ${isActive 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10'}
            `}
        >
            {/* Thumbnail Container */}
            <div className="relative flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-white/5 backdrop-blur-sm shadow-card border border-white/10">
                {!imageError && thumbnailUrl ? (
                    <>
                        <img 
                            src={getThumbnailUrl(thumbnailUrl)} 
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                            onError={() => setImageError(true)}
                        />
                        
                        {/* Play button overlay */}
                        <div className={`
                            absolute inset-0 bg-black/60
                            flex items-center justify-center
                            transition-opacity duration-200
                            ${isHovered || isActive ? 'opacity-100' : 'opacity-0'}
                        `}>
                            <div className={`
                                w-14 h-14 rounded-full
                                flex items-center justify-center
                                transform transition-all duration-200
                                hover:scale-110
                                ${isActive ? 'bg-primary' : 'bg-white hover:bg-white'}
                            `}>
                                {isActive && isPlaying ? (
                                    <Pause size={24} fill="black" className="text-black" />
                                ) : (
                                    <Play size={24} fill="black" className="text-black ml-1" />
                                )}
                            </div>
                        </div>

                        {/* Duration badge */}
                        {video.duration && video.duration > 0 && (
                            <div className="
                                absolute bottom-2 right-2
                                bg-black/80 backdrop-blur-sm
                                text-white text-xs font-semibold
                                px-2 py-1 rounded
                                flex items-center gap-1
                            ">
                                <Clock size={12} />
                                {formatDuration(video.duration)}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/10 backdrop-blur-md">
                        <Music2 size={40} className="text-text-muted" />
                    </div>
                )}
            </div>

            {/* Video Info */}
            <div className="flex-1 min-w-0 pr-4">
                <h3 
                    className={`
                        font-semibold text-base sm:text-lg mb-2
                        line-clamp-2 leading-snug transition-colors
                        ${isActive ? 'text-primary' : 'text-white group-hover:text-primary'}
                    `}
                    dangerouslySetInnerHTML={{ __html: video.title }} 
                />
                
                {video.uploader && (
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
                            <Music2 size={14} className="text-text-muted" />
                        </div>
                        <p className="text-text-secondary text-sm truncate hover:text-white transition-colors">
                            {video.uploader}
                        </p>
                    </div>
                )}
            </div>

            {/* Play Button - Desktop */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(video);
                }}
                className={`
                    hidden sm:flex items-center justify-center
                    w-12 h-12 rounded-full
                    transition-all duration-200
                    shadow-button
                    ${isHovered || isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}
                    ${isActive ? 'bg-primary' : 'bg-white hover:bg-white'}
                `}
            >
                {isActive && isPlaying ? (
                    <Pause size={20} fill="black" className="text-black" />
                ) : (
                    <Play size={20} fill="black" className="text-black ml-0.5" />
                )}
            </button>
        </div>
    );
}
