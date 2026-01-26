import { useEffect, useState, useRef } from 'react';
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
        const newImage = currentTrack?.image || currentTrack?.thumbnail || null;

        // Only update if actually changed
        if (newImage !== lastImageRef.current) {
            setPrevImage(lastImageRef.current);
            lastImageRef.current = newImage;
            setImage(newImage);
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
        backgroundPosition: 'center center',
        filter: 'blur(25px) saturate(1.8) brightness(0.8)',
        opacity: 0.8,
        transform: 'scale(1.1)',
    });

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#121212]">
            <div className="absolute inset-0 bg-[#121212]" />

            {prevImage && (
                <div
                    className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
                    style={{
                        ...getStyle(prevImage),
                        opacity: isTransitioning ? 0 : 0.8
                    }}
                />
            )}

            {image && (
                <div
                    className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
                    style={{
                        ...getStyle(image),
                        opacity: isTransitioning ? 0.8 : 0.8
                    }}
                />
            )}

            <div className="absolute inset-0 bg-black/20" />

            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
                }}
            />
        </div>
    );
}
