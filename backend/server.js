import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const app = express();
const PORT = process.env.PORT || 3001;
const execFileAsync = promisify(execFile);

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
const SPOTIFY_PATHFINDER_V2 = 'https://api-partner.spotify.com/pathfinder/v2/query';
const SPOTIFY_SPCLIENT = 'https://spclient.wg.spotify.com';
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

    // Find web-player bundle URLs (multiple patterns)
    const bundleUrls = new Set();
    for (const match of html.matchAll(/src="(https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/[^"]+)"/g)) {
      bundleUrls.add(match[1]);
    }
    for (const match of html.matchAll(/src="(https:\/\/[^\s"]*\/xpui[^"\s]*\.js)"/g)) {
      bundleUrls.add(match[1]);
    }

    for (const url of bundleUrls) {
      try {
        const bundleRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!bundleRes.ok) continue;
        const js = await bundleRes.text();

        // Look for pattern: "fetchPlaylist","query","HASH" or similar
        let match = js.match(/"fetchPlaylist"[^"]*"query"[^"]*"([a-f0-9]{64})"/);
        if (match) {
          console.log(`[Hash] Extracted new hash: ${match[1]}`);
          return match[1];
        }

        // Also try: operationName:"fetchPlaylist"...sha256Hash:"HASH"
        match = js.match(/["']operationName["']\s*:\s*["']fetchPlaylist["'][^]{0,1000}["']sha256Hash["']\s*:\s*["']([a-f0-9]{64})["']/);
        if (match) {
          console.log(`[Hash] Extracted new hash (pattern 2): ${match[1]}`);
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

function extractSpotifyId(value) {
  if (!value) return null;
  const source = String(value);
  const uriMatch = source.match(/spotify:(?:artist|track|playlist):([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = source.match(/(?:artist|track|playlist)\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  const rawIdMatch = source.match(/^([a-zA-Z0-9]{22})$/);
  return rawIdMatch?.[1] || null;
}

async function fetchSpotifyEmbedState(path) {
  const res = await fetch(`https://open.spotify.com/embed/${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });

  if (!res.ok) {
    throw new Error(`Spotify embed fetch failed: ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) {
    throw new Error('Could not extract Spotify embed data');
  }

  const nextData = JSON.parse(match[1]);
  return nextData?.props?.pageProps?.state?.data || null;
}

async function fetchSpotifyArtistPageHtml(artistId) {
  const cacheKey = `spotify_artist_page_${artistId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://open.spotify.com/artist/${artistId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });

  if (!res.ok) {
    throw new Error(`Spotify artist page fetch failed: ${res.status}`);
  }

  let html = await res.text();
  if (!/\/playlist\/[A-Za-z0-9]{22}/.test(html)) {
    const fallbackScript = `
      (async () => {
        const artistId = process.argv[1];
        const response = await fetch(\`https://r.jina.ai/http://https://open.spotify.com/artist/\${artistId}\`, {
          headers: { Accept: 'text/plain' }
        });
        const text = await response.text();
        process.stdout.write(text);
      })().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      });
    `;
    const { stdout: fallbackHtml } = await execFileAsync(process.execPath, ['-e', fallbackScript, artistId], {
      maxBuffer: 2 * 1024 * 1024,
    });
    if (/playlist\/[A-Za-z0-9]{22}/.test(fallbackHtml)) {
      html = fallbackHtml;
    }
  }

  setCache(cacheKey, html);
  return html;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSpotifyPlaylistCardDetails(playlistId) {
  const cacheKey = `spotify_playlist_card_${playlistId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const playlistData = await fetchSpotifyEmbedState(`playlist/${playlistId}`);
    const entity = playlistData?.entity;
    if (!entity || entity.type !== 'playlist') return null;

    const images = (entity.visualIdentity?.image || [])
      .map(image => image?.url)
      .filter(Boolean);

    const details = {
      name: entity.title || entity.name || undefined,
      image: images[0] || undefined,
    };

    setCache(cacheKey, details);
    return details;
  } catch {
    return null;
  }
}

async function parseArtistPagePlaylists(html) {
  const source = String(html || '');
  const anchorMatches = [...source.matchAll(/<a[^>]+href="\/playlist\/([A-Za-z0-9]{22})"[^>]*>([\s\S]{0,4000}?)<\/a>/g)];
  const markdownMatches = anchorMatches.length
    ? []
    : [...source.matchAll(/\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})\)/g)];
  const seen = new Set();
  const playlists = [];

  for (const match of anchorMatches) {
    const playlistId = match[1];
    if (!playlistId || seen.has(playlistId)) continue;
    seen.add(playlistId);

    const anchorHtml = match[2] || '';
    const spanTexts = [...anchorHtml.matchAll(/<span[^>]*>([^<]+)<\/span>/g)]
      .map(spanMatch => decodeHtmlEntities(spanMatch[1]))
      .filter(Boolean);
    const imageMatch = anchorHtml.match(/<img[^>]+src="([^"]+)"/i);

    playlists.push({
      id: playlistId,
      name: spanTexts[0] || '',
      image: imageMatch?.[1] || undefined,
      spotifyUrl: `https://open.spotify.com/playlist/${playlistId}`,
    });

    if (playlists.length >= 6) break;
  }

  for (const match of markdownMatches) {
    const playlistId = match[2];
    if (!playlistId || seen.has(playlistId)) continue;
    seen.add(playlistId);

    playlists.push({
      id: playlistId,
      name: decodeHtmlEntities(match[1]) || '',
      image: undefined,
      spotifyUrl: `https://open.spotify.com/playlist/${playlistId}`,
    });

    if (playlists.length >= 6) break;
  }

  return Promise.all(playlists.map(async playlist => {
    if (playlist.name && playlist.image) return playlist;

    const details = await fetchSpotifyPlaylistCardDetails(playlist.id);
    return {
      ...playlist,
      name: playlist.name || details?.name || 'Spotify Playlist',
      image: playlist.image || details?.image || undefined,
    };
  }));
}

async function resolveArtistId({ artistId, trackId }) {
  const directArtistId = extractSpotifyId(artistId);
  if (directArtistId) return directArtistId;

  const normalizedTrackId = extractSpotifyId(trackId);
  if (!normalizedTrackId) return null;

  const trackData = await fetchSpotifyEmbedState(`track/${normalizedTrackId}`);
  const entity = trackData?.entity;
  return extractSpotifyId(entity?.relatedEntityUri) || extractSpotifyId(entity?.artists?.[0]?.uri) || null;
}

function parseArtistEmbedDetails(entity) {
  if (!entity || entity.type !== 'artist') return null;

  const artistId = extractSpotifyId(entity.uri) || entity.id;
  const images = (entity.visualIdentity?.image || []).map(image => ({
    url: image?.url,
    width: image?.maxWidth,
    height: image?.maxHeight,
  })).filter(image => image.url);

  const topTracks = (entity.trackList || []).slice(0, 5).map(track => ({
    id: extractSpotifyId(track?.uri) || track?.uid || track?.title || '',
    name: track?.title || 'Unknown Track',
    artist: track?.subtitle || undefined,
    duration_ms: typeof track?.duration === 'number' ? track.duration : undefined,
    previewUrl: track?.audioPreview?.url || undefined,
  })).filter(track => track.id && track.name);

  return {
    id: artistId,
    name: entity.name || entity.title || 'Unknown Artist',
    subtitle: entity.subtitle || undefined,
    images,
    externalUrl: artistId ? `https://open.spotify.com/artist/${artistId}` : undefined,
    topTracks,
  };
}

function parseTrackEmbedDetails(entity) {
  if (!entity || entity.type !== 'track') return null;

  const trackId = extractSpotifyId(entity.uri) || entity.id;
  const artistIds = (entity.artists || []).map(artist => extractSpotifyId(artist?.uri)).filter(Boolean);
  const images = (entity.visualIdentity?.image || []).map(image => ({
    url: image?.url,
    width: image?.maxWidth,
    height: image?.maxHeight,
  })).filter(image => image.url);

  return {
    name: entity.title || undefined,
    id: trackId,
    artist: (entity.artists || []).map(artist => artist?.name).filter(Boolean).join(', ') || undefined,
    artistId: artistIds[0] || undefined,
    artistIds,
    image: images[0]?.url || undefined,
    duration_ms: typeof entity.duration === 'number' ? entity.duration : undefined,
    previewUrl: entity.audioPreview?.url || undefined,
  };
}

function shouldNormalizeImportedTrack(track) {
  if (!track?.spotifyTrackId) return false;
  if (!track.artist) return true;
  return /[^\u0000-\u007f]/.test(track.artist);
}

async function enrichImportedTrackWithEmbedDetails(track) {
  if (!shouldNormalizeImportedTrack(track)) return track;

  const trackId = extractSpotifyId(track.spotifyTrackId || track.url);
  if (!trackId) return track;

  const cacheKey = `imported_track_embed_${trackId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return {
      ...track,
      ...cached,
    };
  }

  try {
    const trackData = await fetchSpotifyEmbedState(`track/${trackId}`);
    const details = parseTrackEmbedDetails(trackData?.entity);
    if (!details) return track;

    const normalizedTrack = {
      name: details.name || track.name,
      artist: details.artist || track.artist,
      artistId: details.artistId || track.artistId,
      artistIds: details.artistIds?.length ? details.artistIds : track.artistIds,
      image: details.image || track.image,
      duration: details.duration_ms ? msToTime(details.duration_ms) : track.duration,
      spotifyTrackId: trackId,
      url: `https://open.spotify.com/track/${trackId}`,
    };

    setCache(cacheKey, normalizedTrack);
    return {
      ...track,
      ...normalizedTrack,
    };
  } catch (error) {
    console.warn(`[Import] Track embed normalization failed for ${trackId}:`, error.message);
    return track;
  }
}

async function enrichImportedTracks(tracks) {
  const enriched = [];
  const batchSize = 8;

  for (let index = 0; index < tracks.length; index += batchSize) {
    const batch = tracks.slice(index, index + batchSize);
    const normalizedBatch = await Promise.all(batch.map(enrichImportedTrackWithEmbedDetails));
    enriched.push(...normalizedBatch);
  }

  return enriched;
}

async function enrichArtistTopTrack(track) {
  const trackId = extractSpotifyId(track?.id);
  if (!trackId) return track;

  const cacheKey = `spotify_track_embed_${trackId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return {
      ...track,
      ...cached,
      id: trackId,
    };
  }

  try {
    const trackData = await fetchSpotifyEmbedState(`track/${trackId}`);
    const details = parseTrackEmbedDetails(trackData?.entity);
    if (!details) return track;

    const cachedTrack = {
      artist: details.artist || track.artist,
      artistId: details.artistId,
      artistIds: details.artistIds,
      image: details.image,
      duration_ms: details.duration_ms || track.duration_ms,
      previewUrl: details.previewUrl || track.previewUrl,
    };

    setCache(cacheKey, cachedTrack);

    return {
      ...track,
      ...cachedTrack,
      id: trackId,
    };
  } catch {
    return track;
  }
}

function normalizeArtistLookup(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function fetchWikipediaArtistBio(artistName) {
  const normalizedArtistName = normalizeArtistLookup(artistName);
  if (!normalizedArtistName) return null;

  const searchTerms = [
    `"${artistName}" musician`,
    `"${artistName}" singer`,
    `"${artistName}" band`,
    artistName,
  ];

  const seenTitles = new Set();
  const candidates = [];

  for (const term of searchTerms) {
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', term);
    searchUrl.searchParams.set('srlimit', '5');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    try {
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'spotify-alt/1.0 (+https://open.spotify.com)' },
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const result of data?.query?.search || []) {
        const title = result?.title;
        if (!title || seenTitles.has(title)) continue;
        seenTitles.add(title);
        candidates.push(title);
      }
    } catch {
      continue;
    }

    if (candidates.length >= 5) break;
  }

  let bestMatch = null;

  for (const title of candidates) {
    try {
      const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': 'spotify-alt/1.0 (+https://open.spotify.com)' },
      });
      if (!summaryRes.ok) continue;

      const summary = await summaryRes.json();
      if (summary?.type !== 'standard' || !summary?.extract) continue;

      const normalizedTitle = normalizeArtistLookup(summary.title || title);
      const description = String(summary.description || '');
      const descriptionScore = /\b(?:singer|songwriter|rapper|musician|band|producer|dj|composer|violinist|artist)\b/i.test(description) ? 25 : 0;
      const exactTitleScore = normalizedTitle === normalizedArtistName ? 100 : 0;
      const containsNameScore = normalizedTitle.includes(normalizedArtistName) || normalizedArtistName.includes(normalizedTitle) ? 40 : 0;
      const score = exactTitleScore + containsNameScore + descriptionScore;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          score,
          bio: summary.extract,
          bioUrl: summary?.content_urls?.desktop?.page || undefined,
        };
      }
    } catch {
      continue;
    }
  }

  if (!bestMatch || bestMatch.score < 40) return null;

  return {
    bio: bestMatch.bio,
    bioUrl: bestMatch.bioUrl,
  };
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Root Route ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Music Player Backend is running', status: 'ok', service: 'music-player-backend' });
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

function normalizeSongQuery(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/\b(?:feat\.?|ft\.?|featuring)\b[^,|/&-]*/gi, ' ')
    .replace(/\b(?:official|lyrics?|audio|video|visualizer|remaster(?:ed)?|clean|explicit)\b/gi, ' ')
    .replace(/[^\w\s&'/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeVariantSurface(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s&'/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getPrimaryArtistQuery(value) {
  const normalized = normalizeSongQuery(value);
  return normalized
    .split(/\s*(?:,|&|\/|\||;|\bx\b|\band\b)\s*/i)
    .map(part => part.trim())
    .find(Boolean) || normalized;
}

function stripVariantTerms(value) {
  return normalizeVariantSurface(value)
    .replace(/\b(?:nightcore|slowed|reverb|sped up|sped|speed up|remix|live|cover|karaoke|instrumental|acoustic|edit|version|ver|8d audio|bass boosted|mashup|fan made)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSongSearchQueries(query, context = {}) {
  const raw = String(query || '').trim();
  const normalized = normalizeSongQuery(raw) || raw.toLowerCase();
  const title = normalizeSongQuery(context.title);
  const artist = normalizeSongQuery(context.artist);
  const primaryArtist = getPrimaryArtistQuery(context.artist);
  const structured = [title, artist].filter(Boolean).join(' ').trim();
  const focused = structured || normalized;
  const queries = [];
  const seen = new Set();

  const addQuery = (value) => {
    const next = String(value || '').trim();
    const key = next.toLowerCase();
    if (!next || seen.has(key)) return;
    seen.add(key);
    queries.push(next);
  };

  addQuery(raw);
  addQuery(normalized);
  addQuery(structured);
  addQuery(`${focused} song`);
  addQuery(`${focused} music`);
  addQuery([title, primaryArtist].filter(Boolean).join(' '));

  if (raw.split(/\s+/).filter(Boolean).length < 2) {
    addQuery(`${raw} music`);
  }

  return queries;
}

function scoreResult(result, query, context = {}) {
  const q = normalizeSongQuery(query);
  const qTitle = normalizeSongQuery(context.title) || q;
  const qArtist = normalizeSongQuery(context.artist);
  const title = normalizeSongQuery(result.title || '');
  const artist = normalizeSongQuery(result.artist || '');
  const variantTitle = normalizeVariantSurface(result.title || '');
  const variantArtist = normalizeVariantSurface(result.artist || '');
  const strippedTitle = stripVariantTerms(result.title || '');
  const queryText = [
    normalizeVariantSurface(query),
    normalizeVariantSurface(context.title),
    normalizeVariantSurface(context.artist),
  ].filter(Boolean).join(' ');
  let score = 0;
  const titleWords = qTitle.split(/\s+/).filter(Boolean);
  const artistWords = qArtist.split(/\s+/).filter(Boolean);

  if (qTitle && title === qTitle) score += 180;
  if (qTitle && title.includes(qTitle)) score += 120;
  if (q && `${artist} ${title}`.includes(q)) score += 20;

  let matchedTitleWords = 0;
  for (const word of titleWords) {
    if (word.length < 2) continue;
    if (title.includes(word)) {
      score += 18;
      matchedTitleWords += 1;
    }
  }
  if (titleWords.length > 0 && titleWords.every(word => title.includes(word) || artist.includes(word))) {
    score += 50;
  }
  if (matchedTitleWords >= Math.max(2, titleWords.length)) {
    score += 20;
  }

  let matchedArtistWords = 0;
  for (const word of artistWords) {
    if (word.length < 2) continue;
    if (artist.includes(word)) {
      score += 24;
      matchedArtistWords += 1;
    } else if (title.includes(word)) {
      score += 4;
    }
  }
  if (artistWords.length > 0 && matchedArtistWords === artistWords.length) {
    score += 55;
  } else if (artistWords.length > 0 && matchedArtistWords === 0) {
    score -= 30;
  }

  const heavyPenalties = [
    'nightcore',
    'slowed',
    'reverb',
    'sped up',
    'speed up',
    'sped',
    'edit',
    'shorts',
    'snippet',
    'capcut',
    'tiktok',
    'mashup',
    'amv'
  ];
  const mediumPenalties = [
    'cover',
    'remix',
    'live',
    'reaction',
    'karaoke',
    'instrumental',
    'tutorial',
    'lesson',
    '8d audio',
    'bass boosted',
    'fan made'
  ];
  for (const p of heavyPenalties) {
    if ((variantTitle.includes(p) || variantArtist.includes(p)) && !queryText.includes(p)) score -= 140;
  }
  for (const p of mediumPenalties) {
    if ((variantTitle.includes(p) || variantArtist.includes(p)) && !queryText.includes(p)) score -= 70;
  }

  if (qTitle && strippedTitle === qTitle && strippedTitle !== variantTitle && !queryText.includes('slowed') && !queryText.includes('reverb') && !queryText.includes('sped') && !queryText.includes('speed up') && !queryText.includes('nightcore') && !queryText.includes('remix') && !queryText.includes('live') && !queryText.includes('cover')) {
    score -= 160;
  }

  const durationMs = Number(result.durationMs) || 0;
  if (durationMs > 0) {
    if (durationMs < 60000) score -= 100;
    else if (durationMs < 120000) score -= 60;
    else if (durationMs <= 8 * 60 * 1000) score += 12;
    else if (durationMs > 12 * 60 * 1000) score -= 20;
    else if (durationMs > 30 * 60 * 1000) score -= 50;
  }

  if (title.includes('official audio')) score += 30;
  else if (title.includes('official video')) score += 24;
  else if (title.includes('official')) score += 14;

  if (title.includes('provided to youtube')) score += 28;
  if (title.includes('lyric video')) score += 10;
  if (title.includes('lyrics')) score += 6;
  if (artist.includes('topic')) score += 20;
  if (artist.includes('vevo')) score += 16;

  // Precise duration match against Spotify's known duration
  const spotifyDurationMs = Number(context.durationMs) || 0;
  if (spotifyDurationMs > 0 && durationMs > 0) {
    const diffSec = Math.abs(durationMs - spotifyDurationMs) / 1000;
    if (diffSec <= 2)       score += 80;
    else if (diffSec <= 8)  score += 45;
    else if (diffSec <= 20) score += 15;
    else if (diffSec > 60)  score -= 100;
  }

  return score;
}

async function doSearch(q, context = {}) {
  const yt = await getYT();
  const searchQueries = buildSongSearchQueries(q, context);
  const merged = new Map();

  for (const [index, searchQuery] of searchQueries.entries()) {
    try {
      const results = await yt.search(searchQuery, { limit: 12, type: 'video', safeSearch: false });
      const mapped = mapResults(results);
      const sourceBoost = Math.max(0, 10 - index * 2);

      for (const result of mapped) {
        const mergedScore = scoreResult(result, q, context) + sourceBoost;
        const existing = merged.get(result.id);
        if (!existing || mergedScore > existing._score) {
          merged.set(result.id, { ...result, _score: mergedScore });
        }
      }
    } catch (e) {
      console.warn(`[Search] Query failed for "${searchQuery}":`, e.message);
    }
  }

  return [...merged.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, 25)
    .map(({ _score, ...result }) => result);
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
    const artistItems = (track.artists?.items || []).map(artist => ({
      name: artist?.profile?.name || null,
      id: extractSpotifyId(artist?.uri),
    })).filter(artist => artist.name);
    const artists = artistItems
      .map(artist => artist.name)
      .filter(Boolean)
      .join(', ') || 'Unknown Artist';
    const album = track.albumOfTrack?.name || '';
    const image = track.albumOfTrack?.coverArt?.sources?.[0]?.url || '';
    const spotifyTrackId = extractSpotifyId(uri);

    return {
      name,
      artist: artists,
      album,
      image,
      duration: msToTime(durationMs),
      durationMs: durationMs,
      url: spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : '#',
      artistId: artistItems[0]?.id || undefined,
      artistIds: artistItems.map(artist => artist.id).filter(Boolean),
      spotifyTrackId: spotifyTrackId || undefined,
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
    const firstTracks = await enrichImportedTracks(parseGraphQLTracks(firstItems));
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

        const tracks = await enrichImportedTracks(parseGraphQLTracks(items));
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

// ═══════════════════════════════════════════════════════════════════════════════
//  SPOTIFY DATA ENDPOINTS (Artist, Playlist, Track)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: Get anonymous token from embed page ──────────────────────────────
async function getAnonymousSpotifyToken() {
  const cacheKey = 'spotify_anon_token';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('Could not extract __NEXT_DATA__');
  const nextData = JSON.parse(match[1]);
  const token = nextData?.props?.pageProps?.state?.settings?.session?.accessToken;
  if (!token) throw new Error('Could not extract accessToken');
  setCache(cacheKey, token);
  return token;
}

// ─── Playlist Extender (Spotify's native recommendation API) ──────────────────
// Returns scored, related tracks for a playlist context. This is what the
// official desktop app uses to show "related songs" when playing a track.
// Far better than scraping artist pages — returns tracks ranked by relevance.
async function fetchPlaylistExtender(playlistUri, numResults = 20, trackSkipIds = []) {
  const cacheKey = `playlist_extender_${playlistUri}_${numResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const token = await getAnonymousSpotifyToken();
    const body = JSON.stringify({
      playlistURI: playlistUri,
      trackSkipIDs: trackSkipIds,
      numResults: numResults,
    });

    const res = await fetch(`${SPOTIFY_SPCLIENT}/playlistextender/extendp/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'App-Platform': 'WebPlayer',
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Playlist extender failed: ${res.status}`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Response might be base64-encoded
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      data = JSON.parse(decoded);
    }

    const tracks = (data.recommendedTracks || []).map(t => ({
      id: t.originalId ? extractSpotifyId(t.originalId) : t.id,
      name: t.name || 'Unknown',
      artist: t.artists?.map(a => a.name).join(', ') || 'Unknown',
      artistIds: t.artists?.map(a => a.id).filter(Boolean) || [],
      album: t.album?.name || 'Unknown',
      image: t.album?.largeImageUrl || t.album?.imageUrl || undefined,
      duration_ms: t.duration || 0,
      popularity: t.popularity || 0,
      explicit: t.explicit || false,
      score: t.score || 0,
      spotifyUrl: t.originalId ? `https://open.spotify.com/${t.originalId.replace('spotify:', '').replace(':', '/')}` : undefined,
    }));

    setCache(cacheKey, tracks);
    return tracks;
  } catch (e) {
    console.warn('[Extender] Failed:', e.message);
    return [];
  }
}

// ─── Track Metadata API (fast structured JSON) ────────────────────────────────
// Uses spclient.wg.spotify.com/metadata/4/track/{gid} for faster track details
// instead of scraping embed pages. Returns GID-based data directly.
async function fetchTrackMetadata(trackGid) {
  const cacheKey = `track_metadata_${trackGid}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const token = await getAnonymousSpotifyToken();
    const res = await fetch(`${SPOTIFY_SPCLIENT}/metadata/4/track/${trackGid}?market=from_token`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'App-Platform': 'WebPlayer',
      }
    });

    if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
    const data = await res.json();

    const result = {
      gid: data.gid,
      name: data.name,
      artist: data.artist?.[0]?.name,
      artistIds: data.artist?.map(a => a.gid).filter(Boolean) || [],
      album: data.album?.name,
      albumId: data.album?.gid,
      image: data.album?.cover_group?.image?.find(i => i.size === 'LARGE')?.file_id
        ? `https://i.scdn.co/image/ab67616d0000b273${data.album.cover_group.image.find(i => i.size === 'LARGE').file_id.replace('ab67616d0000b273', '')}`
        : undefined,
      duration_ms: data.duration,
      popularity: data.popularity,
      explicit: data.explicit || false,
      has_lyrics: data.has_lyrics,
      canonical_uri: data.canonical_uri,
      isrc: data.external_id?.find(e => e.type === 'isrc')?.id,
    };

    // Fix image URL: file_id already includes the prefix
    if (data.album?.cover_group?.image) {
      const largeImg = data.album.cover_group.image.find(i => i.size === 'LARGE');
      if (largeImg?.file_id) {
        result.image = `https://i.scdn.co/image/${largeImg.file_id}`;
      }
    }

    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('[Metadata] Failed:', e.message);
    return null;
  }
}

// ─── GraphQL v2 Helper ────────────────────────────────────────────────────────
async function fetchGraphQLV2(operationName, variables) {
  try {
    const token = await getAnonymousSpotifyToken();
    const hash = await getHash();

    const body = {
      operationName,
      variables,
      extensions: {
        persistedQuery: { version: 1, sha256Hash: hash }
      }
    };

    const res = await fetch(SPOTIFY_PATHFINDER_V2, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'App-Platform': 'WebPlayer',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[GraphQL v2] Failed:', e.message);
    return null;
  }
}

app.get('/api/artist-details', async (req, res) => {
  const { artistId, trackId } = req.query;
  if (!artistId && !trackId) {
    return res.status(400).json({ error: 'artistId or trackId is required' });
  }

  try {
    const cacheKey = `artist_details_${String(artistId || '')}_${String(trackId || '')}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const resolvedArtistId = await resolveArtistId({ artistId, trackId });
    if (!resolvedArtistId) {
      return res.status(404).json({ error: 'Artist could not be resolved' });
    }

    const artistData = await fetchSpotifyEmbedState(`artist/${resolvedArtistId}`);
    const artistDetails = parseArtistEmbedDetails(artistData?.entity);
    if (!artistDetails) {
      return res.status(404).json({ error: 'Artist details unavailable' });
    }

    let enrichedArtistDetails = artistDetails;

    if (artistDetails.topTracks?.length) {
      const topTracks = await Promise.all(artistDetails.topTracks.map(enrichArtistTopTrack));
      enrichedArtistDetails = {
        ...enrichedArtistDetails,
        topTracks,
      };
    }

    const wikipediaBio = await fetchWikipediaArtistBio(enrichedArtistDetails.name).catch(() => null);
    if (wikipediaBio) {
      enrichedArtistDetails = {
        ...enrichedArtistDetails,
        bio: wikipediaBio.bio,
        bioUrl: wikipediaBio.bioUrl,
      };
    }

    setCache(cacheKey, enrichedArtistDetails);
    res.json(enrichedArtistDetails);
  } catch (e) {
    console.error('Artist details error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/artist-playlists', async (req, res) => {
  const { artistId, trackId } = req.query;
  if (!artistId && !trackId) {
    return res.status(400).json({ error: 'artistId or trackId is required' });
  }

  try {
    const resolvedArtistId = await resolveArtistId({ artistId, trackId });
    if (!resolvedArtistId) {
      return res.json([]);
    }

    const cacheKey = `artist_playlists_${resolvedArtistId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const html = await fetchSpotifyArtistPageHtml(resolvedArtistId);
    const playlists = await parseArtistPagePlaylists(html);

    setCache(cacheKey, playlists);
    res.json(playlists);
  } catch (error) {
    console.warn('Artist playlists fetch failed:', error.message);
    res.json([]);
  }
});

app.get('/api/track-details', async (req, res) => {
  const normalizedTrackId = extractSpotifyId(req.query.trackId);
  if (!normalizedTrackId) {
    return res.status(400).json({ error: 'trackId is required' });
  }

  try {
    const cacheKey = `track_details_${normalizedTrackId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // Try metadata API first (faster, structured JSON)
    // We need the GID, so try embed page first to get it
    const trackData = await fetchSpotifyEmbedState(`track/${normalizedTrackId}`);
    const details = parseTrackEmbedDetails(trackData?.entity);
    if (!details) {
      return res.status(404).json({ error: 'Track details unavailable' });
    }

    const result = {
      ...details,
      spotifyUrl: `https://open.spotify.com/track/${normalizedTrackId}`,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Track details error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

  app.get('/api/search', async (req, res) => {
  const { q, title, artist } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    res.json(await doSearch(q, { title, artist }));
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/best-match', async (req, res) => {
  const { q, title, artist, durationMs } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const cacheKey = `best_match_${String(q).toLowerCase().trim()}__${normalizeSongQuery(title)}__${normalizeSongQuery(artist)}__${durationMs || ''}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const searchContext = { title, artist, durationMs };
    const results = await doSearch(q, searchContext);
    if (!results.length) return res.status(404).json({ error: 'No results found' });

    const scored = results.map(r => ({ ...r, _score: scoreResult(r, q, searchContext) }));
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
  const { q, title, artist } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const results = await doSearch(q, { title, artist });
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

app.listen(PORT, '0.0.0.0',() => {
  console.log(`\n  Music Player Backend running → http://127.0.0.1:${PORT}\n`);
});
