import { useEffect, useRef, useState } from 'react';
import { Track } from '../types';

interface DynamicBackgroundProps {
  currentTrack: Track | null;
}

export function DynamicBackground({ currentTrack }: DynamicBackgroundProps) {
  const [image, setImage] = useState<string | null>(null);
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastImageRef = useRef<string | null>(null);

  useEffect(() => {
    const nextImage = currentTrack?.image || currentTrack?.thumbnail || null;

    if (nextImage !== lastImageRef.current) {
      setPrevImage(lastImageRef.current);
      lastImageRef.current = nextImage;
      setImage(nextImage);
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPrevImage(null);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentTrack]);

  const getStyle = (img: string | null) => ({
    backgroundImage: img ? `url(${img})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(24px) saturate(1.18) brightness(0.64)',
    transform: 'scale(1.1)',
  });

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-bg-base">
      <div className="absolute inset-0 bg-bg-base" />

      {prevImage ? (
        <div
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{
            ...getStyle(prevImage),
            opacity: isTransitioning ? 0 : 0.76,
          }}
        />
      ) : null}

      {image ? (
        <div
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{
            ...getStyle(image),
            opacity: 0.76,
          }}
        />
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgb(var(--support-dark-rgb) / 0.48) 0%, rgb(var(--app-bg-rgb) / 0.22) 40%, rgb(var(--app-bg-rgb) / 0.68) 100%)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at top center, rgb(var(--surface-tint-rgb) / 0.28) 0%, transparent 48%)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgb(var(--app-bg-rgb) / 0.16) 54%, rgb(var(--app-bg-rgb) / 0.78) 100%)',
        }}
      />
    </div>
  );
}
