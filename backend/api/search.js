const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://pipedapi.in'
];

function fmt(s) {
  if (!s) return '?:??';
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function pipedSearch(query) {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`, {
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.items?.filter(i => i.url?.startsWith('/watch?v=')) || [];
      if (!items.length) continue;
      return items.slice(0, 25).map(v => ({
        id: v.url.replace('/watch?v=', ''),
        title: v.title,
        artist: v.uploaderName || 'Unknown',
        duration: fmt(v.duration),
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.url.replace('/watch?v=', '')}/mqdefault.jpg`
      }));
    } catch { continue; }
  }
  throw new Error('Search failed — all sources unavailable');
}

module.exports = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    res.json(await pipedSearch(q));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
