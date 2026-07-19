import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "weekly");

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, SITE_URL, PLAYLIST_PRIVACY } = process.env;

async function latestWeekFile() {
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  files.sort().reverse();
  if (files.length === 0) throw new Error("No data/weekly/*.json files found — run fetch_songs.js first.");
  return path.join(DATA_DIR, files[0]);
}

async function findVideoId(youtube, song) {
  if (song.youtubeId) return song.youtubeId;
  const q = [song.artist, song.title].filter(Boolean).join(" ");
  const res = await youtube.search.list({
    part: ["id"],
    q,
    type: ["video"],
    maxResults: 1,
  });
  return res.data.items?.[0]?.id?.videoId || null;
}

async function main() {
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    console.log(
      "[skip] YouTube auto-posting is not configured (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN " +
        "not set). This is expected until you finish the one-time setup in README.md — skipping without error."
    );
    return;
  }

  const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  const weekFile = await latestWeekFile();
  const week = JSON.parse(await fs.readFile(weekFile, "utf-8"));

  if (week.songs.length === 0) {
    console.log("[skip] No songs in latest week's data — nothing to post.");
    return;
  }

  const description = [
    `Trending songs from indie-leaning bands, week of ${week.weekOf}.`,
    "Curated automatically from independent music blog coverage.",
    SITE_URL ? `More at ${SITE_URL}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const playlistRes = await youtube.playlists.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: `Indie Weekly – ${week.weekOf}`, description },
      status: { privacyStatus: PLAYLIST_PRIVACY || "unlisted" },
    },
  });
  const playlistId = playlistRes.data.id;
  console.log(`Created playlist: https://www.youtube.com/playlist?list=${playlistId}`);

  for (const song of week.songs) {
    const label = [song.artist, song.title].filter(Boolean).join(" – ");
    try {
      const videoId = await findVideoId(youtube, song);
      if (!videoId) {
        console.warn(`[warn] no video found for "${label}" — skipped`);
        continue;
      }
      await youtube.playlistItems.insert({
        part: ["snippet"],
        requestBody: {
          snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } },
        },
      });
      console.log(`Added "${label}" (${videoId})`);
    } catch (err) {
      console.warn(`[warn] failed to add "${label}": ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
