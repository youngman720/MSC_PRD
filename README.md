# Indie Weekly

A static site that surfaces trending songs from indie-leaning bands, rebuilt automatically every week. Deployed on GitHub Pages, updated by a GitHub Actions cron job.

(日本語版: [README.ja.md](README.ja.md))

## How "Japanese indie-leaning band" is defined (v2)

The site is currently scoped to **Japanese bands only**, sourced from [Spincoaster](https://spincoaster.com/) (`config/blogs.json`), a Japan-based music media outlet with an indie/emerging-artist editorial slant and a very active feed (multiple posts/day).

- A song qualifies if Spincoaster posted about it within the last `lookbackDays` (14, configurable) **and** it used their release-announcement phrasing — a title containing 新曲/ニューシングル/シングル/コラボ曲/楽曲 immediately followed by a curly-quoted (“…”) song title. Spincoaster uses 『』 for album/EP/event names and “…” specifically for song titles, so this reliably filters out tour announcements, festival lineups, and album-only posts.
- **Nationality filter (heuristic):** Spincoaster covers both Japanese and overseas artists in the same feed, so any post whose raw title contains one of the `excludeKeywords` in `config/blogs.json` (country/city names, "来日", etc.) is treated as non-Japanese and skipped. This is a keyword blocklist, not a real nationality check — it can both over-exclude (e.g. a Japanese artist's post that happens to mention a foreign collaborator's country) and under-exclude (an overseas artist whose post doesn't mention a recognizable place name). Tune the list as you spot misses.
- Ranked by number of distinct sources, then recency (currently there's only one source, so ranking is effectively by recency until more Japan-focused feeds are added).

**On the 50-song target:** `maxSongsPerWeek` is set to 50, but that's a ceiling, not a guarantee — actual weekly output depends on how many qualifying posts Spincoaster publishes in the lookback window. In testing this has been in the 15–20/week range. To get closer to 50 reliably, add more Japan-focused sources with a similar release-announcement convention to `config/blogs.json` (each new source needs its title format checked against `scripts/lib/extract.js`'s patterns, or a new pattern added).

This is a heuristic, not a strict rule — you said you'd tune it later. The easiest knobs:
- `config/blogs.json` — add/remove blogs, change `lookbackDays`, `maxSongsPerWeek`, or `excludeKeywords`.
- `scripts/lib/extract.js` — the regex patterns that pull "Artist" and "Title" out of post headlines (`JP_ARTIST_TITLE`/`extractJpArtist` for the Japanese convention; `ARTIST_TITLE_DASH`/`ARTIST_SHARE_TITLE` are older English-blog patterns kept for reference but disabled whenever the title contains Japanese script).

## How it works

```
config/blogs.json              curated blog RSS feeds + tuning knobs (blogs, lookbackDays, maxSongsPerWeek, excludeKeywords)
scripts/fetch_songs.js         pulls feeds, extracts artist/title, filters, ranks, writes data/weekly/<monday>.json
scripts/build_site.js          renders data/weekly/*.json into public/ (static HTML)
scripts/upload_youtube_playlist.js   posts the week's songs as a YouTube playlist (see below)
scripts/weekly_local_run.js     local one-shot pipeline: fetch -> build -> commit -> push -> deploy -> (optional) YouTube upload
.github/workflows/weekly-update.yml  GitHub Actions equivalent of the above (currently unused — see below)
```

**Known limitation:** RSS feeds usually only include a short excerpt of each post, not the full article, so embedded YouTube videos in the original post aren't always present in the feed content. Songs without a detected video show a "search on YouTube" link instead of a playable embed.

## Publishing: local run, not GitHub Actions

GitHub Actions was blocked on this account (jobs stuck in `queued`/`Startup failure` — looked like new-account anti-abuse review, not a problem with this repo's workflow file), so the working setup is:

- **Hosting:** GitHub Pages, source = **Deploy from a branch** → `gh-pages` (not "GitHub Actions"). Configure this once in **Settings → Pages**.
- **Publishing:** run `npm run weekly` locally, or set it up in **Windows Task Scheduler** to run weekly (see `README.ja.md`/repo notes for the exact steps already used). This does fetch → build → commit → push → `npm run deploy` (publishes `public/` to the `gh-pages` branch via the `gh-pages` package) → optional YouTube upload.
- `.github/workflows/weekly-update.yml` is kept in the repo in case Actions becomes usable on this account later, but it isn't the active path right now — don't expect it to run.

## Local development

```
npm install
npm run fetch     # writes data/weekly/<monday>.json
npm run build     # generates public/ — open public/index.html in a browser
npm run deploy    # publishes public/ to the gh-pages branch
npm run weekly    # runs all of the above plus git commit/push, in one go
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
