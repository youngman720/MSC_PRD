// Eggs (eggs.mu) is a Japanese distribution platform exclusively for independent/unsigned
// artists, so unlike the RSS blog sources, everything on it is indie by construction — no
// nationality filter or newcomer-keyword guessing needed, every entry can be trusted as a
// genuine indie/young-band signal. It has no RSS feed, so this scrapes the daily song ranking
// page directly. The page is server-rendered (Next.js), so a plain fetch + regex over the
// artist/song link pairs is enough — no headless browser needed.
const RANKING_URL = "https://eggs.mu/ranking/song/daily";

function decodeHtmlEntities(str) {
  return str
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function fetchEggsRanking({ limit = 20 } = {}) {
  const res = await fetch(RANKING_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`eggs.mu ranking fetch failed: HTTP ${res.status}`);
  const html = await res.text();

  // Matches "<a href=".../artist/{slug}/song/{id}">{title}</a> ... <a href=".../artist/{slug}">{artist}</a>",
  // using a backreference on the artist slug to keep the song/artist anchor pair correctly matched.
  const entryPattern =
    /artist\/([a-zA-Z0-9_-]+)\/song\/([a-f0-9-]+)">([^<]+)<\/a>[\s\S]*?href="https:\/\/eggs\.mu\/artist\/\1">([^<]+)<\/a>/g;

  const results = [];
  const seen = new Set();
  let m;
  while ((m = entryPattern.exec(html)) && results.length < limit) {
    const [, slug, songId, titleRaw, artistRaw] = m;
    const key = `${slug}/${songId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      artist: decodeHtmlEntities(artistRaw.trim()),
      title: decodeHtmlEntities(titleRaw.trim()),
      url: `https://eggs.mu/artist/${slug}/song/${songId}`,
    });
  }
  return results;
}
