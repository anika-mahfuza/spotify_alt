// Replace the fetchAndPlay function in Player.tsx with this improved version
// that shows detailed backend errors to users

const fetchAndPlay = async () => {
    setIsLoading(true);
    setError(null);

    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }

    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);

    try {
        let url: string;

        if (currentTrack.isYoutube) {
            const res = await fetchWithAuth(`${backendUrl}/play/${currentTrack.id}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Network error' }));
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            url = data.url;
        } else {
            const query = `${currentTrack.name} ${currentTrack.artist} audio`;
            const res = await fetchWithAuth(`${backendUrl}/search-and-play?q=${encodeURIComponent(query)}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Network error' }));
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            url = data.url;
            console.log('Player: fetched URL from /search-and-play:', url);
        }

        if (audioRef.current && url) {
            console.log('Player: setting audio.src to', url);
            audioRef.current.src = url;
            audioRef.current.volume = volume;

            // Only auto-play if this is not the initial load
            if (!isInitialLoadRef.current) {
                await audioRef.current.play();
                setIsPlaying(true);
            } else {
                setIsPlaying(false);
            }
        }
    } catch (e) {
        console.error("Failed to play:", e);
        
        // Show more detailed error messages
        let errorMsg = 'Failed to load audio';
        
        if (e instanceof Error) {
            if (e.message.includes('extract')) {
                errorMsg = 'YouTube extraction failed - try updating yt-dlp';
            } else if (e.message.includes('Network')) {
                errorMsg = 'Network error - check connection';
            } else if (e.message.includes('HTTP 500')) {
                errorMsg = 'Server error - backend may need restart';
            } else if (e.message.includes('HTTP 403') || e.message.includes('HTTP 410')) {
                errorMsg = 'YouTube blocked request - try again';
            } else if (e.message) {
                errorMsg = e.message.slice(0, 50); // Show first 50 chars of error
            }
        }
        
        setError(errorMsg);
        setIsPlaying(false);
        
        // Auto-retry once after 2 seconds for extraction errors
        if (errorMsg.includes('extract')) {
            setTimeout(() => {
                console.log('Auto-retrying after extraction error...');
                currentTrackIdRef.current = null; // Force re-fetch
            }, 2000);
        }
    } finally {
        setIsLoading(false);
        isInitialLoadRef.current = false;
    }
};
