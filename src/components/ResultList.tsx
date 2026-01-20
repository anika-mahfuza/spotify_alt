import { Play } from 'lucide-react';

interface Video {
    id: string;
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
}

interface ResultListProps {
    results: Video[];
    onSelect: (video: Video) => void;
}

export const ResultList = ({ results, onSelect }: ResultListProps) => {
    if (results.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-spotify-text-gray text-lg">No results found. Try a different search.</p>
            </div>
        );
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="grid grid-cols-1 gap-2 animate-fadeIn">
            {results.map((video) => (
                <div
                    key={video.id}
                    onClick={() => onSelect(video)}
                    className="
                        flex items-center gap-4 p-3 rounded-lg
                        bg-transparent hover:bg-white/5
                        cursor-pointer transition-all duration-200
                        group
                    "
                >
                    {/* Thumbnail with Play Overlay */}
                    <div className="relative flex-shrink-0">
                        <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded shadow-lg"
                            loading="lazy"
                        />
                        
                        {/* Play button overlay on hover */}
                        <div className="
                            absolute inset-0 bg-black/40 rounded
                            flex items-center justify-center
                            opacity-0 group-hover:opacity-100
                            transition-opacity duration-200
                        ">
                            <div className="bg-spotify-green rounded-full p-3">
                                <Play size={20} fill="black" className="text-black ml-0.5" />
                            </div>
                        </div>

                        {/* Duration badge */}
                        {video.duration > 0 && (
                            <div className="
                                absolute bottom-1 right-1
                                bg-black/80 text-white text-xs
                                px-1.5 py-0.5 rounded
                                font-medium
                            ">
                                {formatDuration(video.duration)}
                            </div>
                        )}
                    </div>

                    {/* Video Info */}
                    <div className="flex-1 min-w-0">
                        <h3 
                            className="
                                text-white font-medium text-sm sm:text-base
                                line-clamp-2 group-hover:text-spotify-green
                                transition-colors duration-200
                            "
                            dangerouslySetInnerHTML={{ __html: video.title }} 
                        />
                        <p className="text-spotify-text-gray text-xs sm:text-sm mt-1 truncate">
                            {video.uploader}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};
