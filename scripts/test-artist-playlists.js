/**
 * Test: Check full response from artist GraphQL operations
 */

const SPOTIFY_PATHFINDER_V1 = 'https://api-partner.spotify.com/pathfinder/v1/query';

async function getToken() {
  const res = await fetch('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
  });
  const html = await res.text();
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  const nextData = JSON.parse(match[1]);
  return nextData?.props?.pageProps?.state?.settings?.session?.accessToken;
}

async function main() {
  const token = await getToken();
  const artistId = '8e67590d8e8c446daf081044b441cfb3';
  
  // Test the most promising ones with full response dump
  const ops = {
    queryArtistPlaylists: '54f7e5a5a2af05b7dc98526df376a46c6b15c05440c8dfdc8f6cecb1a807eca7',
    queryArtistDiscoveredOn: '71c2392e4cecf6b48b9ad1311ae08838cbdabcfd189c6bf0c66c2430b8dcfdb1',
    queryArtistFeaturing: '20842d6d9d2d28ef945984b68cb927bb33edd00eab84a8da1667def21f1f2c54',
    queryArtistRelated: '3d031d6cb22a2aa7c8d203d49b49df731f58b1e2799cc38d9876d58771aa66f3',
    queryArtistOverview: '5b9e64f43843fa3a9b6a98543600299b0a2cbbbccfdcdcef2402eb9c1017ca4c',
    queryArtistAppearsOn: '9a4bb7a20d6720fe52d7b47bc001cfa91940ddf5e7113761460b4a288d18a4c1',
  };
  
  for (const [opName, hash] of Object.entries(ops)) {
    console.log(`\n=== ${opName} ===`);
    
    // Try different variable sets
    const varSets = [
      { uri: `spotify:artist:${artistId}`, locale: '', offset: 0, limit: 10 },
      { uri: `spotify:artist:${artistId}`, locale: 'en', offset: 0, limit: 10 },
      { artistUri: `spotify:artist:${artistId}`, locale: '', offset: 0, limit: 10 },
      { artistUri: `spotify:artist:${artistId}`, locale: 'en', offset: 0, limit: 10 },
      { id: artistId, locale: '', offset: 0, limit: 10 },
      { id: artistId, locale: 'en', offset: 0, limit: 10 },
    ];
    
    for (const vars of varSets) {
      const ext = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } });
      const url = `${SPOTIFY_PATHFINDER_V1}?operationName=${opName}&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(ext)}`;
      
      try {
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'App-Platform': 'WebPlayer',
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          const hasData = data.data && Object.keys(data.data).length > 0;
          const hasErrors = data.errors && data.errors.length > 0;
          
          if (hasData) {
            console.log(`  VARS ${JSON.stringify(vars)}: OK`);
            console.log(`  Full response: ${JSON.stringify(data, null, 2).slice(0, 2000)}`);
            break;
          } else if (hasErrors) {
            console.log(`  VARS ${JSON.stringify(vars)}: Errors: ${JSON.stringify(data.errors).slice(0, 200)}`);
          } else {
            console.log(`  VARS ${JSON.stringify(vars)}: Empty response, full: ${JSON.stringify(data).slice(0, 500)}`);
          }
        } else {
          const text = await res.text();
          console.log(`  VARS ${JSON.stringify(vars)}: ${res.status} - ${text.slice(0, 150)}`);
        }
      } catch (e) {
        console.log(`  VARS ${JSON.stringify(vars)}: Error - ${e.message}`);
      }
    }
  }
}

main();
