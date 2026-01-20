from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import uvicorn
import logging
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from dotenv import load_dotenv

load_dotenv()

# --- Spotify Configuration ---
CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIPY_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SCOPE = "user-library-read playlist-read-private user-read-private streaming"

if not CLIENT_ID or not CLIENT_SECRET or not REDIRECT_URI:
    raise ValueError("Missing Spotify credentials in .env file")

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE,
    cache_handler=spotipy.cache_handler.MemoryCacheHandler()
)

# --- YT-DLP Configuration ---
ydl_opts_search = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'default_search': 'ytsearch10',
    'extract_flat': True,
}

ydl_opts_stream = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
}

# --- Models ---
class VideoResult(BaseModel):
    id: str | None = None
    title: str | None = None
    duration: int | None = None
    thumbnail: str | None = None
    uploader: str | None = None
    url: str | None = None

class PlayRequest(BaseModel):
    query: str

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Spotify Alt Backend is running"}

@app.get("/login")
def login():
    """Redirects user to Spotify Login"""
    auth_url = sp_oauth.get_authorize_url()
    return RedirectResponse(auth_url)

@app.get("/callback")
def callback(code: str):
    """Exchanges code for token and redirects to Frontend"""
    try:
        token_info = sp_oauth.get_access_token(code)
        access_token = token_info['access_token']
        return RedirectResponse(f"{FRONTEND_URL}/?token={access_token}")
    except Exception as e:
        logger.error(f"Auth error: {e}")
        return {"error": str(e)}

@app.get("/playlists")
def get_playlists(token: str):
    try:
        sp = spotipy.Spotify(auth=token)
        results = sp.current_user_playlists()
        return results['items']
    except Exception as e:
        logger.error(f"Playlist error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Spotify Token or Error")

@app.get("/playlist/{playlist_id}")
def get_playlist_tracks(playlist_id: str, token: str):
    try:
        sp = spotipy.Spotify(auth=token)
        results = sp.playlist_tracks(playlist_id)
        tracks = []
        for item in results['items']:
            track = item['track']
            if track:
                tracks.append({
                    "name": track['name'],
                    "artist": track['artists'][0]['name'],
                    "album": track['album']['name'],
                    "duration_ms": track['duration_ms'],
                    "image": track['album']['images'][0]['url'] if track['album']['images'] else None,
                    "id": track['id']
                })
        return tracks
    except Exception as e:
        logger.error(f"Track error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/play/{video_id}")
def get_stream_url(video_id: str):
    """Extraction of direct stream URL for a specific video ID."""
    logger.info(f"Extracting stream for ID: {video_id}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts_stream) as ydl:
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            info = ydl.extract_info(video_url, download=False)
            return {
                "id": info.get('id'),
                "title": info.get('title'),
                "url": info.get('url'),
                "thumbnail": info.get('thumbnail')
            }
    except Exception as e:
        logger.error(f"Stream extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search-and-play")
def search_and_play(q: str = Query(..., min_length=1)):
    """Search YouTube and return playable stream URL"""
    logger.info(f"Searching and extracting stream for: {q}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts_stream) as ydl:
            info = ydl.extract_info(f"ytsearch1:{q}", download=False)
            if 'entries' in info and len(info['entries']) > 0:
                video = info['entries'][0]
                return {
                    "id": video.get('id'),
                    "title": video.get('title'),
                    "url": video.get('url'),
                    "thumbnail": video.get('thumbnail'),
                    "uploader": video.get('uploader')
                }
            raise HTTPException(status_code=404, detail="No results found")
    except Exception as e:
        logger.error(f"Search and play error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
def search_videos(q: str = Query(..., min_length=1)):
    logger.info(f"Manual Searching for: {q}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts_search) as ydl:
            info = ydl.extract_info(f"ytsearch10:{q}", download=False)
            results = []
            if 'entries' in info:
                for entry in info['entries']:
                    results.append(VideoResult(
                        id=entry.get('id'),
                        title=entry.get('title'),
                        thumbnail=entry.get('thumbnail'),
                        uploader=entry.get('uploader')
                    ))
            return results
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.environ.get("SERVER_PORT", os.environ.get("PORT", 11700)))
    logger.info(f"Starting Spotify Alt Backend on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
