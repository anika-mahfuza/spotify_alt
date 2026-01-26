from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import yt_dlp
import uvicorn
import logging
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import os
import json
import time
import httpx
from typing import Dict, Any
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

load_dotenv()

# --- Simple Memory Cache ---
class MemoryCache:
    def __init__(self, max_size: int = 50):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size
    
    def get(self, key: str) -> str | None:
        if key in self.cache:
            item = self.cache[key]
            if time.time() < item['expires']:
                return item['value']
            del self.cache[key]
        return None
    
    def set(self, key: str, value: str, ttl: int = 600):
        if len(self.cache) >= self.max_size:
            oldest = min(self.cache.keys(), key=lambda k: self.cache[k]['expires'])
            del self.cache[oldest]
        
        self.cache[key] = {
            'value': value,
            'expires': time.time() + ttl
        }
    
    def delete(self, key: str):
        self.cache.pop(key, None)
    
    def size(self) -> int:
        current = time.time()
        expired = [k for k, v in self.cache.items() if current >= v['expires']]
        for k in expired:
            del self.cache[k]
        return len(self.cache)

cache = MemoryCache()

# --- Spotify Config ---
CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIPY_REDIRECT_URI")
# Require FRONTEND_URL to be set in production, or fallback to the known production URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://217.154.114.227:11700")
SCOPE = "user-library-read playlist-read-private user-read-private user-read-email streaming user-read-recently-played user-top-read"

if not CLIENT_ID or not CLIENT_SECRET or not REDIRECT_URI:
    raise ValueError("Missing Spotify credentials in .env")

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE,
    cache_handler=spotipy.cache_handler.MemoryCacheHandler(),
    show_dialog=True  # Force account selection dialog
)

# --- YT-DLP Options ---
YTDL_OPTS = {
    'format': 'bestaudio[ext=m4a]/bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
}

YTDL_SEARCH_OPTS = {
    'quiet': True,
    'no_warnings': True,
    'noplaylist': True,
    'extract_flat': 'in_playlist',
    'skip_download': True,
}

# --- Models ---
class VideoResult(BaseModel):
    id: str | None = None
    title: str | None = None
    duration: int | None = None
    thumbnail: str | None = None
    uploader: str | None = None

# --- Helper Functions ---
def extract_audio_url(video_id: str) -> dict:
    """Extract audio stream URL from YouTube video with caching"""
    cache_key = f"stream:{video_id}"
    cached = cache.get(cache_key)
    
    if cached:
        try:
            return json.loads(cached)
        except:
            cache.delete(cache_key)
    
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
    with yt_dlp.YoutubeDL(YTDL_OPTS) as ydl:
        info = ydl.extract_info(video_url, download=False)
        
        result = {
            "url": info.get("url"),
            "title": info.get("title"),
            "thumbnail": info.get("thumbnail"),
            "uploader": info.get("uploader"),
            "duration": info.get("duration"),
        }
        
        if result["url"]:
            cache.set(cache_key, json.dumps(result), ttl=600)
        
        return result

def search_youtube(query: str, limit: int = 1) -> list:
    """Search YouTube and return results"""
    with yt_dlp.YoutubeDL(YTDL_SEARCH_OPTS) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
        
        results = []
        if info and 'entries' in info:
            for entry in info['entries']:
                if entry:
                    video_id = entry.get('id')
                    results.append({
                        "id": video_id,
                        "title": entry.get('title'),
                        "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg" if video_id else None,
                        "duration": entry.get('duration'),
                        "uploader": entry.get('uploader')
                    })
        
        return results

# --- Basic Endpoints ---
@app.get("/")
def root():
    return {"status": "ok", "message": "Music Player Backend"}

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "cache_size": cache.size(),
        "yt_dlp_version": yt_dlp.__version__
    }

# --- Spotify Auth ---
@app.get("/login")
def login(frontend_url: str | None = None):
    # Force account selection by adding show_dialog parameter
    # Use 'state' parameter to pass the frontend_url through Spotify auth flow
    auth_url = sp_oauth.get_authorize_url(state=frontend_url)
    # Ensure show_dialog=true is in the URL
    if 'show_dialog' not in auth_url:
        separator = '&' if '?' in auth_url else '?'
        auth_url = f"{auth_url}{separator}show_dialog=true"
    return RedirectResponse(auth_url)

@app.get("/callback")
def callback(code: str, state: str | None = None):
    try:
        # Avoid DeprecationWarning by requesting string token but retrieving full info from cache
        sp_oauth.get_access_token(code, as_dict=False)
        token_info = sp_oauth.get_cached_token()
        
        access_token = token_info.get('access_token')
        refresh_token = token_info.get('refresh_token')
        expires_in = token_info.get('expires_in')
        
        # HARDCODED FIX: Always redirect to the Cloudflare Pages frontend
        # This ensures we don't get stuck on the Worker URL or Wispbyte IP
        frontend_redirect_url = "https://spotify-alt.pages.dev"
            
        return RedirectResponse(
            f"{frontend_redirect_url}/?token={access_token}&refresh_token={refresh_token}&expires_in={expires_in}"
        )
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

@app.get("/refresh-token")
def refresh_token(refresh_token: str):
    try:
        token_info = sp_oauth.refresh_access_token(refresh_token)
        return token_info
    except Exception as e:
        logger.error(f"Refresh error: {e}")
        raise HTTPException(status_code=401, detail="Refresh failed")

@app.get("/logout")
def logout():
    return RedirectResponse(f"{FRONTEND_URL}/login")

# --- YouTube Endpoints ---
@app.get("/search")
def search(q: str = Query(..., min_length=1)):
    """Search YouTube videos"""
    try:
        results = search_youtube(q, limit=10)
        return [VideoResult(**r) for r in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search-and-play")
def search_and_play(request: Request, q: str = Query(..., min_length=1)):
    """Search and return first playable result with proxied stream URL"""
    try:
        results = search_youtube(q, limit=1)
        if not results:
            raise HTTPException(status_code=404, detail="No results found")
        
        video = results[0]
        video_id = video['id']
        
        # Pre-cache the stream URL to make playback faster
        stream_info = extract_audio_url(video_id)
        
        # Return the proxied stream URL instead of direct YouTube URL
        base = os.getenv("PUBLIC_API_URL", str(request.base_url).rstrip("/"))
        proxied_url = f"{base}/stream/{video_id}"
        
        return {
            "id": video_id,
            "title": stream_info.get('title') or video['title'],
            "url": proxied_url,  # Changed: Return proxied URL instead of direct YouTube URL
            "thumbnail": stream_info.get('thumbnail') or video['thumbnail'],
            "uploader": stream_info.get('uploader') or video['uploader']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/play/{video_id}")
def play(request: Request, video_id: str):
    """Get stream URL for video ID"""
    # Use PUBLIC_API_URL if set (for proxy setups), otherwise use request base
    base = os.getenv("PUBLIC_API_URL", str(request.base_url).rstrip("/"))
    return {"url": f"{base}/stream/{video_id}", "id": video_id}

@app.get("/stream/{video_id}")
async def stream(video_id: str):
    """Stream audio from YouTube video"""
    try:
        stream_info = extract_audio_url(video_id)
        url = stream_info.get('url')
        if not url:
            raise HTTPException(status_code=500, detail="No audio stream found")
        
        # Async Proxy using httpx
        # Using a generator to stream chunks as they arrive
        async def iterfile():
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                async with client.stream("GET", url) as r:
                    r.raise_for_status()
                    async for chunk in r.aiter_bytes(chunk_size=128*1024): # 128KB chunks
                        yield chunk

        return StreamingResponse(iterfile(), media_type="audio/mp4")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Spotify Endpoints ---
@app.get("/playlists")
def get_playlists(token: str):
    """Get user playlists"""
    try:
        sp = spotipy.Spotify(auth=token)
        playlists = []
        limit = 50
        
        results = sp.current_user_playlists(limit=limit)
        
        while results:
            items = results.get('items', [])
            if not items:
                break
                
            playlists.extend(items)
            
            if results.get('next'):
                results = sp.next(results)
            else:
                break
            
        return playlists
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/playlist/{playlist_id}")
def get_playlist_tracks(playlist_id: str, token: str):
    """Get all tracks from playlist"""
    try:
        sp = spotipy.Spotify(auth=token)
        tracks = []
        limit = 100
        
        results = sp.playlist_tracks(playlist_id, limit=limit)
        
        while results:
            items = results.get('items', [])
            
            if not items:
                break
                
            for item in items:
                track = item.get('track')
                if track:
                    tracks.append({
                        "name": track['name'],
                        "artist": track['artists'][0]['name'] if track.get('artists') else 'Unknown',
                        "album": track['album']['name'] if track.get('album') else 'Unknown',
                        "duration_ms": track.get('duration_ms', 0),
                        "image": track['album']['images'][0]['url'] if track.get('album', {}).get('images') else None,
                        "id": track['id']
                    })
            
            if results.get('next'):
                results = sp.next(results)
            else:
                break
        
        return tracks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/album/{album_id}")
def get_album_tracks(album_id: str, token: str):
    """Get tracks from album"""
    try:
        sp = spotipy.Spotify(auth=token)
        album = sp.album(album_id)
        
        tracks = []
        for item in album['tracks']['items']:
            tracks.append({
                "name": item['name'],
                "artist": item['artists'][0]['name'],
                "album": album['name'],
                "duration_ms": item['duration_ms'],
                "image": album['images'][0]['url'] if album['images'] else None,
                "id": item['id']
            })
        
        return {
            "name": album['name'],
            "images": album['images'],
            "tracks": tracks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/artist/{artist_id}")
def get_artist_details(artist_id: str, token: str):
    """Get artist details and top tracks"""
    try:
        sp = spotipy.Spotify(auth=token)
        artist = sp.artist(artist_id)
        top_tracks = sp.artist_top_tracks(artist_id)
        albums = sp.artist_albums(artist_id, album_type='album', limit=10)
        
        return {
            "artist": artist,
            "top_tracks": top_tracks.get('tracks', []),
            "albums": albums.get('items', [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/artist-details")
def get_artist_by_name(artistName: str = Query(...), token: str = Query(...)):
    """Search for artist by name"""
    try:
        sp = spotipy.Spotify(auth=token)
        results = sp.search(q=f"artist:{artistName}", type='artist', limit=1)
        items = results.get('artists', {}).get('items', [])
        
        if not items:
            raise HTTPException(status_code=404, detail="Artist not found")
        
        return items[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/made-for-you")
def get_made_for_you(token: str):
    """Get personalized playlists"""
    try:
        sp = spotipy.Spotify(auth=token)
        playlists = []
        
        try:
            results = sp.category_playlists(category_id='0JQ5DAqbMKFHOzuVTgTizF', limit=10)
            playlists.extend(results.get('playlists', {}).get('items', []))
        except:
            pass
        
        if not playlists:
            search_terms = ["Discover Weekly", "Daily Mix", "Release Radar"]
            for term in search_terms:
                try:
                    result = sp.search(q=term, type='playlist', limit=2)
                    items = result.get('playlists', {}).get('items', [])
                    for item in items:
                        if item and item.get('owner', {}).get('id') == 'spotify':
                            playlists.append(item)
                except:
                    pass
        
        seen = set()
        unique = []
        for p in playlists:
            if p and p.get('id') and p['id'] not in seen:
                seen.add(p['id'])
                unique.append(p)
        
        return unique[:10]
    except Exception as e:
        return []

@app.get("/top-tracks")
def get_top_tracks(token: str):
    """Get user's top tracks"""
    try:
        sp = spotipy.Spotify(auth=token)
        results = sp.current_user_top_tracks(limit=10, time_range='short_term')
        return results['items']
    except Exception as e:
        return []

@app.get("/top-artists")
def get_top_artists(token: str):
    """Get user's top artists"""
    try:
        sp = spotipy.Spotify(auth=token)
        results = sp.current_user_top_artists(limit=10, time_range='short_term')
        return results['items']
    except Exception as e:
        return []

@app.get("/recommendations")
def get_recommendations(token: str):
    """Get personalized recommendations"""
    try:
        sp = spotipy.Spotify(auth=token)
        
        seed_tracks = []
        seed_artists = []
        
        try:
            top_tracks = sp.current_user_top_tracks(limit=2, time_range='short_term')
            seed_tracks = [t['id'] for t in top_tracks.get('items', [])[:2]]
        except:
            pass
        
        try:
            top_artists = sp.current_user_top_artists(limit=2, time_range='short_term')
            seed_artists = [a['id'] for a in top_artists.get('items', [])[:2]]
        except:
            pass
        
        if not seed_tracks and not seed_artists:
            return []
        
        results = sp.recommendations(
            seed_tracks=seed_tracks[:2],
            seed_artists=seed_artists[:2],
            limit=20
        )
        return results.get('tracks', [])
    except Exception as e:
        return []

@app.get("/saved-albums")
def get_saved_albums(token: str):
    """Get user's saved albums"""
    try:
        sp = spotipy.Spotify(auth=token)
        albums = []
        limit = 50
        
        results = sp.current_user_saved_albums(limit=limit)
        
        while results:
            items = results.get('items', [])
            if not items:
                break
                
            for item in items:
                if item.get('album'):
                    albums.append(item['album'])
            
            if results.get('next'):
                results = sp.next(results)
            else:
                break
            
        return albums
    except Exception as e:
        return []

@app.get("/saved-tracks")
def get_saved_tracks(token: str):
    """Get user's saved tracks"""
    try:
        sp = spotipy.Spotify(auth=token)
        tracks = []
        limit = 50
        
        results = sp.current_user_saved_tracks(limit=limit)
        
        while results:
            items = results.get('items', [])
            if not items:
                break
                
            for item in items:
                if item.get('track'):
                    tracks.append(item['track'])
            
            if results.get('next'):
                results = sp.next(results)
            else:
                break
            
        return tracks
    except Exception as e:
        return []

@app.get("/browse-categories")
def get_browse_categories(token: str):
    """Get browse categories with playlists"""
    try:
        sp = spotipy.Spotify(auth=token)
        categories = sp.categories(limit=8)
        
        result = []
        for cat in categories.get('categories', {}).get('items', []):
            try:
                playlists = sp.category_playlists(category_id=cat['id'], limit=6)
                result.append({
                    "id": cat['id'],
                    "name": cat['name'],
                    "icons": cat.get('icons', []),
                    "playlists": playlists.get('playlists', {}).get('items', [])
                })
            except Exception as e:
                pass
        
        return result
    except Exception as e:
        return []

@app.get("/followed-artists")
def get_followed_artists(token: str):
    """Get followed artists"""
    try:
        sp = spotipy.Spotify(auth=token)
        artists = []
        limit = 50
        
        response = sp.current_user_followed_artists(limit=limit)
        
        while response:
            artists_data = response.get('artists', {})
            items = artists_data.get('items', [])
            if not items:
                break
                
            artists.extend(items)
            
            if artists_data.get('next'):
                response = sp.next(artists_data)
            else:
                break
                
        return artists
    except Exception as e:
        return []

if __name__ == "__main__":
    port = int(os.environ.get("SERVER_PORT", os.environ.get("PORT", 11700)))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        workers=1,
        limit_concurrency=10,
        timeout_keep_alive=5,
        access_log=False
    )
