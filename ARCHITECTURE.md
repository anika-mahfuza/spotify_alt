# Spotify Alt — Full Architecture & Playback Mechanism Deep Dive

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Spotify Playlist Import (The Core Data Pipeline)](#spotify-playlist-import)
4. [The Hash Extraction Mechanism](#hash-extraction)
5. [The Token Extraction Mechanism](#token-extraction)
6. [GraphQL Playlist Fetching](#graphql-playlist-fetching)
7. [Artist Page Scraping](#artist-page-scraping)
8. [Embed Page Scraping (__NEXT_DATA__)](#embed-page-scraping)
9. [How Songs Are Resolved for Playback](#song-resolution)
10. [YouTube Search & Scoring Engine](#youtube-search-scoring)
11. [Audio Stream Extraction (3-Tier Fallback)](#audio-stream-extraction)
12. [Stream Proxy (Bypassing YouTube IP Lock)](#stream-proxy)
13. [Frontend Player (YouTube IFrame API)](#frontend-player)
14. [Queue Management & Navigation](#queue-management)
15. [Data Flow Summary](#data-flow-summary)

---

## Overview

This app is a **Spotify playlist importer + YouTube audio player**. It does NOT use the official Spotify Web API or require any OAuth login. Instead, it:

1. **Scrapes Spotify anonymously** to import playlist metadata (names, artists, album art, Spotify IDs)
2. **Resolves each Spotify track to a YouTube video** via a sophisticated search + scoring engine
3. **Plays audio through a hidden YouTube IFrame player** in the browser
4. **Proxies YouTube audio streams** through the backend to bypass IP-locked CDN URLs

The key insight: Spotify's embed pages (`open.spotify.com/embed/...`) hand out anonymous access tokens, and Spotify's GraphQL API (`api-partner.spotify.com/pathfinder/v1/query`) accepts those tokens with a SHA-256 persisted query hash.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + TypeScript)                       │
│                                                             │
│  App.tsx ─── Main state: currentTrack, queue, currentIndex  │
│  Player.tsx ─── YouTube IFrame API wrapper                  │
│  Home.tsx ─── Playlist display, track lists                 │
│  ImportPlaylist.tsx ─── URL input, SSE listener             │
│  SearchBar.tsx ─── YouTube search UI                        │
│  ResultList.tsx ─── Search results display                  │
│  colorExtractor.ts ─── Album art color extraction           │
│                                                             │
│  State stored in localStorage (playlists, queue, position)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / SSE
┌──────────────────────────▼──────────────────────────────────┐
│  BACKEND (Express + Node.js)                                │
│                                                             │
│  /api/import-playlist  ─── SSE endpoint                     │
│     1. Scrape embed page → get accessToken                  │
│     2. Extract SHA-256 hash from web-player bundles         │
│     3. Call Spotify GraphQL API (fetchPlaylist)             │
│     4. Parse tracks, stream as SSE events                   │
│                                                             │
│  /api/search  ─── YouTube search (youtube-sr lib)           │
│  /api/best-match  ─── Best YouTube match with scoring       │
│  /api/stream/:id  ─── Get audio stream URL                  │
│  /api/proxy-stream/:id ─── Proxy YouTube audio bytes        │
│  /api/artist-details  ─── Scrape artist embed page          │
│  /api/artist-playlists  ─── Scrape artist HTML page         │
│  /api/track-details  ─── Scrape track embed page            │
│                                                             │
│  Audio sources (3-tier fallback):                           │
│    1. youtubei.js (ANDROID client)                          │
│    2. Invidious instances                                   │
│    3. Piped instances                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Spotify Playlist Import

### Entry Point

User pastes a Spotify playlist URL into `ImportPlaylist.tsx`. The frontend calls `importOrReuseSpotifyPlaylist()` in `spotifyPlaylistImport.ts`, which opens an **SSE (Server-Sent Events)** connection to:

```
GET /api/import-playlist?url=https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
```

### Backend Processing (`server.js` lines 1010-1086)

The backend processes the import in this sequence:

1. **Extract playlist ID** from URL via regex: `/playlist\/([a-zA-Z0-9]+)/`
2. **Get anonymous access token** by scraping the embed page
3. **Get the SHA-256 persisted query hash** (cached, refreshed hourly)
4. **Fetch first page** of tracks via GraphQL
5. **Send `meta` SSE event** with playlist name, description, owner, image, trackCount
6. **Parse and send `tracks` SSE event** with the first batch
7. **Paginate** through remaining pages (100 tracks per page)
8. **Send `done` SSE event** when complete

### Frontend SSE Handling (`spotifyPlaylistImport.ts`)

```javascript
const sse = new EventSource(`${apiUrl}/api/import-playlist?url=${encodedUrl}`);

sse.addEventListener('meta', event => {
  meta = JSON.parse(eventData.data);  // { name, description, owner, image, trackCount }
});

sse.addEventListener('tracks', event => {
  const nextTracks = JSON.parse(eventData.data);
  allTracks.push(...nextTracks);
});

sse.addEventListener('done', () => {
  // Store in localStorage as ImportedPlaylist
  window.localStorage.setItem('imported_playlists', JSON.stringify(updatedPlaylists));
  window.dispatchEvent(new CustomEvent('playlist-imported', { detail: playlist }));
});
```

### Storage

Imported playlists are stored in `localStorage` under the key `imported_playlists` as a JSON array. Each playlist has:

```typescript
interface ImportedPlaylist {
  id: string;              // "imported-{spotifyPlaylistId}"
  name: string;
  description?: string;
  owner?: string;
  image?: string;
  trackCount: number;
  tracks: ImportedTrack[];
  sourceUrl: string;       // Original Spotify URL
  importedAt: number;      // Timestamp
}

interface ImportedTrack {
  name: string;
  artist: string;
  album: string;
  image: string;
  duration: string;        // "M:SS" format
  url: string;             // Spotify track URL
  artistId?: string;       // Spotify artist ID
  artistIds?: string[];    // All Spotify artist IDs
  spotifyTrackId?: string; // Spotify track ID (22-char base62)
}
```

---

## The Hash Extraction

### What Is the Hash?

Spotify's GraphQL API uses **persisted queries**. Instead of sending the full GraphQL query string, the client sends a SHA-256 hash that Spotify's server maps to a pre-registered query. The hash for `fetchPlaylist` is a 64-character hex string.

### How It's Extracted (`server.js` lines 32-90)

```javascript
let cachedHash = '30d415ed189d2699051b60bd0b17ea06467a01bc26d44e8058975e37e9f5fbf6';
let hashExpiresAt = Date.now() + 3600000; // 1 hour
```

**Step 1:** Fetch `https://open.spotify.com/` (the main web player page)

**Step 2:** Extract JavaScript bundle URLs from the HTML:
```javascript
const bundleUrls = [...html.matchAll(/src="(https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/[^"]+)"/g)]
  .map(m => m[1]);
```

**Step 3:** Fetch each JS bundle and search for the hash pattern:
```javascript
const match = js.match(/"fetchPlaylist"[^"]*"query"[^"]*"([a-f0-9]{64})"/);
```

This pattern looks for the literal string `"fetchPlaylist"` followed eventually by `"query"` followed by a 64-character hex string — which is the SHA-256 hash.

**Step 4:** Cache the hash for 1 hour. If a GraphQL request returns 404 or `PersistedQueryNotFound`, the hash is cleared and re-fetched, then the request is retried once.

### Why This Works

Spotify's web player bundles contain the persisted query hashes inline. By scraping the bundles, we get the same hash the official Spotify web player uses — no API key needed.

---

## The Token Extraction

### How Anonymous Tokens Are Obtained (`server.js` lines 908-924)

```javascript
async function getSpotifyToken(playlistId) {
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ...',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  const html = await res.text();

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  const nextData = JSON.parse(match[1]);

  // The anonymous access token
  const token = nextData?.props?.pageProps?.state?.settings?.session?.accessToken;
  return token;
}
```

### How It Works

1. Spotify's embed pages are publicly accessible (no login required)
2. The embed page is a Next.js app that embeds its initial state in a `<script id="__NEXT_DATA__">` tag
3. Inside that JSON, under `props.pageProps.state.settings.session.accessToken`, there's a valid OAuth access token
4. This token is **anonymous** — it belongs to Spotify's embed player, not a specific user
5. The token has limited permissions but is sufficient to read public playlist data via GraphQL

### Same Pattern for Tracks and Artists

The same `fetchSpotifyEmbedState()` function (lines 124-144) is used for:
- `embed/playlist/{id}` — playlist data
- `embed/track/{id}` — track details
- `embed/artist/{id}` — artist details with top tracks

All three extract data from `__NEXT_DATA__` → `props.pageProps.state.data`.

---

## GraphQL Playlist Fetching

### The Request (`server.js` lines 927-972)

```javascript
async function fetchPlaylistPage(playlistUri, token, offset, isRetry = false) {
  const hash = await getHash();

  const variables = JSON.stringify({
    uri: playlistUri,                              // "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"
    offset,                                        // 0, 100, 200, ...
    limit: 100,                                    // SPOTIFY_PAGE_LIMIT
    enableWatchFeedEntrypoint: false,
    includeRecommendedPlaylistInLikedSongs: false,
    enableSessionData: false,
  });

  const extensions = JSON.stringify({
    persistedQuery: { version: 1, sha256Hash: hash },
  });

  const url = new URL('https://api-partner.spotify.com/pathfinder/v1/query');
  url.searchParams.set('operationName', 'fetchPlaylist');
  url.searchParams.set('variables', variables);
  url.searchParams.set('extensions', extensions);

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 ...',
      'App-Platform': 'WebPlayer',
    },
  });
```

### Key Points

- **Endpoint:** `https://api-partner.spotify.com/pathfinder/v1/query`
- **Operation:** `fetchPlaylist`
- **Auth:** Anonymous Bearer token from embed page
- **Pagination:** `offset` + `limit` (100 per page)
- **Persisted Query:** The hash tells Spotify which GraphQL query to run
- **Headers:** `App-Platform: WebPlayer` mimics the official web player

### Response Parsing (`server.js` lines 975-1007)

```javascript
function parseGraphQLTracks(items) {
  return items.map(item => {
    const track = item?.itemV2?.data;
    // Extract: name, uri, duration, artists, album, image
    const spotifyTrackId = extractSpotifyId(uri);  // Extracts 22-char ID from "spotify:track:xxx"
    return {
      name,
      artist: artists.join(', '),
      album,
      image,            // Album cover URL
      duration: msToTime(durationMs),
      url: `https://open.spotify.com/track/${spotifyTrackId}`,
      artistId: artistItems[0]?.id,
      artistIds: allArtistIds,
      spotifyTrackId,
    };
  });
}
```

### Track Enrichment

After parsing, tracks go through `enrichImportedTracks()` which:
- Checks if the track has non-ASCII characters in the artist name (indicates garbled data)
- If so, fetches the track's embed page to get proper metadata
- Batches requests (8 at a time) to avoid rate limiting

---

## Artist Page Scraping

### Purpose

When a song is playing, the "Now Playing" sidebar shows artist info including playlists from the artist's Spotify page.

### Process (`server.js` lines 146-187, 1141-1166)

**Step 1:** Fetch the artist page HTML:
```javascript
const res = await fetch(`https://open.spotify.com/artist/${artistId}`, {
  headers: { 'User-Agent': 'Mozilla/5.0 ...' }
});
```

**Step 2:** Check if the HTML contains playlist links:
```javascript
if (!/\/playlist\/[A-Za-z0-9]{22}/.test(html)) {
  // Fallback: use Jina.ai to get a readable version
}
```

**Step 3:** Parse playlist links from anchor tags:
```javascript
const anchorMatches = [...source.matchAll(/<a[^>]+href="\/playlist\/([A-Za-z0-9]{22})"[^>]*>([\s\S]{0,4000}?)<\/a>/g)];
```

**Step 4:** For each playlist found, extract name from `<span>` text and image from `<img>` src.

**Step 5:** If name/image is missing, fetch the playlist card details via the embed page.

**Step 6:** Return up to 6 playlists.

### Artist Details

The `/api/artist-details` endpoint:
1. Fetches `embed/artist/{id}` to get artist name, images, top tracks
2. Enriches top tracks by fetching each track's embed page
3. **Fetches a Wikipedia bio** by searching Wikipedia API with terms like `"{artistName}" musician`, scoring results by title match and description keywords

---

## Embed Page Scraping (__NEXT_DATA__)

### The Universal Scraper (`server.js` lines 124-144)

```javascript
async function fetchSpotifyEmbedState(path) {
  const res = await fetch(`https://open.spotify.com/embed/${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ...',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  const html = await res.text();

  // Next.js embeds initial state in this script tag
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  const nextData = JSON.parse(match[1]);

  return nextData?.props?.pageProps?.state?.data || null;
}
```

### Data Structure

The returned `data` object contains an `entity` field with different structures depending on the type:

**For playlists:**
```javascript
{
  entity: {
    type: 'playlist',
    title: 'Playlist Name',
    visualIdentity: { image: [{ url: '...' }] },
  }
}
```

**For artists:**
```javascript
{
  entity: {
    type: 'artist',
    uri: 'spotify:artist:xxx',
    name: 'Artist Name',
    subtitle: '1,234,567 monthly listeners',
    visualIdentity: { image: [...] },
    trackList: [ /* top 5 tracks */ ],
  }
}
```

**For tracks:**
```javascript
{
  entity: {
    type: 'track',
    uri: 'spotify:track:xxx',
    title: 'Track Name',
    subtitle: 'Artist Name',
    duration: 180000,
    artists: [{ name: '...', uri: 'spotify:artist:xxx' }],
    visualIdentity: { image: [...] },
    audioPreview: { url: '...' },
  }
}
```

---

## How Songs Are Resolved for Playback

### The Resolution Pipeline (Player.tsx lines 331-391)

When a track from an imported playlist is selected, it has **no YouTube ID** — only Spotify metadata. The app must find the matching YouTube video.

**Step 1:** Check if the track already has a `youtubeId` (from a previous play or if it's a YouTube-sourced track). If yes, use it directly.

**Step 2:** Build multiple search queries from the track's metadata:
```javascript
function buildTrackQueries(track) {
  // Generates variations like:
  // "Bohemian Rhapsody Queen"
  // "bohemian rhapsody queen"
  // "Bohemian Rhapsody Queen song"
  // "Queen Bohemian Rhapsody"
  // etc.
}
```

**Step 3:** For each query, call `/api/best-match`:
```javascript
const data = await backendClient.get('/api/best-match', {
  params: { q: query, title: track.name, artist: track.artist }
});
// Returns: { id: 'bestYoutubeId', candidates: ['id1', 'id2', ...] }
```

**Step 4:** If best-match fails, fall back to `/api/search` and `/search` endpoints.

**Step 5:** Return the best YouTube video ID and a list of candidate IDs.

### Candidate Fallback System

If the first YouTube video fails to play (error event from IFrame API), the player automatically tries the next candidate:

```javascript
// Player.tsx onError handler
const nextCandidateIndex = currentCandidateIndexRef.current + 1;
if (nextCandidateIndex < currentCandidatesRef.current.length) {
  tryCandidateAtIndex(activeTrackId, nextCandidateIndex, autoplay);
  return;
}
```

---

## YouTube Search & Scoring Engine

### The Search Function (`server.js` lines 763-790)

```javascript
async function doSearch(q, context = {}) {
  const yt = await getYT();  // youtube-sr library
  const searchQueries = buildSongSearchQueries(q, context);
  const merged = new Map();

  for (const [index, searchQuery] of searchQueries.entries()) {
    const results = await yt.search(searchQuery, { limit: 12, type: 'video' });
    // Score each result and merge into a single deduplicated list
  }

  return [...merged.values()].sort((a, b) => b._score - a._score).slice(0, 25);
}
```

### Query Generation (`buildSongSearchQueries`)

Generates multiple query variations:
- Raw query
- Normalized query (strips accents, parentheses, feat/ft, "official", "audio", etc.)
- Structured query (title + artist)
- Queries with "song" / "music" suffix
- Primary artist + title

### The Scoring Algorithm (`scoreResult`, lines 649-761)

This is a sophisticated scoring system that ranks YouTube results:

**Positive signals:**
- Exact title match: **+180**
- Title contains query: **+120**
- All title words matched: **+50 bonus**
- All artist words matched: **+55 bonus**
- Per-word title match: **+18 each**
- Per-word artist match: **+24 each**
- "official audio" in title: **+30**
- "official video" in title: **+24**
- "provided to youtube" in title: **+28**
- Artist contains "topic": **+20** (YouTube Music auto-generated)
- Artist contains "vevo": **+16**
- Duration 2-8 minutes: **+12**

**Negative signals (heavy penalties, -140 each):**
- "nightcore", "slowed", "reverb", "sped up", "edit", "shorts", "snippet", "capcut", "tiktok", "mashup", "amv"

**Medium penalties (-70 each):**
- "cover", "remix", "live", "reaction", "karaoke", "instrumental", "tutorial", "8d audio", "bass boosted", "fan made"

**Duration penalties:**
- Under 1 minute: **-100**
- 1-2 minutes: **-60**
- Over 12 minutes: **-20**
- Over 30 minutes: **-50**

**Stripped title penalty (-160):**
If removing variant terms (slowed, reverb, etc.) results in an exact match but the original title had those terms, it's heavily penalized — meaning the original is likely a remix/variant, not the official track.

---

## Audio Stream Extraction

### 3-Tier Fallback System (`server.js` lines 796-893)

**Tier 1: youtubei.js ANDROID client** (lines 805-844)

```javascript
const yt = await getInnertube();
const info = await yt.actions.execute('/player', {
  videoId,
  client: 'ANDROID',
  parse: true
});

// Get adaptive audio formats, prefer MP4 (AAC) over WebM (Opus)
const formats = info.streaming_data.adaptive_formats;
const mp4Audio = formats.filter(f => f.mime_type?.includes('mp4'));
const audioFormats = (mp4Audio.length > 0 ? mp4Audio : allAudio)
  .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
```

The ANDROID client is used because it:
- Returns direct URLs (no cipher/decryption needed)
- Bypasses some of YouTube's anti-bot measures
- Returns higher quality audio formats

**Tier 2: Invidious instances** (lines 847-868)

If youtubei.js fails, try public Invidious API instances:
```javascript
for (const base of INVIDIOUS_INSTANCES) {
  const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=...,adaptiveFormats`);
  const audioFormats = data.adaptiveFormats.filter(f => f.type?.startsWith('audio/'));
  return audioFormats[0].url;  // Highest bitrate
}
```

Instances: `inv.nadeko.net`, `invidious.nerdvpn.de`, `yt.cdaut.de`, `invidious.privacydev.net`, `iv.melmac.space`

**Tier 3: Piped instances** (lines 871-890)

```javascript
for (const base of PIPED_INSTANCES) {
  const res = await fetch(`${base}/streams/${videoId}`);
  const sorted = data.audioStreams.filter(s => s.url).sort((a, b) => b.bitrate - a.bitrate);
  return sorted[0].url;
}
```

Instances: `pipedapi.kavin.rocks`, `piped-api.garudalinux.org`, `api.piped.yt`, `pipedapi.in.projectsegfau.lt`

---

## Stream Proxy

### Why a Proxy Is Needed

YouTube CDN URLs (`googlevideo.com`) are **IP-locked** — the URL is signed to the IP that requested it. If the backend resolves the URL and sends it to the browser, the browser's IP won't match → **403 Forbidden**.

### The Proxy Endpoint (`/api/proxy-stream/:id`)

```
Browser ──Range: bytes=0-1048575──► Backend ──Range: bytes=0-1048575──► YouTube CDN
Browser ◄── 206 Partial Content ◄── Backend ◄── 206 Partial Content ◄── YouTube CDN
```

**Key features:**

1. **Range request support:** The proxy forwards HTTP Range headers to YouTube, enabling seek functionality
2. **Chunked responses:** Limits upstream range requests to 1MB chunks (`PROXY_CHUNK_SIZE`) to avoid Google 403s on open-ended ranges
3. **URL caching:** Resolved stream URLs are cached for 4 minutes (browser sends many Range requests for the same video)
4. **Automatic refresh:** If upstream returns 403/410, the cached URL is deleted and re-resolved
5. **Raw byte piping:** Uses `Accept-Encoding: identity` to prevent gzip compression, allowing direct byte piping

### Range Normalization

```javascript
function normalizeProxyRange(rangeHeader, totalSize) {
  // Converts browser Range header to a max 1MB chunk
  // e.g., "bytes=5000000-" becomes "bytes=5000000-5048575"
}
```

---

## Frontend Player (YouTube IFrame API)

### Player Initialization (`Player.tsx` lines 393-505)

The app loads the YouTube IFrame API dynamically:

```javascript
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.onYouTubeIframeAPIReady = () => {
  ytReadyRef.current = true;
  initPlayer();
};
```

### Hidden Player

The YouTube player is rendered as a 1x1 pixel invisible element:

```jsx
<div id="yt-player-container" style={{
  position: 'fixed', width: 1, height: 1, opacity: 0,
  pointerEvents: 'none', bottom: 0, right: 0, zIndex: -1
}} />
```

### Player Events

**onReady:** Sets volume, processes any pending load
**onStateChange:**
- `PLAYING` → Start progress timer, set isPlaying=true
- `PAUSED` → Stop progress timer, set isPlaying=false
- `BUFFERING` → Show loading state
- `ENDED` → Auto-advance to next track (respecting shuffle/repeat)
- `CUED` → Video loaded but not playing

**onError:** Try next candidate video ID

### Progress Tracking

```javascript
const startProgressTimer = () => {
  progressTimerRef.current = window.setInterval(() => {
    const time = ytPlayerRef.current.getCurrentTime();
    const duration = ytPlayerRef.current.getDuration();
    setProgress((time / duration) * 100);
    setCurrentTime(time);
    setDuration(duration);
  }, 500);
};
```

### Seek Handling

Seeking uses a two-phase approach:
1. **During drag:** Update UI progress bar only (don't call YouTube API)
2. **On release:** Call `ytPlayerRef.current.seekTo(targetTime, true)`

This prevents excessive API calls during the drag.

---

## Queue Management

### State Structure (`App.tsx`)

```javascript
const [currentTrack, setCurrentTrack] = useState<Track | null>(...);
const [queue, setQueue] = useState<Track[]>(...);
const [currentIndex, setCurrentIndex] = useState(...);
```

### Persistence

All player state is persisted to localStorage:
- `player_current_track` — current track object
- `player_queue` — full queue array
- `player_current_index` — current position in queue
- `player_volume` — volume (0-1)
- `player_shuffle` — shuffle toggle
- `player_repeat` — repeat mode (0=off, 1=repeat all, 2=repeat one)

### Navigation Logic

**Next:**
```javascript
if (isShuffle) {
  // Pick random index != currentIndex
} else {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= queue.length) {
    if (repeatMode === 1) { /* loop to start */ }
    return;  // End of queue
  }
  setCurrentIndex(nextIndex);
  setCurrentTrack(queue[nextIndex]);
}
```

**Previous:**
```javascript
const prevIndex = currentIndex - 1;
if (prevIndex < 0) {
  if (repeatMode === 1) { /* loop to end */ }
  return;
}
setCurrentIndex(prevIndex);
setCurrentTrack(queue[prevIndex]);
```

### Replay Nonce

To force re-play of the same track (e.g., clicking play on an already-playing track), the app increments a `playbackNonce` on the track object. The Player component detects this change and reloads the video.

---

## Data Flow Summary

### Full Playlist Import Flow

```
User pastes Spotify URL
       │
       ▼
Frontend: importOrReuseSpotifyPlaylist()
       │
       ▼ (SSE connection)
Backend: /api/import-playlist?url=...
       │
       ├─ 1. GET open.spotify.com/embed/playlist/{id}
       │      └─ Extract accessToken from __NEXT_DATA__
       │
       ├─ 2. GET open.spotify.com/ (main page)
       │      └─ Extract JS bundle URLs
       │           └─ Fetch bundles → find SHA-256 hash for "fetchPlaylist"
       │
       ├─ 3. POST api-partner.spotify.com/pathfinder/v1/query
       │      Headers: Authorization: Bearer {token}
       │      Params: operationName=fetchPlaylist, variables, extensions(hash)
       │      └─ Parse GraphQL response → track array
       │
       ├─ 4. Paginate (offset += 100) until all tracks fetched
       │
       └─ 5. Stream as SSE events: meta → tracks → tracks → ... → done
              │
              ▼
Frontend: Collect all tracks
       │
       ▼
localStorage.setItem('imported_playlists', ...)
       │
       ▼
dispatchEvent('playlist-imported')
       │
       ▼
App.tsx: Update state, navigate to /playlist/{id}
```

### Full Playback Flow

```
User clicks a track in playlist
       │
       ▼
App.tsx: setCurrentTrack(track), setQueue(allTracks), setCurrentIndex(index)
       │
       ▼
Player.tsx: useEffect detects currentTrack change
       │
       ▼
resolveTrackPlayback(track)
       │
       ├─ Has youtubeId? → Use it
       │
       └─ No? Build search queries from track name + artist
              │
              ▼
       For each query: GET /api/best-match?q=...&title=...&artist=...
              │
              ▼
       Backend: doSearch(query, context)
              │
              ├─ youtube-sr.search(query) → YouTube results
              ├─ scoreResult() for each → rank by title/artist match
              ├─ Penalize covers, remixes, nightcore, etc.
              └─ Return best match + candidates
              │
              ▼
       Frontend: Get { youtubeId, candidates[] }
       │
       ▼
loadIntoPlayer(youtubeId, autoplay)
       │
       ▼
YouTube IFrame API: loadVideoById({ videoId: youtubeId })
       │
       ▼
YouTube plays audio (hidden 1x1 player)
       │
       ▼
Progress timer updates UI every 500ms
       │
       ▼
Video ends → onStateChange(ENDED) → handleNext() → next track
```

### Full Search Flow

```
User types in search bar
       │
       ▼
SearchBar.tsx: onSubmit → handleSearch(query)
       │
       ▼
GET /search?q={query}
       │
       ▼
Backend: doSearch(query)
       │
       ├─ Build multiple query variations
       ├─ Search YouTube via youtube-sr for each
       ├─ Score and merge results
       └─ Return top 25
       │
       ▼
ResultList.tsx: Display results
       │
       ▼
User clicks result → handleSearchResultSelect(video)
       │
       ▼
Create Track with isYoutube=true, youtubeId=video.id
       │
       ▼
Same playback flow as above (but skips resolution step)
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/server.js` | All backend logic: hash extraction, token scraping, GraphQL fetching, YouTube search/scoring, stream extraction, stream proxy, artist scraping |
| `src/App.tsx` | Main app state, queue management, track selection, artist data fetching, color theme application |
| `src/components/Player.tsx` | YouTube IFrame API wrapper, progress tracking, seeking, shuffle/repeat, candidate fallback |
| `src/components/Home.tsx` | Playlist display, track list rendering, infinite scroll, playlist search |
| `src/components/ImportPlaylist.tsx` | Playlist import UI, SSE connection management |
| `src/utils/spotifyPlaylistImport.ts` | SSE event handling, localStorage storage, playlist ID extraction |
| `src/utils/colorExtractor.ts` | Canvas-based album art color extraction, CSS variable theming |
| `src/api/backend.ts` | Frontend API client wrappers for search and streaming |
| `src/api/client.ts` | Generic HTTP client with timeouts and error handling |
| `src/types.ts` | TypeScript interfaces for all data types |
