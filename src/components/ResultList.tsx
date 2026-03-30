import { useState } from 'react';
import { Clock, Music2 } from 'lucide-react';
import { Track } from '../types';
import { SolidPauseIcon, SolidPlayIcon } from './PlaybackIcons';

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
        <div className="app-card mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <Music2 size={36} className="text-text-muted" />
        </div>
        <h3 className="text-xl font-bold text-text-primary">No results found</h3>
        <p className="mt-2 text-sm text-text-muted">Try searching with different keywords</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2.5 animate-fadeIn">
      {results.map(video => (
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

function VideoItem({
  video,
  onSelect,
  formatDuration,
  isActive = false,
  isPlaying = false,
}: {
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
      className={`group flex cursor-pointer items-center gap-2.5 rounded-[14px] p-2.5 ${isActive ? 'app-card app-card-active' : 'app-card app-card-hover'}`}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-bg-secondary shadow-card sm:h-24 sm:w-24 sm:rounded-[12px]">
        {!imageError && thumbnailUrl ? (
          <>
            <img
              src={getThumbnailUrl(thumbnailUrl)}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              loading="lazy"
              onError={() => setImageError(true)}
            />

            <div className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity duration-200 ${isHovered || isActive ? 'opacity-100' : 'opacity-0'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isActive ? 'app-button-primary' : 'app-button-secondary'}`}>
                {isActive && isPlaying ? (
                  <SolidPauseIcon className={isActive ? 'h-[18px] w-[18px] text-primary-foreground' : 'h-[18px] w-[18px] text-text-primary'} />
                ) : (
                  <SolidPlayIcon className={isActive ? 'h-[18px] w-[18px] text-primary-foreground' : 'h-[18px] w-[18px] text-text-primary'} />
                )}
              </div>
            </div>

            {video.duration && video.duration > 0 ? (
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                <Clock size={11} />
                {formatDuration(video.duration)}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-bg-secondary">
            <Music2 size={30} className="text-text-muted" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 pr-1">
        <h3
          className={`line-clamp-2 text-[14px] font-semibold leading-snug sm:text-[15px] ${isActive ? 'text-primary' : 'text-text-primary'}`}
          dangerouslySetInnerHTML={{ __html: video.title }}
        />

        {video.uploader ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full app-card">
              <Music2 size={12} className="text-text-muted" />
            </div>
            <p className={`truncate text-[12px] ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>{video.uploader}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
