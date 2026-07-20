# Indie Weekly

A static site that surfaces trending songs from indie-leaning bands, rebuilt automatically every week. Deployed on GitHub Pages, updated by a GitHub Actions cron job.

(日本語版: [README.ja.md](README.ja.md))

## How "Japanese indie-leaning band" is defined (v2)

The site is currently scoped to **Japanese bands only**, sourced from three Japan-based music media outlets (`config/blogs.json`): [Spincoaster](https://spincoaster.com/) (indie/R&B/hip-hop leaning), [ROCKIN'ON JAPAN](https://rockinon.com/)'s news feed (broader rock scene, including the live-house/college-band touring circuit), and [Gekirock](https://gekirock.com/) (harder rock/metal/visual-kei leaning). All three happen to use a compatible headline convention.

- A song qualifies if a source posted about it within the last `lookbackDays` (21, configurable) **and** it used the release-announcement phrasing these outlets share — a title containing 新曲/ニューシングル/シングル/コラボ曲/楽曲 immediately followed by a quoted song title. Spincoaster/ROCKIN'ON JAPAN use curly quotes (“…”) for songs; Gekirock uses corner brackets (「…」); both patterns are accepted (`JP_ARTIST_TITLE` in `scripts/lib/extract.js`). All three reserve 『』 for album/EP/event names, so this reliably filters out tour announcements, festival lineups, and album-only posts.
- **Nationality filter (heuristic):** all feeds cover Japanese and overseas artists together, so any post whose raw title contains one of the `excludeKeywords` in `config/blogs.json` (country/city names, "来日", etc.) is treated as non-Japanese and skipped. This is a keyword blocklist, not a real nationality check — it can both over-exclude (e.g. a Japanese artist's post that happens to mention a foreign collaborator's country) and under-exclude (an overseas artist whose post doesn't mention a recognizable place name, or an obviously-foreign artist name like "MARILYN MANSON" that just doesn't happen to mention a country). Tune the list as you spot misses.
- **Major-label/veteran-artist filter (manual safety net):** ROCKIN'ON JAPAN and Gekirock both also cover big mainstream/international names (King Gnu, Ado, Mrs. GREEN APPLE, MARILYN MANSON, GREEN DAY, etc.) using the same release-announcement phrasing, which would otherwise pass every other filter. `excludeArtists` in `config/blogs.json` is a plain artist-name blocklist to keep those out — add to it as you spot more. (The view-velocity/subscriber-ratio metric used for the 🎓 tab below also naturally deprioritizes most such acts since their huge subscriber base absorbs any view spike — but it's not foolproof: if the YouTube search fallback attaches the wrong channel to a song, an artist can get a misleadingly high ratio. `excludeArtists` catches what the ratio misses.)
- Ranked by number of distinct sources, then recency.

**On the 50-song target and ~10-per-tab:** `maxSongsPerWeek` is set to 50, but that's a ceiling, not a guarantee — actual weekly output depends on how many qualifying posts these sources publish in the lookback window. In testing this has been in the ~20/week range across all three sources combined. Since each song is claimed by only one tab (see Categories below), 4 tabs × ~10 songs would need roughly 40 unique songs/week — with ~20/week, some tabs (currently 🌱若手バンド and ⭐いま売れている) end up thin most weeks, since 🔥急上昇 and 🎓大学生世代に人気 claim songs first. This is a real data-volume ceiling, not a bug: getting closer to ~10/tab consistently needs either more qualifying sources added to `config/blogs.json`, or relaxing the one-tab-per-song rule for some tab pairs.

This is a heuristic, not a strict rule — you said you'd tune it later. The easiest knobs:
- `config/blogs.json` — add/remove blogs, change `lookbackDays`, `maxSongsPerWeek`, `excludeKeywords`, `excludeArtists`, `newcomerKeywords`, `popularWithinDays`, `snsKeywords`, or `snsBuzzRatioThreshold`.
- `scripts/lib/extract.js` — the regex patterns that pull "Artist" and "Title" out of post headlines (`JP_ARTIST_TITLE`/`extractJpArtist` for the Japanese convention; `ARTIST_TITLE_DASH`/`ARTIST_SHARE_TITLE` are older English-blog patterns kept for reference but disabled whenever the title contains Japanese script).

## Categories on the site

The page shows four tabs instead of one long scrolling list (`🔥 急上昇` / `🎓 大学生世代に人気` / `🌱 若手バンド` / `⭐ いま売れている`), switchable client-side with no page reload (plain CSS/JS, no framework).

Each song appears in **at most one** tab. Categories are claimed in priority order — newcomer first, then youth/SNS, then surging, then popular — so the narrower/rarer signals get first pick and the broad "popular" catch-all fills in with whatever's left (see `categorize()` in `scripts/build_site.js`). With a small weekly song count, "popular" can end up empty some weeks if everything was already claimed by a more specific category — that's expected, not a bug.

- **🔥 急上昇 (surging this week)** — ranked by YouTube "view velocity" (view count ÷ days since the video was published), a proxy for how fast a song is gaining views. Requires `YOUTUBE_API_KEY` (see below); shows a placeholder note if not configured.
- **🎓 大学生世代に人気 (popular with college-age listeners)** — neither YouTube nor TikTok expose viewer-age demographics to third parties, so there's no direct way to measure this. Proxy instead: a song qualifies if (a) the post headline mentions an SNS/viral keyword (`snsKeywords` in `config/blogs.json`, e.g. Z世代/TikTok/バズ/バイラル), or (b) its view-velocity-to-subscriber-count ratio is at or above `snsBuzzRatioThreshold` (default 0.5) — i.e. it's getting disproportionately more views than its channel's usual subscriber base would predict, a common signature of something spreading via TikTok/SNS rather than an artist's existing fanbase. Ranked by that ratio.
- **🌱 若手バンド (notable young bands)** — there's no reliable free data source for actual band formation date, so this is a proxy: posts whose raw headline contains a debut-ish keyword (`newcomerKeywords` in `config/blogs.json`, e.g. デビュー/初シングル/1stアルバム). This is not a real "formed within 5 years" check.
- **⭐ いま売れている (currently popular)** — songs whose YouTube video was published within `popularWithinDays` (365, configurable), ranked by absolute view count. Also requires `YOUTUBE_API_KEY`.

**TikTok** was considered as a real data source too, but there's no practical free/legitimate API access for it (official API requires business/app review; scraping would violate ToS and break constantly), so each song instead gets a plain TikTok search link (`tiktokUrl` field) rather than real view-count data.

### Enabling YouTube stats (view count / subscriber count)

This is a separate, simpler credential from the YouTube *upload* OAuth setup below — just a plain API key, read-only, no consent screen:

1. In [Google Cloud Console](https://console.cloud.google.com/) (same project as below is fine), go to **APIs & Services → Library**, search **YouTube Data API v3**, and enable it.
2. **APIs & Services → Credentials → + Create Credentials → API key**.
3. (Recommended) Restrict the key to "YouTube Data API v3" only.
4. Add it as a GitHub repo secret: **Settings → Secrets and variables → Actions → New repository secret**, name `YOUTUBE_API_KEY`. The workflow already passes it through to the fetch step. For local runs, set it as an environment variable instead: `YOUTUBE_API_KEY=xxx npm run fetch`.

Without this key, `fetch_songs.js` still runs fine — songs just get `youtube: null` and the surging/popular sections show a "not configured" note.

**Quota note:** each song without an embedded video ID triggers one YouTube `search` call (100 quota units; free daily quota is 10,000), so up to ~100 such songs/day is safe. Video/channel stats lookups are batched and cost far less.

## How it works

```
config/blogs.json              curated blog RSS feeds + tuning knobs (blogs, lookbackDays, maxSongsPerWeek, excludeKeywords, newcomerKeywords, popularWithinDays)
scripts/fetch_songs.js         pulls feeds, extracts artist/title, filters, ranks, enriches with YouTube stats, writes data/weekly/<monday>.json
scripts/lib/youtube_stats.js   read-only YouTube Data API client (view/subscriber counts, video search fallback) — needs YOUTUBE_API_KEY
scripts/build_site.js          renders data/weekly/*.json into public/ (static HTML, split into the 3 categories below)
scripts/upload_youtube_playlist.js   posts the week's songs as a YouTube playlist (see below)
scripts/weekly_local_run.js     local one-shot pipeline (kept as a manual fallback — see below): fetch -> build -> commit -> push -> deploy -> (optional) YouTube upload
.github/workflows/weekly-update.yml  GitHub Actions equivalent of the above — the active automation path
```

**Known limitation:** RSS feeds usually only include a short excerpt of each post, not the full article, so embedded YouTube videos in the original post aren't always present in the feed content. Songs without a detected video show a "search on YouTube" link instead of a playable embed.

## Publishing: GitHub Actions

GitHub Actions was blocked for a while on this account right after the repo was created (jobs stuck in `queued`/`Startup failure` — looked like new-account anti-abuse review, not a problem with this repo's workflow file). It has since started working, so **Actions is the active automation path**:

- **Hosting:** GitHub Pages, source = **GitHub Actions** (Settings → Pages). The workflow's `deploy-pages` step handles publishing directly — no `gh-pages` branch involved.
- **Schedule:** runs every Monday 03:00 UTC (`workflow_dispatch` also available for manual runs from the **Actions** tab).
- **Required secrets** (Settings → Secrets and variables → Actions): `YOUTUBE_API_KEY` for view/subscriber stats (see above), and optionally `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`/`YOUTUBE_REFRESH_TOKEN` for playlist auto-posting (see below).
- **Don't run both Actions and the local pipeline on a recurring schedule at the same time** — if you set up Windows Task Scheduler earlier while Actions was blocked, disable/remove that scheduled task now to avoid the two racing to push data/deploy the site. `scripts/weekly_local_run.js` and `npm run deploy` (gh-pages branch) are still fine to use as manual one-off tools (e.g. testing changes before pushing), just not as a second recurring scheduler.

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
