import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { parseArtistTitle, extractYoutubeId, dedupeKey, isExcludedByKeyword } from "./lib/extract.js";
import { createYoutubeStatsClient } from "./lib/youtube_stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function mostRecentMonday(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Some feeds (WordPress in particular) double-encode entities, so titles can still contain literal
// "&#8217;" etc. after XML parsing. Decode the common ones so they don't leak into artist/title text.
const HTML_ENTITIES = {
  "&amp;": "&",
  "&#038;": "&",
  "&#8217;": "’",
  "&#8216;": "‘",
  "&#8220;": "“",
  "&#8221;": "”",
  "&#8211;": "–",
  "&#8212;": "—",
  "&#124;": "|",
  "&quot;": '"',
  "&#039;": "'",
};

function decodeEntities(str) {
  return str.replace(/&#?[a-z0-9]+;/gi, (m) => HTML_ENTITIES[m] ?? m);
}

async function loadConfig() {
  const raw = await fs.readFile(path.join(ROOT, "config", "blogs.json"), "utf-8");
  return JSON.parse(raw);
}

async function fetchFeed(parser, blog) {
  try {
    const feed = await parser.parseURL(blog.feedUrl);
    return feed.items || [];
  } catch (err) {
    console.warn(`[warn] failed to fetch ${blog.name} (${blog.feedUrl}): ${err.message}`);
    return [];
  }
}

async function main() {
  const config = await loadConfig();
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.lookbackDays * 24 * 60 * 60 * 1000);

  const parser = new Parser({
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    timeout: 15000,
  });

  const groups = new Map();
  const usedBlogs = new Set();

  for (const blog of config.blogs) {
    const items = await fetchFeed(parser, blog);
    for (const item of items) {
      const pubDate = item.isoDate ? new Date(item.isoDate) : null;
      if (!pubDate || pubDate < cutoff || pubDate > now) continue;
      if (!item.title) continue;

      const title = decodeEntities(item.title);
      if (isExcludedByKeyword(title, config.excludeKeywords)) continue;

      const parsed = parseArtistTitle(title);
      if (!parsed.confident) continue; // skip low-confidence headlines (not clearly a song post)

      const key = dedupeKey(parsed);
      const html = item["content:encoded"] || item.content || item.contentSnippet || "";
      const youtubeId = extractYoutubeId(html);

      const isNewcomer = isExcludedByKeyword(title, config.newcomerKeywords);
      const isSnsBuzz = isExcludedByKeyword(title, config.snsKeywords);

      if (!groups.has(key)) {
        groups.set(key, {
          artist: parsed.artist,
          title: parsed.title,
          firstSeen: pubDate,
          youtubeId,
          newcomer: false,
          snsBuzz: false,
          sources: new Map(),
        });
      }
      const group = groups.get(key);
      if (pubDate < group.firstSeen) group.firstSeen = pubDate;
      if (!group.youtubeId && youtubeId) group.youtubeId = youtubeId;
      if (isNewcomer) group.newcomer = true;
      if (isSnsBuzz) group.snsBuzz = true;
      if (!group.sources.has(blog.name)) {
        group.sources.set(blog.name, item.link || blog.homepage);
        usedBlogs.add(blog.name);
      }
    }
  }

  const songs = Array.from(groups.values())
    .map((g) => ({
      artist: g.artist,
      title: g.title,
      firstSeen: g.firstSeen.toISOString(),
      youtubeId: g.youtubeId,
      newcomer: g.newcomer,
      snsBuzz: g.snsBuzz,
      tiktokUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(
        [g.artist, g.title].filter(Boolean).join(" ")
      )}`,
      sources: Array.from(g.sources.entries()).map(([blog, url]) => ({ blog, url })),
    }))
    .sort((a, b) => {
      if (b.sources.length !== a.sources.length) return b.sources.length - a.sources.length;
      return new Date(b.firstSeen) - new Date(a.firstSeen);
    })
    .slice(0, config.maxSongsPerWeek);

  const youtubeStats = createYoutubeStatsClient(process.env.YOUTUBE_API_KEY);
  if (youtubeStats) {
    console.log("Fetching YouTube stats (views/subscribers)...");
    await youtubeStats.enrichSongs(songs, now);
  } else {
    console.log("[skip] YOUTUBE_API_KEY not set — songs will have no view/subscriber stats.");
    for (const song of songs) song.youtube = null;
  }

  const weekOf = isoDate(mostRecentMonday(now));
  const output = {
    weekOf,
    generatedAt: now.toISOString(),
    blogsChecked: config.blogs.map((b) => b.name),
    blogsWithResults: Array.from(usedBlogs),
    songs,
  };

  const outDir = path.join(ROOT, "data", "weekly");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${weekOf}.json`);
  await fs.writeFile(outFile, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log(`Wrote ${songs.length} songs to ${path.relative(ROOT, outFile)}`);
  if (songs.length === 0) {
    console.warn("[warn] no songs matched this week — check feed health and parsing patterns.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
