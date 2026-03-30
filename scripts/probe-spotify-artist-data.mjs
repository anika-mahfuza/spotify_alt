const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const SPOTIFY_PATHFINDER = 'https://api-partner.spotify.com/pathfinder/v1/query';
const DEFAULT_PLAYLIST_ID = '5EYSRvXzQbqmNoB76FNBNK';
const TARGET_ARTIST = 'CKay';

let cachedHash = '30d415ed189d2699051b60bd0b17ea06467a01bc26d44e8058975e37e9f5fbf6';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractNextData(html) {
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  return match ? safeJsonParse(match[1]) : null;
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed ${res.status} for ${url}`);
  }

  return res.text();
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed ${res.status} for ${url}`);
  }

  return res.json();
}

async function fetchSpotifyHash() {
  const html = await fetchText('https://open.spotify.com/');
  const bundleUrls = [...html.matchAll(/src="(https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/[^"]+)"/g)].map(
    match => match[1]
  );

  for (const bundleUrl of bundleUrls) {
    try {
      const js = await fetchText(bundleUrl);
      const match = js.match(/"fetchPlaylist"[^"]*"query"[^"]*"([a-f0-9]{64})"/);
      if (match) {
        cachedHash = match[1];
        return cachedHash;
      }
    } catch {
      // Try the next bundle.
    }
  }

  return cachedHash;
}

async function getSpotifyToken(playlistId) {
  const html = await fetchText(`https://open.spotify.com/embed/playlist/${playlistId}`);
  const nextData = extractNextData(html);
  const token = nextData?.props?.pageProps?.state?.settings?.session?.accessToken;

  if (!token) {
    throw new Error('Could not extract anonymous Spotify token from playlist embed page');
  }

  return token;
}

async function fetchPlaylistPage(playlistId, token) {
  const hash = await fetchSpotifyHash();
  const variables = JSON.stringify({
    uri: `spotify:playlist:${playlistId}`,
    offset: 0,
    limit: 100,
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

  return fetchJson(url.toString(), {
    Authorization: `Bearer ${token}`,
    'App-Platform': 'WebPlayer',
  });
}

function findArtistTrack(items, targetArtist) {
  const loweredTarget = targetArtist.toLowerCase();

  for (const item of items) {
    const track = item?.itemV2?.data;
    const artists = track?.artists?.items || [];
    const hasTarget = artists.some(artist => artist?.profile?.name?.toLowerCase() === loweredTarget);

    if (track && hasTarget) {
      return track;
    }
  }

  return null;
}

function summarizeArtistItems(artists = []) {
  return artists.map(artist => ({
    name: artist?.profile?.name || null,
    uri: artist?.uri || null,
    id: artist?.uri?.split(':').pop() || null,
    avatar: artist?.visuals?.avatarImage?.sources?.[0]?.url || null,
    profilePath: artist?.profile?.href || null,
    rawKeys: Object.keys(artist || {}),
  }));
}

function probeHtmlSignals(html) {
  const checks = {
    monthlyListenersText: /monthly listeners/i.test(html),
    biographyText: /biography|about the artist/i.test(html),
    creditsText: /credits/i.test(html),
    followersText: /followers/i.test(html),
    lyricsText: /lyrics/i.test(html),
  };

  const metaImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] || null;
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || null;

  return { checks, metaImage, title };
}

async function probeArtistPage(artistId) {
  const artistUrl = `https://open.spotify.com/artist/${artistId}`;
  const embedUrl = `https://open.spotify.com/embed/artist/${artistId}`;

  const artistHtml = await fetchText(artistUrl);
  const artistNextData = extractNextData(artistHtml);
  const embedHtml = await fetchText(embedUrl);
  const embedNextData = extractNextData(embedHtml);

  return {
    artistUrl,
    pageSignals: probeHtmlSignals(artistHtml),
    embedSignals: probeHtmlSignals(embedHtml),
    pageNextDataKeys: artistNextData ? Object.keys(artistNextData) : [],
    embedNextDataKeys: embedNextData ? Object.keys(embedNextData) : [],
    embedSessionKeys: embedNextData?.props?.pageProps?.state?.settings?.session
      ? Object.keys(embedNextData.props.pageProps.state.settings.session)
      : [],
    pageHasSerializedBiography:
      /"biography"|biographyText|about the artist/i.test(JSON.stringify(artistNextData || {})),
    pageHasSerializedMonthlyListeners: /monthly listeners|monthlyListeners/i.test(
      JSON.stringify(artistNextData || {})
    ),
  };
}

async function probeArtistApi(artistId, token) {
  try {
    const artist = await fetchJson(`https://api.spotify.com/v1/artists/${artistId}`, {
      Authorization: `Bearer ${token}`,
    });

    return {
      ok: true,
      artist: {
        id: artist.id || null,
        name: artist.name || null,
        image: artist.images?.[0]?.url || null,
        genres: artist.genres || [],
        followers: artist.followers?.total ?? null,
        popularity: artist.popularity ?? null,
        externalUrl: artist.external_urls?.spotify || null,
        rawKeys: Object.keys(artist || {}),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const playlistId = process.argv[2] || DEFAULT_PLAYLIST_ID;

  console.log(`Probing playlist: ${playlistId}`);
  const token = await getSpotifyToken(playlistId);
  const playlistPage = await fetchPlaylistPage(playlistId, token);
  const items = playlistPage?.data?.playlistV2?.content?.items || [];

  if (!items.length) {
    throw new Error('Playlist probe returned no items');
  }

  const targetTrack = findArtistTrack(items, TARGET_ARTIST);
  if (!targetTrack) {
    throw new Error(`Could not find a track by ${TARGET_ARTIST} in the probe playlist`);
  }

  const trackSummary = {
    name: targetTrack.name,
    album: targetTrack.albumOfTrack?.name || null,
    image: targetTrack.albumOfTrack?.coverArt?.sources?.[0]?.url || null,
    artists: summarizeArtistItems(targetTrack.artists?.items || []),
  };

  const primaryArtistId = trackSummary.artists.find(artist => artist.name === TARGET_ARTIST)?.id;
  if (!primaryArtistId) {
    throw new Error(`Could not resolve ${TARGET_ARTIST} artist ID from scraped playlist data`);
  }

  const artistProbe = await probeArtistPage(primaryArtistId);
  const artistApiProbe = await probeArtistApi(primaryArtistId, token);

  console.log(JSON.stringify({ trackSummary, artistProbe, artistApiProbe }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
