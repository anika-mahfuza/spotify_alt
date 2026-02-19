require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Spotify Credentials ─────────────────────────────────────────────────────
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`;

// ─── Invidious + Piped Instances for Audio Streaming ──────────────────────────
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.cdaut.de',
  'https://invidious.privacydev.net',
  'https://iv.melmac.space'
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://pipedapi.in.projectsegfau.lt'
];

app.use(cors({
  origin: true, // Allow all origins in dev
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── YouTube Search (youtube-sr) ──────────────────────────────────────────────
let YouTube = null;
async function getYT() {
  if (!YouTube) {
    const mod = await import('youtube-sr');
    YouTube = mod.YouTube;
  }
  return YouTube;
}

function fmt(ms) {
  if (!ms) return '?:??';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function mapResults(results) {
  return (results || []).filter(v => v.id && v.title).slice(0, 25).map(v => ({
    id: v.id,
    title: v.title,
    artist: v.channel?.name || 'Unknown',
    duration: fmt(v.duration),
    thumbnail: v.thumbnail?.url || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`
  }));
}

async function doSearch(q) {
  const yt = await getYT();
  const safeQ = q.trim().split(/\s+/).length < 2 ? `${q} music` : q;
  let results = await yt.search(safeQ, { limit: 25, type: 'video', safeSearch: false });
  if (!results?.length) results = await yt.search(q, { limit: 25, type: 'video', safeSearch: false });
  return mapResults(results);
}

// ─── Audio Stream Fetcher (Invidious first, Piped fallback) ───────────────────
async function getAudioStreamUrl(videoId) {
  // Try Invidious instances first — they return adaptiveFormats with direct URLs
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=title,author,lengthSeconds,videoThumbnails,adaptiveFormats`, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const data = await res.json();

      // Get audio-only adaptive formats
      const audioFormats = (data.adaptiveFormats || [])
        .filter(f => f.type && f.type.startsWith('audio/') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (audioFormats.length > 0) {
        const thumb = data.videoThumbnails?.find(t => t.quality === 'medium')?.url
          || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        return {
          url: audioFormats[0].url,
          title: data.title || '',
          uploader: data.author || '',
          thumbnail: thumb,
          duration: data.lengthSeconds || 0
        };
      }
    } catch (e) {
      console.warn(`Invidious ${base} failed:`, e.message);
      continue;
    }
  }

  // Fallback: Try Piped instances
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const data = await res.json();

      if (data.audioStreams && data.audioStreams.length > 0) {
        const sorted = data.audioStreams
          .filter(s => s.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (sorted.length > 0) {
          return {
            url: sorted[0].url,
            title: data.title || '',
            uploader: data.uploader || '',
            thumbnail: data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            duration: data.duration || 0
          };
        }
      }
    } catch {
      continue;
    }
  }

  throw new Error('Could not get audio stream — all sources failed');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SPOTIFY OAUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Login ────────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  const frontendUrl = req.query.frontend_url || 'http://127.0.0.1:5173';
  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-top-read',
    'user-read-recently-played',
    'user-follow-read'
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: encodeURIComponent(frontendUrl),
    show_dialog: 'false'
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// ─── Callback ─────────────────────────────────────────────────────────────────
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;
  const frontendUrl = state ? decodeURIComponent(state) : 'http://localhost:5173';

  if (error) {
    return res.redirect(`${frontendUrl}/login?error=${error}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=no_code`);
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI
      })
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.text();
      console.error('Token exchange failed:', errData);
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    const data = await tokenRes.json();
    const params = new URLSearchParams({
      token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in.toString()
    });

    res.redirect(`${frontendUrl}?${params}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect(`${frontendUrl}/login?error=server_error`);
  }
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
app.get('/refresh-token', async (req, res) => {
  const { refresh_token } = req.query;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token
      })
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.text();
      console.error('Refresh failed:', errData);
      return res.status(401).json({ error: 'Token refresh failed' });
    }

    const data = await tokenRes.json();
    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token || refresh_token
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SPOTIFY DATA PROXY ENDPOINTS (pass Spotify token from query param)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') || '2', 10);
      console.warn(`Spotify 429 Rate Limit. Waiting ${wait}s...`);
      await new Promise(resolve => setTimeout(resolve, wait * 1000));
      continue;
    }
    return res;
  }
  return fetch(url, options); // last attempt
}

async function spotifyFetch(endpoint, token, params = {}) {
  const url = new URL(`https://api.spotify.com/v1${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetchWithRetry(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Status 404 on ${url.toString()}`);
    throw new Error(`Spotify API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Helper: extract Spotify token from request
function getToken(req) {
  return req.query.token || req.headers.authorization?.replace('Bearer ', '');
}

// ─── Playlists ────────────────────────────────────────────────────────────────
app.get('/playlists', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch('/me/playlists', token, { limit: 50 });
    res.json(data.items?.filter(p => p && p.id) || []);
  } catch (e) {
    console.error('Playlists error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/playlist/:id', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch(`/playlists/${req.params.id}`, token);
    let allItems = data.tracks?.items || [];
    let nextUrl = data.tracks?.next;
    let pagesFetched = 0;

    while (nextUrl && pagesFetched < 20) { // Up to ~2000 tracks
      const nextRes = await fetchWithRetry(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!nextRes.ok) break;
      const nextData = await nextRes.json();
      if (nextData && nextData.items) {
        allItems = allItems.concat(nextData.items);
        nextUrl = nextData.next;
      } else {
        break;
      }
      pagesFetched++;
    }

    const tracks = allItems
      .filter(item => item.track)
      .map(item => ({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists?.map(a => a.name).join(', ') || 'Unknown',
        album: item.track.album?.name || 'Unknown',
        duration_ms: item.track.duration_ms || 0,
        image: item.track.album?.images?.[0]?.url
      }));
    // Return tracks array directly — frontend Home.tsx line 467 does setAllTracks(data)
    res.json(tracks);
  } catch (e) {
    console.error('Playlist error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Albums ───────────────────────────────────────────────────────────────────
app.get('/album/:id', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch(`/albums/${req.params.id}`, token);

    let allTracks = data.tracks?.items || [];
    let nextUrl = data.tracks?.next;
    let pagesFetched = 0;
    while (nextUrl && pagesFetched < 10) {
      const nextRes = await fetchWithRetry(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!nextRes.ok) break;
      const nextData = await nextRes.json();
      if (nextData && nextData.items) {
        allTracks = allTracks.concat(nextData.items);
        nextUrl = nextData.next;
      } else {
        break;
      }
      pagesFetched++;
    }

    const tracks = allTracks.map(t => ({
      id: t.id,
      name: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: data.name,
      duration_ms: t.duration_ms || 0,
      image: data.images?.[0]?.url
    }));
    res.json({ id: data.id, name: data.name, artists: data.artists, images: data.images, tracks });
  } catch (e) {
    console.error('Album error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Saved Albums ─────────────────────────────────────────────────────────────
app.get('/saved-albums', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch('/me/albums', token, { limit: 50 });
    res.json(data.items?.map(i => i.album).filter(a => a && a.id) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Saved Tracks ─────────────────────────────────────────────────────────────
app.get('/saved-tracks', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    let allItems = [];
    let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50';
    let pagesFetched = 0;
    const limitPages = req.query.limit === 'true' ? 1 : 40; // up to 2000 songs or 50

    while (nextUrl && pagesFetched < limitPages) {
      const nextRes = await fetchWithRetry(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!nextRes.ok) break;
      const nextData = await nextRes.json();
      if (nextData && nextData.items) {
        allItems = allItems.concat(nextData.items);
        nextUrl = nextData.next;
      } else {
        break;
      }
      pagesFetched++;
    }

    res.json(allItems.map(item => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: item.track.album?.name || 'Unknown',
      duration_ms: item.track.duration_ms || 0,
      image: item.track.album?.images?.[0]?.url
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Top Tracks ───────────────────────────────────────────────────────────────
app.get('/top-tracks', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch('/me/top/tracks', token, { limit: 50, time_range: 'medium_term' });
    res.json(data.items?.map(t => ({
      id: t.id,
      name: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: t.album?.name || 'Unknown',
      duration_ms: t.duration_ms || 0,
      image: t.album?.images?.[0]?.url
    })) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Top Artists ──────────────────────────────────────────────────────────────
app.get('/top-artists', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch('/me/top/artists', token, { limit: 50, time_range: 'medium_term' });
    res.json(data.items?.filter(a => a && a.id) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Made For You ─────────────────────────────────────────────────────────────
app.get('/made-for-you', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    // featured-playlists is deprecated on Spotify API; return user's playlists instead
    const data = await spotifyFetch('/me/playlists', token, { limit: 20 });
    res.json(data.items?.filter(p => p && p.id) || []);
  } catch (e) {
    res.json([]);
  }
});

// ─── Recommendations ──────────────────────────────────────────────────────────
app.get('/recommendations', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    // Recommendations deprecated, fallback to recent top tracks instead of 404ing
    const topData = await spotifyFetch('/me/top/tracks', token, { limit: 20, time_range: 'short_term' });
    res.json(topData.items?.map(t => ({
      id: t.id,
      name: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || 'Unknown',
      album: t.album?.name || 'Unknown',
      duration_ms: t.duration_ms || 0,
      image: t.album?.images?.[0]?.url
    })) || []);
  } catch (e) {
    res.json([]);
  }
});

// ─── Followed Artists ─────────────────────────────────────────────────────────
app.get('/followed-artists', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const data = await spotifyFetch('/me/following', token, { type: 'artist', limit: 50 });
    res.json(data.artists?.items?.filter(a => a && a.id) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Browse Categories ────────────────────────────────────────────────────────
app.get('/browse-categories', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    // Categories API endpoint deprecated; returning empty to avoid 404 spam
    res.json([]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Artist Details ───────────────────────────────────────────────────────────
app.get('/artist-details', async (req, res) => {
  const token = getToken(req);
  const { artistName } = req.query;
  if (!token) return res.status(401).json({ error: 'Token required' });
  if (!artistName) return res.status(400).json({ error: 'artistName required' });
  try {
    const searchData = await spotifyFetch('/search', token, { q: artistName, type: 'artist', limit: 1 });
    const artist = searchData.artists?.items?.[0];
    if (!artist) return res.json(null);
    res.json(artist);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  YOUTUBE SEARCH & STREAMING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Search ───────────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    res.json(await doSearch(q));
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Also support /search (without /api prefix) for frontend compatibility
app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const results = await doSearch(q);
    // Return in the format frontend expects: array of { id, title, duration, thumbnail, uploader }
    const mapped = results.map(r => ({
      id: r.id,
      title: r.title,
      uploader: r.artist,
      thumbnail: r.thumbnail,
      duration: parseDurationToSeconds(r.duration)
    }));
    res.json(mapped);
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

function parseDurationToSeconds(dur) {
  if (!dur || dur === '?:??') return 0;
  const parts = dur.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

// ─── Trending ─────────────────────────────────────────────────────────────────
app.get('/api/trending', async (req, res) => {
  const picks = ['top hits 2025', 'trending music 2025', 'popular songs 2025'];
  const q = picks[Math.floor(Math.random() * picks.length)];
  try {
    res.json(await doSearch(q));
  } catch (e) {
    console.error('Trending error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Stream (get audio URL for a video ID) ────────────────────────────────────
app.get('/api/stream/:id', async (req, res) => {
  try {
    const streamData = await getAudioStreamUrl(req.params.id);
    res.json(streamData);
  } catch (e) {
    console.error('Stream error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Support /play/:id (what frontend Player.tsx calls)
app.get('/play/:id', async (req, res) => {
  try {
    const streamData = await getAudioStreamUrl(req.params.id);
    res.json(streamData);
  } catch (e) {
    console.error('Play error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Support /stream/:id
app.get('/stream/:id', async (req, res) => {
  try {
    const streamData = await getAudioStreamUrl(req.params.id);
    res.json(streamData);
  } catch (e) {
    console.error('Stream error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Search and Play (search + return first result's stream URL) ──────────────
app.get('/search-and-play', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const results = await doSearch(q);
    if (!results.length) {
      return res.status(404).json({ error: 'No results found' });
    }

    // Try each result until we get a working stream
    for (const result of results.slice(0, 5)) {
      try {
        const streamData = await getAudioStreamUrl(result.id);
        return res.json({
          url: streamData.url,
          id: result.id,
          title: result.title,
          artist: result.artist,
          thumbnail: result.thumbnail,
          duration: parseDurationToSeconds(result.duration)
        });
      } catch {
        continue;
      }
    }

    res.status(500).json({ error: 'Could not get audio stream for any result' });
  } catch (e) {
    console.error('Search-and-play error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Catch-all for SPA (test.html) ───────────────────────────────────────────
app.get('*', (req, res) => {
  // Don't serve test.html for API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Spotify ALT Backend running → http://localhost:${PORT}\n`);
});
