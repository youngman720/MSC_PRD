# Indie Weekly

A static site that surfaces trending songs from indie-leaning bands, rebuilt automatically every week. Deployed on GitHub Pages, updated by a GitHub Actions cron job.

(日本語版: [README.ja.md](README.ja.md))

## How "indie-leaning" is defined (v1)

There's no clean API for "indie" as a genre, so this project defines it structurally instead of by tag/genre metadata:

- A song qualifies only if it was **covered by one of the curated independent-focused music blogs** in `config/blogs.json` (see that file for the current list — Gorilla vs. Bear, So Young Magazine, The Line of Best Fit, Beats Per Minute, Brooklyn Vegan). These were chosen because they focus on emerging/unsigned/small-label acts rather than major-label promotion.
- "Recently trending" = posted by one of those blogs within the last `lookbackDays` (10, configurable), ranked by:
  1. Number of distinct blogs that covered it (cross-blog corroboration), then
  2. Recency.
- Stereogum was deliberately left out of the default list after testing — its main feed covers general/major-label music news (e.g. Martin Garrix, Leon Bridges, The Killers) too broadly for this filter.

This is a heuristic, not a strict rule — you said you'd tune it later. The two easiest knobs:
- `config/blogs.json` — add/remove blogs, change `lookbackDays` or `maxSongsPerWeek`.
- `scripts/lib/extract.js` — the regex patterns that pull "Artist" and "Title" out of blog post headlines.

## How it works

```
config/blogs.json              curated blog RSS feeds + tuning knobs
scripts/fetch_songs.js         pulls feeds, extracts artist/title, ranks, writes data/weekly/<monday>.json
scripts/build_site.js          renders data/weekly/*.json into public/ (static HTML)
scripts/upload_youtube_playlist.js   posts the week's songs as a YouTube playlist (see below)
.github/workflows/weekly-update.yml  runs the above every Monday, commits data, deploys to Pages
```

Song matching is heuristic (regex over blog post titles like `"Artist – Title"` or `"Artist announce ..., share new single 'Title'"`). Expect some noise — false positives/misses are easiest to fix by adjusting `scripts/lib/extract.js`.

**Known limitation:** RSS feeds usually only include a short excerpt of each post, not the full article, so embedded YouTube videos in the original post are rarely present in the feed content. Most songs will show a "search on YouTube" link instead of a playable embed. Fetching full article pages to find embeds would fix this but isn't implemented yet.

## One-time setup

1. Create a GitHub repo and push this project to it.
2. In the repo, go to **Settings → Pages → Source** and select **GitHub Actions**.
3. That's it — the workflow runs automatically every Monday (03:00 UTC), or trigger it manually from the **Actions** tab (**Weekly indie update → Run workflow**) to test it immediately.

## Local development

```
npm install
npm run fetch   # writes data/weekly/<monday>.json
npm run build   # generates public/ — open public/index.html in a browser
```

## YouTube auto-posting (not yet enabled)

The upload script (`scripts/upload_youtube_playlist.js`) is fully implemented and already wired into the weekly workflow, but it **no-ops safely** until you provide credentials — nothing will be posted until you complete this setup:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **YouTube Data API v3**.
2. Configure the **OAuth consent screen** (External is fine; add your own Google account as a test user if the app stays in "Testing" status).
3. Create an **OAuth client ID** of type **Desktop app**. Note the client ID and client secret.
4. Locally (not in CI), run:
   ```
   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npm run get-youtube-token
   ```
   Open the printed URL, sign in with **the YouTube channel/account you want playlists posted to**, and approve access. The script prints a `refresh_token`.
5. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`
6. Re-run the workflow (or wait for next Monday). A new playlist named `Indie Weekly – <date>` will be created as **unlisted** by default (change via the `PLAYLIST_PRIVACY` env var in the workflow, e.g. to `public`).

Songs without a detected YouTube video ID are looked up via YouTube search at upload time, so results may occasionally be a fan upload/lyric video rather than the official one — worth spot-checking playlists early on.
