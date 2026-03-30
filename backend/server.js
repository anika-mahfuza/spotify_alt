import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

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

// ─── Spotify GraphQL API Config ───────────────────────────────────────────────
const SPOTIFY_PATHFINDER = 'https://api-partner.spotify.com/pathfinder/v1/query';
const SPOTIFY_PAGE_LIMIT = 100;

// ─── Dynamic Hash Management ──────────────────────────────────────────────────
let cachedHash = '30d415ed189d2699051b60bd0b17ea06467a01bc26d44e8058975e37e9f5fbf6';
let hashExpiresAt = Date.now() + 3600000; // 1 hour

// Try to extract hash from main web-player bundles (not embed)
async function fetchSpotifyHash() {
  console.log('[Hash] Attempting to refresh hash from Spotify...');

  try {
    // Fetch the main web player page to find JS bundle URLs
    const pageRes = await fetch('https://open.spotify.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    if (!pageRes.ok) throw new Error(`Page fetch failed: ${pageRes.status}`);
    const html = await pageRes.text();

    // Find web-player bundle URLs
    const bundleUrls = [...html.matchAll(/src="(https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/[^"]+)"/g)]
      .map(m => m[1]);

    for (const url of bundleUrls) {
      try {
        const bundleRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!bundleRes.ok) continue;
        const js = await bundleRes.text();

        // Look for pattern: "fetchPlaylist","query","HASH" or similar
        const match = js.match(/"fetchPlaylist"[^"]*"query"[^"]*"([a-f0-9]{64})"/);
        if (match) {
          console.log(`[Hash] Extracted new hash: ${match[1]}`);
          return match[1];
        }
      } catch { continue; }
    }
  } catch (e) {
    console.warn('[Hash] Extraction failed:', e.message);
  }

  // Return existing cached hash as fallback
  console.log('[Hash] Using existing cached hash');
  return cachedHash;
}

async function getHash() {
  if (cachedHash && Date.now() < hashExpiresAt) return cachedHash;
  try {
    const newHash = await fetchSpotifyHash();
    if (newHash && newHash !== cachedHash) {
      cachedHash = newHash;
      console.log('[Hash] Hash updated successfully');
    }
    hashExpiresAt = Date.now() + 3600000; // 1 hour
  } catch (e) {
    console.warn('[Hash] Refresh failed, keeping cached hash:', e.message);
    hashExpiresAt = Date.now() + 300000; // retry in 5 min
  }
  return cachedHash;
}

// ─── Simple In-Memory Cache (5 min TTL) ───────────────────────────────────────
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  responseCache.delete(key);
  return null;
}

function setCache(key, data) {
  responseCache.set(key, { data, timestamp: Date.now() });
  if (responseCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now - v.timestamp > CACHE_TTL) responseCache.delete(k);
    }
  }
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Root Route ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Music Player Backend is running', status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  YOUTUBE SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

let YouTube = null;
async function getYT() {
  if (!YouTube) { const mod = await import('youtube-sr'); YouTube = mod.YouTube; }
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
    durationMs: v.duration || 0,
    thumbnail: v.thumbnail?.url || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`
  }));
}

function scoreResult(result, query) {
  const q = query.toLowerCase().replace(/\s+audio$/i, '').trim();
  const title = (result.title || '').toLowerCase();
  const artist = (result.artist || '').toLowerCase();
  let score = 0;
  const qWords = q.split(/\s+/);
  if (title.includes(q)) score += 100;
  for (const word of qWords) {
    if (word.length < 2) continue;
    if (title.includes(word)) score += 10;
    if (artist.includes(word)) score += 5;
  }
  const penalties = ['cover', 'remix', 'live', 'reaction', 'karaoke', 'instrumental', 'tutorial', 'lesson', 'slowed', 'reverb', 'sped up', '8d audio', 'bass boosted'];
  for (const p of penalties) {
    if (title.includes(p) && !q.includes(p)) score -= 25;
  }
  if (result.durationMs > 600000) score -= 15;
  if (result.durationMs > 1800000) score -= 30;
  if (title.includes('official')) score += 8;
  if (title.includes('audio') || title.includes('lyrics')) score += 5;
  return score;
}

async function doSearch(q) {
  const yt = await getYT();
  const safeQ = q.trim().split(/\s+/).length < 2 ? `${q} music` : q;
  let results = await yt.search(safeQ, { limit: 25, type: 'video', safeSearch: false });
  if (!results?.length) results = await yt.search(q, { limit: 25, type: 'video', safeSearch: false });
  return mapResults(results);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIO STREAM EXTRACTION (youtubei.js ANDROID client → Invidious → Piped)
// ═══════════════════════════════════════════════════════════════════════════════

let ytInnertube = null;
async function getInnertube() {
  if (!ytInnertube) {
    const { Innertube } = await import('youtubei.js');
    ytInnertube = await Innertube.create();
  }
  return ytInnertube;
}

async function getAudioStreamUrl(videoId) {
  // 1. youtubei.js with ANDROID client (bypasses cipher, returns direct URLs)
  try {
    const yt = await getInnertube();
    const info = await yt.actions.execute('/player', {
      videoId,
      client: 'ANDROID',
      parse: true
    });

    if (info.streaming_data) {
      const formats = info.streaming_data.adaptive_formats || [];
      // Prefer audio/mp4 (AAC) — better browser compat over proxied streams.
      // Fall back to audio/webm (opus) if no mp4 available.
      const allAudio = formats.filter(f => f.mime_type?.startsWith('audio/'));
      const mp4Audio = allAudio.filter(f => f.mime_type?.includes('mp4'));
      const audioFormats = (mp4Audio.length > 0 ? mp4Audio : allAudio)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (audioFormats.length > 0) {
        const format = audioFormats[0];
        let url = format.url;
        if (!url && format.signature_cipher) {
          url = await format.decipher(yt.session.player);
        }
        if (url) {
          console.log(`Playing via ANDROID client: ${format.mime_type} @ ${format.bitrate}bps`);
          return {
            url: String(url),
            title: info.video_info?.title || '',
            uploader: info.video_info?.author || '',
            thumbnail: info.video_info?.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            duration: info.video_info?.duration || 0,
          };
        }
      }
    }
  } catch (e) {
    console.warn(`youtubei.js IOS failed for ${videoId}:`, e.message);
  }

  // 2. Invidious fallback
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=title,author,lengthSeconds,videoThumbnails,adaptiveFormats`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const audioFormats = (data.adaptiveFormats || [])
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (audioFormats.length > 0) {
        return {
          url: audioFormats[0].url,
          title: data.title || '',
          uploader: data.author || '',
          thumbnail: data.videoThumbnails?.find(t => t.quality === 'medium')?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          duration: data.lengthSeconds || 0
        };
      }
    } catch (e) { console.warn(`Invidious ${base} failed:`, e.message); }
  }

  // 3. Piped fallback
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const sorted = (data.audioStreams || []).filter(s => s.url).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (sorted.length > 0) {
        return {
          url: sorted[0].url,
          title: data.title || '',
          uploader: data.uploader || '',
          thumbnail: data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          duration: data.duration || 0
        };
      }
    } catch { continue; }
  }

  throw new Error('All audio sources failed for ' + videoId);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAYLIST IMPORT (Spotify GraphQL API + SSE)
// ═══════════════════════════════════════════════════════════════════════════════

function msToTime(ms) {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Get anonymous Spotify token from embed page
async function getSpotifyToken(playlistId) {
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch embed page: ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('Could not find __NEXT_DATA__');
  const nextData = JSON.parse(match[1]);
  const token = nextData?.props?.pageProps?.state?.settings?.session?.accessToken;
  if (!token) throw new Error('Could not extract token');
  return token;
}

// Fetch a page of playlist tracks via Spotify GraphQL
async function fetchPlaylistPage(playlistUri, token, offset, isRetry = false) {
  const hash = await getHash();

  const variables = JSON.stringify({
    uri: playlistUri,
    offset,
    limit: SPOTIFY_PAGE_LIMIT,
    enableWatchFeedEntrypoint: false,
    includeRecommendedPlaylistInLikedSongs: false,
    enableSessionData: false,
  });

  const extensions = JSON.stringify({
    persistedQuery: { version: 1, sha256Hash: hash },
  });

  const url = new URL(SPOTIFY_PATHFINDER);
  url.searchParams.set('operationName', 'fetchPlaylist');
  url.searchParams.set('variables', variables);
  url.searchParams.set('extensions', extensions);

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'App-Platform': 'WebPlayer',
    },
  });

  if (!res.ok) {
    const text = await res.text();

    // If hash expired, refresh and retry once
    if (!isRetry && (res.status === 404 || text.includes('PersistedQueryNotFound'))) {
      console.log('[Hash] Hash expired, refreshing...');
      cachedHash = null;
      hashExpiresAt = 0;
      return fetchPlaylistPage(playlistUri, token, offset, true);
    }

    throw new Error(`Spotify API error: ${res.status} ${text}`);
  }

  return res.json();
}

// Parse tracks from GraphQL response
function parseGraphQLTracks(items) {
  return items.map(item => {
    const track = item?.itemV2?.data;
    if (!track) return null;

    const name = track.name || 'Unknown Track';
    const uri = track.uri || '';
    const durationMs = track.trackDuration?.totalMilliseconds || 0;
    const artists = (track.artists?.items || [])
      .map(a => a?.profile?.name)
      .filter(Boolean)
      .join(', ') || 'Unknown Artist';
    const album = track.albumOfTrack?.name || '';
    const image = track.albumOfTrack?.coverArt?.sources?.[0]?.url || '';

    return {
      name,
      artist: artists,
      album,
      image,
      duration: msToTime(durationMs),
      url: uri ? `https://open.spotify.com/track/${uri.split(':').pop()}` : '#'
    };
  }).filter(Boolean);
}

// SSE endpoint for playlist import
app.get('/api/import-playlist', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('spotify.com/playlist/')) {
    return res.status(400).json({ error: 'Please provide a valid Spotify playlist URL.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Extract playlist ID from URL
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!match) throw new Error('Invalid playlist URL');
    const playlistId = match[1];
    const playlistUri = `spotify:playlist:${playlistId}`;

    console.log(`Importing playlist via GraphQL API: ${playlistId}`);

    // Get anonymous token
    const token = await getSpotifyToken(playlistId);

    // Fetch first page
    const firstPage = await fetchPlaylistPage(playlistUri, token, 0);
    const playlistData = firstPage?.data?.playlistV2;

    if (!playlistData) {
      throw new Error('No playlist data returned from Spotify API');
    }

    const playlistName = playlistData.name;
    const totalCount = playlistData?.content?.totalCount || 0;
    const firstItems = playlistData?.content?.items || [];

    // Send metadata
    const meta = {
      name: playlistName,
      description: playlistData.description || '',
      owner: playlistData.ownerV2?.data?.name || '',
      image: playlistData.images?.items?.[0]?.sources?.[0]?.url || '',
      trackCount: totalCount,
    };
    res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`);
    console.log(`Playlist: "${playlistName}" (${totalCount} tracks)`);

    // Parse and send first page tracks
    const firstTracks = parseGraphQLTracks(firstItems);
    res.write(`event: tracks\ndata: ${JSON.stringify(firstTracks)}\n\n`);
    console.log(`Page 1: ${firstTracks.length} tracks`);

    // Paginate if needed
    if (totalCount > SPOTIFY_PAGE_LIMIT) {
      const totalPages = Math.ceil(totalCount / SPOTIFY_PAGE_LIMIT);
      for (let page = 1; page < totalPages; page++) {
        const offset = page * SPOTIFY_PAGE_LIMIT;
        await new Promise(r => setTimeout(r, 300)); // Small delay

        const pageData = await fetchPlaylistPage(playlistUri, token, offset);
        const items = pageData?.data?.playlistV2?.content?.items || [];
        if (items.length === 0) break;

        const tracks = parseGraphQLTracks(items);
        res.write(`event: tracks\ndata: ${JSON.stringify(tracks)}\n\n`);
        console.log(`Page ${page + 1}: ${tracks.length} tracks`);
      }
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();
    console.log(`Import complete: ${playlistName}`);

  } catch (err) {
    console.error('Import error:', err.message);
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  YOUTUBE SEARCH & STREAMING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

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

app.get('/api/best-match', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const cacheKey = `best_match_${q.toLowerCase().trim()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const results = await doSearch(q);
    if (!results.length) return res.status(404).json({ error: 'No results found' });

    const scored = results.map(r => ({ ...r, _score: scoreResult(r, q) }));
    scored.sort((a, b) => b._score - a._score);

    const best = scored[0];
    console.log(`Best match for "${q}": "${best.title}" (score: ${best._score})`);

    const result = {
      id: best.id,
      title: best.title,
      artist: best.artist,
      thumbnail: best.thumbnail,
      candidates: [...new Set(scored.slice(0, 5).map(r => r.id).filter(Boolean))]
    };
    setCache(cacheKey, result);
    res.json(result);
  } catch (e) {
    console.error('Best-match error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const results = await doSearch(q);
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

// ─── Stream endpoints ─────────────────────────────────────────────────────────

app.get('/api/stream/:id', async (req, res) => {
  try {
    const streamData = await getAudioStreamUrl(req.params.id);
    res.json(streamData);
  } catch (e) {
    console.error('Stream error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/play/:id', async (req, res) => {
  try {
    const streamData = await getAudioStreamUrl(req.params.id);
    res.json(streamData);
  } catch (e) {
    console.error('Play error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/stream/:id', async (req, res) => {
  try {
    const streamData = await getAudioStreamUrl(req.params.id);
    res.json(streamData);
  } catch (e) {
    console.error('Stream error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/search-and-play', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const cacheKey = `play_${q.toLowerCase().trim()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const results = await doSearch(q);
    if (!results.length) return res.status(404).json({ error: 'No results found' });

    const scored = results
      .map(r => ({ ...r, _score: scoreResult(r, q) }))
      .sort((a, b) => b._score - a._score);

    for (const r of scored.slice(0, 5)) {
      try {
        const stream = await getAudioStreamUrl(r.id);
        const result = {
          url: stream.url,
          id: r.id,
          title: r.title,
          artist: r.artist,
          thumbnail: r.thumbnail,
          duration: stream.duration || 0
        };
        setCache(cacheKey, result);
        console.log(`Playing: "${r.title}" for query "${q}"`);
        return res.json(result);
      } catch { continue; }
    }

    res.status(500).json({ error: 'Could not stream any result' });
  } catch (e) {
    console.error('Search-and-play error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Proxy Stream (bypasses YouTube IP-lock on CDN URLs) ─────────────────────
// YouTube CDN URLs are signed to the requesting IP. If we return the raw URL to
// the browser, the browser's IP won't match → 403. This endpoint keeps the
// audio flowing through the backend so the IP always matches.
//
// Cache resolved CDN URLs for 4 minutes — browser sends multiple Range requests
// for the same video, we don't want to re-resolve each time.
const proxyUrlCache = new Map();
const PROXY_CACHE_TTL = 4 * 60 * 1000;
const PROXY_CHUNK_SIZE = 1024 * 1024; // 1 MiB chunks avoid googlevideo 403s on open-ended ranges

function getStreamLengthHint(streamData) {
  const hinted = Number(streamData?.contentLength);
  if (Number.isFinite(hinted) && hinted > 0) return hinted;

  try {
    const clen = Number(new URL(streamData?.url).searchParams.get('clen'));
    if (Number.isFinite(clen) && clen > 0) return clen;
  } catch {
    // Ignore malformed URLs and fall back to chunking without a known total.
  }

  return null;
}

function normalizeProxyRange(rangeHeader, totalSize) {
  const totalKnown = Number.isFinite(totalSize) && totalSize > 0;
  const totalEnd = totalKnown ? totalSize - 1 : null;
  const fallbackEnd = totalKnown ? Math.min(PROXY_CHUNK_SIZE - 1, totalEnd) : PROXY_CHUNK_SIZE - 1;

  if (!rangeHeader) {
    return {
      requestRange: `bytes=0-${fallbackEnd}`,
      invalid: false,
    };
  }

  const match = /^bytes=(\d+)-(\d*)$/i.exec(String(rangeHeader).trim());
  if (!match) {
    return {
      requestRange: String(rangeHeader),
      invalid: false,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2];

  if (requestedEnd) {
    let end = Number(requestedEnd);
    if (totalKnown) end = Math.min(end, totalEnd);

    return {
      requestRange: end >= start ? `bytes=${start}-${end}` : null,
      invalid: end < start,
    };
  }

  const end = totalKnown ? Math.min(start + PROXY_CHUNK_SIZE - 1, totalEnd) : start + PROXY_CHUNK_SIZE - 1;
  return {
    requestRange: end >= start ? `bytes=${start}-${end}` : null,
    invalid: end < start,
  };
}

async function fetchProxyUpstream(audioUrl, rangeHeader) {
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity', // prevent gzip so we can pipe raw bytes
    'Connection': 'keep-alive',
  };
  if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

  return fetch(audioUrl, {
    headers: fetchHeaders,
    signal: AbortSignal.timeout(30000),
  });
}

async function resolveStreamUrl(videoId) {
  const cached = proxyUrlCache.get(videoId);
  if (cached && Date.now() - cached.ts < PROXY_CACHE_TTL) return cached.data;
  const data = await getAudioStreamUrl(videoId);
  proxyUrlCache.set(videoId, { data, ts: Date.now() });
  // Trim cache if it grows
  if (proxyUrlCache.size > 100) {
    const cutoff = Date.now() - PROXY_CACHE_TTL;
    for (const [k, v] of proxyUrlCache) if (v.ts < cutoff) proxyUrlCache.delete(k);
  }
  return data;
}

app.get('/api/proxy-stream/:id', async (req, res) => {
  try {
    let streamData = await resolveStreamUrl(req.params.id);
    let audioUrl = streamData.url;
    if (!audioUrl) throw new Error('No audio URL resolved');

    const requestedRange = req.headers['range'];
    const firstRange = normalizeProxyRange(requestedRange, getStreamLengthHint(streamData));
    if (firstRange.invalid || !firstRange.requestRange) {
      const totalSize = getStreamLengthHint(streamData);
      if (totalSize) res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).end();
    }

    const logSuffix = firstRange.requestRange !== requestedRange
      ? ` (upstream ${firstRange.requestRange})`
      : '';
    console.log(`[Proxy] ${req.params.id} → ${requestedRange || 'no-range'}${logSuffix}`);

    let upstream = await fetchProxyUpstream(audioUrl, firstRange.requestRange);

    if (upstream.status === 403 || upstream.status === 410) {
      console.warn(`[Proxy] Upstream ${upstream.status} for ${req.params.id}, refreshing cached URL`);
      proxyUrlCache.delete(req.params.id);

      streamData = await resolveStreamUrl(req.params.id);
      audioUrl = streamData.url;
      if (!audioUrl) throw new Error('No audio URL resolved');

      const retryRange = normalizeProxyRange(requestedRange, getStreamLengthHint(streamData));
      if (retryRange.invalid || !retryRange.requestRange) {
        const totalSize = getStreamLengthHint(streamData);
        if (totalSize) res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      upstream = await fetchProxyUpstream(audioUrl, retryRange.requestRange);
    }

    // Accept 200 and 206 (partial content); anything else is an upstream error
    if (upstream.status !== 200 && upstream.status !== 206) {
      const body = await upstream.text().catch(() => '');
      console.error(`[Proxy] Upstream error ${upstream.status} for ${req.params.id}:`, body.slice(0, 200));
      return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
    }

    // --- Build response headers ---
    const ct = upstream.headers.get('content-type') || 'audio/mp4';
    const cl = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');       // always tell browser we support ranges
    res.setHeader('Content-Type', ct);
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);

    // Pass cache-control so browser can cache chunks
    const cc = upstream.headers.get('cache-control');
    if (cc) res.setHeader('Cache-Control', cc);

    res.status(upstream.status);

    // --- Pipe body ---
    if (!upstream.body) {
      throw new Error('Upstream returned an empty body');
    }

    const reader = upstream.body.getReader();
    let aborted = false;
    req.on('close', () => { aborted = true; reader.cancel().catch(() => {}); });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;
        const ok = res.write(value);
        if (!ok) await new Promise(r => res.once('drain', r));
      }
    } finally {
      res.end();
    }
  } catch (e) {
    console.error('Proxy stream error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`\n  Music Player Backend running → http://127.0.0.1:${PORT}\n`);
});
