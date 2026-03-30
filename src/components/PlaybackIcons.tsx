interface PlaybackIconProps {
  className?: string;
}

export function SolidPlayIcon({ className }: PlaybackIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.85 2.95c0-.86.94-1.38 1.68-.92l7.05 4.33c.71.44.71 1.47 0 1.9l-7.05 4.33c-.74.46-1.68-.06-1.68-.92V2.95Z" />
    </svg>
  );
}

export function SolidPauseIcon({ className }: PlaybackIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3.75" y="2.6" width="3.1" height="10.8" rx="1" />
      <rect x="9.15" y="2.6" width="3.1" height="10.8" rx="1" />
    </svg>
  );
}
