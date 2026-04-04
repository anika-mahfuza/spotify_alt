/**
 * Test v6: Find hash structure in minified JS, brute force artist ops
 */

const SPOTIFY_PATHFINDER_V2 = 'https://api-partner.spotify.com/pathfinder/v2/query';
const SPOTIFY_PATHFINDER_V1 = 'https://api-partner.spotify.com/pathfinder/v1/query';
const CURRENT_HASH = '30d415ed189d2699051b60bd0b17ea06467a01bc26d44e8058975e37e9f5fbf6';
const NEW_HASH = '32b05e92e4384384f41009b776e60a73e824b72b6e7f88e2c5f8579092b'; // From previous test

async function getToken() {
  const res = await fetch('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
  });
  const html = await res.text();
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  const nextData = JSON.parse(match[1]);
  return nextData?.props?.pageProps?.state?.settings?.session?.accessToken;
}

async function findHashStructure() {
  console.log('[1] Finding hash structure in bundles...');
  
  // Fetch main bundle
  const res = await fetch('https://open.spotifycdn.com/cdn/build/web-player/web-player.cc598ff1.js', {
    signal: AbortSignal.timeout(20000)
  });
  const js = await res.text();
  
  // Find the CURRENT_HASH in the JS
  const idx = js.indexOf(CURRENT_HASH);
  if (idx === -1) {
    console.log('    Current hash NOT found in main bundle');
    // Try other bundles
    for (const url of [
      'https://open.spotifycdn.com/cdn/build/web-player/vendor~web-player.8d647cb6.js',
      'https://open.spotifycdn.com/cdn/build/web-player/encore~web-player.f7595fde.js'
    ]) {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const j = await r.text();
      const i = j.indexOf(CURRENT_HASH);
      if (i !== -1) {
        console.log(`    Found in: ${url.split('/').pop()} at index ${i}`);
        console.log(`    Context (500 chars before):`);
        console.log(j.slice(Math.max(0, i - 500), i + 64));
        console.log(`\n    Context (500 chars after):`);
        console.log(j.slice(i + 64, i + 564));
        return j;
      }
    }
    console.log('    Current hash not found in any bundle');
    return null;
  }
  
  console.log(`    Found current hash at index ${idx}`);
  console.log(`    Context (500 chars before):`);
  console.log(js.slice(Math.max(0, idx - 500), idx + 64));
  console.log(`\n    Context (500 chars after):`);
  console.log(js.slice(idx + 64, idx + 564));
  
  // Now find ALL 64-char hex strings near "fetchPlaylist" or "query"
  const fpIdx = js.indexOf('fetchPlaylist');
  if (fpIdx !== -1) {
    console.log(`\n    "fetchPlaylist" found at index ${fpIdx}`);
    console.log(`    Context (1000 chars around):`);
    console.log(js.slice(Math.max(0, fpIdx - 200), fpIdx + 800));
  }
  
  return js;
}

async function bruteForceArtistOps(token) {
  console.log('\n[2] Brute forcing artist operations with v2 POST...');
  
  // Use the NEW hash we found for fetchPlaylist
  const hash = '32b05e92e4384384f41009b776e60a73e824b72b6e7f88e2c5f8579092b';
  const artistId = '8e67590d8e8c446daf081044b441cfb3';
  
  // Common GraphQL operation names for artist data
  const ops = [
    // Basic artist
    'fetchArtist', 'getArtist', 'queryArtist', 'artist',
    
    // Artist content
    'artistOverview', 'artistDiscography', 'artistRadio', 'artistTopTracks',
    'artistAlbums', 'artistSingles', 'artistAppearsOn', 'artistCompilations',
    'artistDiscoveredOn', 'artistFeaturing', 'artistRelatedContent',
    
    // Artist playlists
    'artistPlaylists', 'artistPlaylistRecommendations', 'artistPlaylistSuggestions',
    'artistRelatedPlaylists', 'artistCuratedPlaylists', 'artistGeneratedPlaylists',
    'artistEssentialPlaylists', 'artistThisIsPlaylists',
    
    // Artist social
    'artistFansAlsoLike', 'artistRelatedArtists', 'artistSimilarArtists',
    'artistSimilar', 'artistFans', 'artistFollowers',
    
    // Artist info
    'artistBiography', 'artistAbout', 'artistBio', 'artistInfo',
    'artistGallery', 'artistImages', 'artistStats', 'artistInsights',
    'artistConcerts', 'artistEvents', 'artistTour', 'artistMerch',
    
    // Playlist operations
    'fetchPlaylist', 'getPlaylist', 'queryPlaylist', 'playlist',
    'playlistV2', 'fetchPlaylistV2', 'getPlaylistV2',
    
    // Track operations  
    'fetchTrack', 'getTrack', 'queryTrack', 'track',
    'trackV2', 'fetchTrackV2', 'getTrackV2',
    
    // Album operations
    'fetchAlbum', 'getAlbum', 'queryAlbum', 'album',
    'albumV2', 'fetchAlbumV2', 'getAlbumV2',
    
    // Search
    'search', 'searchV2', 'querySearch',
    
    // Home
    'home', 'homeV2', 'fetchHome', 'getHome',
    
    // Related
    'relatedContent', 'relatedTracks', 'relatedPlaylists',
    'recommendations', 'recommendedContent',
    
    // Radio
    'radio', 'fetchRadio', 'getRadio', 'queryRadio',
    'station', 'fetchStation', 'getStation',
    
    // Context
    'context', 'fetchContext', 'getContext',
    'contextPlaylist', 'contextTracks',
    
    // Extender
    'extendPlaylist', 'playlistExtender', 'extend',
    
    // V2 variants
    'fetchArtistV2', 'getArtistV2', 'artistV2',
    'fetchPlaylistV2', 'getPlaylistV2',
    
    // Page
    'artistPage', 'playlistPage', 'trackPage',
    
    // Root
    'root', 'rootArtist', 'rootPlaylist',
    
    // Content
    'artistContent', 'playlistContent', 'trackContent',
    
    // Items
    'artistItems', 'playlistItems', 'trackItems',
    
    // All
    'allArtistPlaylists', 'allArtistTracks', 'allArtistAlbums',
    
    // Complete
    'completeArtist', 'completePlaylist',
    
    // Full
    'fullArtist', 'fullPlaylist',
    
    // Details
    'artistDetails', 'playlistDetails', 'trackDetails',
    
    // Data
    'artistData', 'playlistData', 'trackData',
    
    // Collection
    'artistCollection', 'playlistCollection',
    
    // Library
    'artistLibrary', 'playlistLibrary',
    
    // Catalog
    'artistCatalog', 'playlistCatalog',
    
    // Works
    'artistWorks', 'artistOutput', 'artistRepertoire',
    
    // Production
    'artistProduction', 'artistCreation',
    
    // Material
    'artistMaterial', 'artistPieces',
    
    // Elements
    'artistElements', 'artistComponents',
    
    // Parts
    'artistParts', 'artistSections',
    
    // Segments
    'artistSegments', 'artistChunks',
    
    // Bits
    'artistBits', 'artistFragments',
    
    // Snippets
    'artistSnippets', 'artistClips',
    
    // Samples
    'artistSamples', 'artistExamples',
    
    // Instances
    'artistInstances', 'artistCases',
    
    // Occurrences
    'artistOccurrences', 'artistEvents',
    
    // Happenings
    'artistHappenings', 'artistIncidents',
    
    // Episodes
    'artistEpisodes', 'artistSituations',
    
    // Circumstances
    'artistCircumstances', 'artistConditions',
    
    // States
    'artistStates', 'artistStatuses',
    
    // Positions
    'artistPositions', 'artistPlacements',
    
    // Locations
    'artistLocations', 'artistSites',
    
    // Spots
    'artistSpots', 'artistPlaces',
    
    // Areas
    'artistAreas', 'artistRegions',
    
    // Zones
    'artistZones', 'artistDistricts',
    
    // Neighborhoods
    'artistNeighborhoods', 'artistCommunities',
    
    // Towns
    'artistTowns', 'artistCities',
    
    // Municipalities
    'artistMunicipalities', 'artistVillages',
    
    // Hamlets
    'artistHamlets', 'artistSettlements',
    
    // Colonies
    'artistColonies', 'artistOutposts',
    
    // Stations
    'artistStations', 'artistBases',
    
    // Camps
    'artistCamps', 'artistPosts',
    
    // Depots
    'artistDepots', 'artistStores',
    
    // Shops
    'artistShops', 'artistMarkets',
    
    // Marts
    'artistMarts', 'artistMalls',
    
    // Centers
    'artistCenters', 'artistHubs',
    
    // Nexuses
    'artistNexuses', 'artistFoci',
    
    // Hearts
    'artistHearts', 'artistCores',
    
    // Middles
    'artistMiddles',
    
    // Generated
    'artistGeneratedPlaylist', 'artistCuratedPlaylist',
    
    // Radio
    'artistRadioStation', 'artistRadioPlaylist', 'artistRadioMix',
    
    // Essential
    'artistEssential', 'artistThisIs', 'artistDeepCuts',
    
    // Fresh
    'artistFresh', 'artistLatest', 'artistPopular',
    
    // All
    'artistAll', 'artistComplete', 'artistFull',
    
    // Entire
    'artistEntire', 'artistTotal', 'artistComprehensive',
    
    // Collection
    'artistCollection', 'artistLibrary', 'artistCatalog',
    
    // Works
    'artistWorks', 'artistOutput', 'artistRepertoire',
    
    // Production
    'artistProduction', 'artistCreation', 'artistContent',
    
    // Material
    'artistMaterial', 'artistPieces', 'artistItems',
    
    // Elements
    'artistElements', 'artistComponents', 'artistParts',
    
    // Sections
    'artistSections', 'artistSegments', 'artistChunks',
    
    // Bits
    'artistBits', 'artistFragments', 'artistSnippets',
    
    // Clips
    'artistClips', 'artistSamples', 'artistExamples',
    
    // Instances
    'artistInstances', 'artistCases', 'artistOccurrences',
    
    // Events
    'artistEvents', 'artistHappenings', 'artistIncidents',
    
    // Episodes
    'artistEpisodes', 'artistSituations', 'artistCircumstances',
    
    // Conditions
    'artistConditions', 'artistStates', 'artistStatuses',
    
    // Positions
    'artistPositions', 'artistPlacements', 'artistLocations',
    
    // Sites
    'artistSites', 'artistSpots', 'artistPlaces',
    
    // Areas
    'artistAreas', 'artistRegions', 'artistZones',
    
    // Districts
    'artistDistricts', 'artistNeighborhoods', 'artistCommunities',
    
    // Towns
    'artistTowns', 'artistCities', 'artistMunicipalities',
    
    // Villages
    'artistVillages', 'artistHamlets', 'artistSettlements',
    
    // Colonies
    'artistColonies', 'artistOutposts', 'artistStations',
    
    // Bases
    'artistBases', 'artistCamps', 'artistPosts',
    
    // Depots
    'artistDepots', 'artistStores', 'artistShops',
    
    // Markets
    'artistMarkets', 'artistMarts', 'artistMalls',
    
    // Centers
    'artistCenters', 'artistHubs', 'artistNexuses',
    
    // Foci
    'artistFoci', 'artistHearts', 'artistCores',
    
    // Middles
    'artistMiddles',
  ];

  // Unique ops
  const uniqueOps = [...new Set(ops)];
  console.log(`    Testing ${uniqueOps.length} unique operations...`);
  
  let found = 0;
  for (const op of uniqueOps) {
    const body = {
      operationName: op,
      variables: { 
        uri: `spotify:artist:${artistId}`, 
        locale: '', 
        offset: 0, 
        limit: 10 
      },
      extensions: { 
        persistedQuery: { version: 1, sha256Hash: hash } 
      }
    };

    try {
      const res = await fetch(SPOTIFY_PATHFINDER_V2, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'App-Platform': 'WebPlayer',
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        const dataKeys = Object.keys(data.data || {}).join(', ');
        console.log(`  ✓ ${op}: OK → [${dataKeys}]`);
        found++;
        
        // Print data structure
        if (data.data) {
          for (const [key, value] of Object.entries(data.data)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              const subKeys = Object.keys(value).slice(0, 10).join(', ');
              console.log(`    ${key}: {${subKeys}}`);
            }
          }
        }
      }
    } catch (e) {}
  }
  
  console.log(`\n    Found ${found} working operations`);
}

async function testPlaylistExtenderWithTrackContext(token) {
  console.log('\n[3] Testing playlistextender with track context...');
  
  // The network log shows it was called with a playlist URI
  // But what if we pass the current track's playlist context?
  // Let's try with the track's canonical URI
  
  const tests = [
    { uri: 'spotify:track:6QgjcU0zLnzq5OrUoSZ3OK', desc: 'Track URI' },
    { uri: 'spotify:album:a1f048e12f874ca98672c98cf7707431', desc: 'Album URI' },
  ];

  for (const test of tests) {
    console.log(`\n  Testing: ${test.desc}`);
    const body = JSON.stringify({
      playlistURI: test.uri,
      trackSkipIDs: [],
      numResults: 5
    });

    const res = await fetch('https://spclient.wg.spotify.com/playlistextender/extendp/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'App-Platform': 'WebPlayer',
      },
      body
    });

    console.log(`    Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.recommendedTracks) {
          console.log(`    Tracks: ${data.recommendedTracks.length}`);
          data.recommendedTracks.forEach((t, i) => {
            console.log(`      ${i + 1}. ${t.name} - ${t.artists?.map(a => a.name).join(', ')} (score: ${t.score})`);
          });
        } else {
          console.log(`    Keys: ${Object.keys(data).join(', ')}`);
        }
      } catch {
        console.log(`    Raw: ${text.slice(0, 200)}`);
      }
    } else {
      console.log(`    Error: ${(await res.text()).slice(0, 200)}`);
    }
  }
}

async function main() {
  try {
    const token = await getToken();
    console.log('Token OK');
    
    await findHashStructure();
    await bruteForceArtistOps(token);
    await testPlaylistExtenderWithTrackContext(token);
    
    console.log('\n=== Done ===');
  } catch (e) {
    console.error('Fatal:', e.message);
  }
}

main();
