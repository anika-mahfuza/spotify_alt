import { useEffect, useState, useRef } from 'react';

interface SpotlightProps {
    children?: React.ReactNode;
    className?: string;
}

export function Spotlight({ children, className = '' }: SpotlightProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
    const [isVisible, setIsVisible] = useState(false);
    const rafRef = useRef<number | undefined>(undefined);
    const targetRef = useRef({ x: 0.5, y: 0.5 });
    const currentRef = useRef({ x: 0.5, y: 0.5 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            
            const rect = containerRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            targetRef.current = { x, y };
            
            if (!isVisible) {
                setIsVisible(true);
                currentRef.current = { x, y };
                setMousePosition({ x, y });
            }
        };

        const handleMouseLeave = () => {
            targetRef.current = { x: 0.5, y: 0.3 };
        };

        const animate = () => {
            const { x: targetX, y: targetY } = targetRef.current;
            const { x: currentX, y: currentY } = currentRef.current;
            
            // Smooth interpolation (ease-out)
            const ease = 0.08;
            const newX = currentX + (targetX - currentX) * ease;
            const newY = currentY + (targetY - currentY) * ease;
            
            currentRef.current = { x: newX, y: newY };
            setMousePosition({ x: newX, y: newY });
            
            rafRef.current = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        
        const container = containerRef.current;
        if (container) {
            container.addEventListener('mouseleave', handleMouseLeave);
        }
        
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (container) {
                container.removeEventListener('mouseleave', handleMouseLeave);
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [isVisible]);

    const spotlightStyle = {
        background: `radial-gradient(
            circle 600px at ${mousePosition.x * 100}% ${mousePosition.y * 100}%,
            rgba(59, 130, 246, 0.15) 0%,
            rgba(59, 130, 246, 0.08) 25%,
            rgba(59, 130, 246, 0.03) 40%,
            transparent 60%
        )`,
        transition: 'background 0.1s ease-out',
    };

    const ambientStyle = {
        background: `radial-gradient(
            ellipse 80% 50% at 50% -10%,
            rgba(59, 130, 246, 0.12) 0%,
            transparent 50%
        )`,
    };

    return (
        <div 
            ref={containerRef}
            className={`relative overflow-hidden ${className}`}
            style={{ contain: 'layout style' }}
        >
            {/* Ambient top glow - static */}
            <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={ambientStyle}
            />
            
            {/* Mouse-following spotlight */}
            <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={spotlightStyle}
            />
            
            {/* Subtle vignette overlay */}
            <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                    background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
                }}
            />
            
            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
