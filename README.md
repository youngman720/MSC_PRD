# Indie Weekly

A static site that surfaces trending songs from indie-leaning bands, rebuilt automatically every week. Deployed on GitHub Pages, updated by a GitHub Actions cron job.

(日本語版: [README.ja.md](README.ja.md))

## How "Japanese indie-leaning band" is defined (v2)

The site is currently scoped to **Japanese bands only**, sourced from three Japan-based RSS music media outlets plus one non-RSS source (`config/blogs.json`): [Spincoaster](https://spincoaster.com/) (indie/R&B/hip-hop leaning), [ROCKIN'ON JAPAN](https://rockinon.com/)'s news feed (broader rock scene, including the live-house/college-band touring circuit), [BARKS](https://barks.jp/) (broad but low volume), and [eggs.mu](https://eggs.mu/)'s daily song ranking (scraped, no RSS available — see below).

- A song from an **RSS source** qualifies if it was posted within the last `lookbackDays` (21, configurable) **and** used the release-announcement phrasing these outlets share — a title containing 新曲/ニューシングル/シングル/コラボ曲/楽曲 immediately followed by a curly-quoted (“…”) song title (`JP_ARTIST_TITLE` in `scripts/lib/extract.js`; corner brackets 「…」 are also accepted as a song-title delimiter for any future source that uses that convention instead). All of them reserve 『』 for album/EP/event names, so this reliably filters out tour announcements, festival lineups, and album-only posts.
- **eggs.mu (`scripts/lib/eggs.js`)** is different: it's a distribution platform exclusively for independent/unsigned Japanese artists (there's no RSS feed, so this scrapes the server-rendered daily song ranking page directly via a small regex over the artist/song link pairs — no headless browser needed). Because everything on it is indie/Japanese by construction, it skips the nationality and newcomer-keyword checks entirely and every entry is flagged as a newcomer for the 🌱 tab. This was the single biggest lever for filling out that tab (it was passing ~1 song/week before, ~10 after). One caveat found in testing: the daily ranking isn't *purely* obscure bedroom acts — an established major-label artist's song showed up in it once, which forces `newcomer: true` even though "newcomer" doesn't really fit. Rare, and not worth special-casing yet.
- **Circuit-scene validation + minimum-plays quality gate:** eggs.mu has no editorial curation behind it (it's a raw popularity ranking of unsigned uploads), so an eggs-only entry can be genuinely obscure — this was flagged directly as a precision problem after a week of real use. Each song's artist is checked against `config/circuit_artists.json` — a curated allowlist compiled from real touring live-house circuit event lineups and TV/web programs that specifically discover young Japanese bands (currently 見放題東京2026, MINAMI WHEEL 2026's 1st lineup, and 音いたち — see the file for source links and add more as they're found) — and flagged `inCircuitScene` (shown as a "対バンシーン出演実績" badge on the site). An eggs-only song is then **dropped** unless it's either `inCircuitScene` or has at least `eggs.minViewCount` (default 1000) YouTube views — this needs `YOUTUBE_API_KEY` to evaluate; without it, the filter is skipped entirely (logged) rather than guessing. This check only applies to songs sourced *exclusively* from eggs.mu — anything also corroborated by an RSS source is trusted already.
- **Nationality filter, two independent checks:**
  1. *Keyword check (all RSS sources):* any post whose raw title contains one of the `excludeKeywords` in `config/blogs.json` (country/city names, "来日", etc.) is treated as non-Japanese and skipped. This only catches a foreign act when the headline itself happens to mention a place — it does nothing for a name like "Tom Morello" or "FROM FIRST TO LAST" with no geographic reference at all.
  2. *YouTube channel country check (needs `YOUTUBE_API_KEY`):* after resolving each song's video, the channel's own declared country (`snippet.country`, when the owner set it) is checked — if it's set and isn't `JP`, the song is dropped regardless of source. This is real structural data instead of a text guess, so it catches cases the keyword check can't (it caught "Tom Morello" and an MGK collab in testing) — but it isn't complete either, since not every channel declares a country (e.g. it missed "FROM FIRST TO LAST", whose channel has no country set). A missing/unset country is never treated as evidence of anything, only an explicit non-`JP` value excludes.
  3. Between the two, **Gekirock was tried as a 4th source and then removed**: it structurally covers Western rock/metal using the exact same release-announcement phrasing as Japanese acts, and kept leaking foreign artists (Tom Morello, MGK, FROM FIRST TO LAST) past both checks for very little genuine Japanese-scene content in return — the ongoing `excludeArtists` maintenance wasn't worth it for that source specifically.
- **Major-label/veteran-artist filter (manual safety net):** ROCKIN'ON JAPAN and BARKS both also cover big mainstream/idol names (King Gnu, Ado, Mrs. GREEN APPLE, JO1, etc.) using the same release-announcement phrasing, which would otherwise pass every other filter. `excludeArtists` in `config/blogs.json` is a plain artist-name blocklist to keep those out — add to it as you spot more. (The view-velocity/subscriber-ratio metric used for the 🎓 tab also naturally deprioritizes most such acts since their huge subscriber base absorbs any view spike — but it's not foolproof: if the YouTube search fallback attaches the wrong channel to a song, an artist can get a misleadingly high ratio. `excludeArtists` catches what the ratio misses.)
- Ranked by number of distinct sources, then recency.

**Minimum view-count floors (🔥/🎓/⭐):** a pure ranking metric with no absolute floor can put a song with a handful of views into "surging" just because nothing else was left to compete against it — this happened in practice (a 23-view song briefly appeared in 🔥急上昇) and reads as broken rather than trending. `surgingMinViewCount` and `popularMinViewCount` (both default 10000) gate the 🔥 and ⭐ tabs; `youthMinViewCount` (default 1000) gates 🎓. Raising the bar for 🔥/⭐ means those tabs will more often be thin or empty in a given week — that's the accepted trade-off for not showing near-zero-view songs as "trending."

**On the 50-song target and ~10-per-tab:** `maxSongsPerWeek` is set to 50, but that's a ceiling, not a guarantee — actual weekly output depends on how many qualifying posts/rankings these sources publish in the lookback window, how many survive the nationality checks above, and now also on how many eggs.mu entries pass the circuit-scene/minimum-plays quality gate and how many songs clear the view-count floors. Since each song is claimed by only one tab (see Categories below), 4 tabs × ~10 songs needs roughly 40 unique songs clearing every filter — realistically, expect 🌱若手バンド to land near 10 most weeks (eggs.mu carries it), while 🔥急上昇/🎓大学生世代に人気/⭐いま売れている will vary a lot more week to week now that they require real view-count evidence. This is a real accuracy-vs-volume trade-off, not a bug: closing the gap further needs more qualifying sources with real audiences, not a lower bar.

This is a heuristic, not a strict rule — you said you'd tune it later. The easiest knobs:
- `config/blogs.json` — add/remove blogs, change `lookbackDays`, `maxSongsPerWeek`, `excludeKeywords`, `excludeArtists`, `newcomerKeywords`, `popularWithinDays`, `snsKeywords`, `snsBuzzRatioThreshold`, `surgingMinViewCount`, `popularMinViewCount`, `youthMinViewCount`, `eggs.enabled`/`eggs.limit`/`eggs.minViewCount`.
- `config/circuit_artists.json` — add more circuit-event lineups to the allowlist as they're announced (each entry just needs the artist name as it appears in the source; matching is case-insensitive and whitespace-insensitive but otherwise exact, so double-check spelling/spacing against the event's own listing).
- `scripts/lib/extract.js` — the regex patterns that pull "Artist" and "Title" out of post headlines (`JP_ARTIST_TITLE`/`extractJpArtist` for the Japanese convention; `ARTIST_TITLE_DASH`/`ARTIST_SHARE_TITLE` are older English-blog patterns kept for reference but disabled whenever the title contains Japanese script). `extractJpArtist` handles a few real messy cases found in testing: a lone hiragana particle stuck to the artist name (e.g. "PAS TASTAが" → "PAS TASTA"), a stylized parenthesized name (e.g. "(sic)boy"), and an artist name given in quotes mid-sentence instead of before the release verb (e.g. "...結成されたガールズ・バンド"終末のダイヤモンド"、デビュー..." → "終末のダイヤモンド"). If a new source produces a mis-parsed artist name, this is the file to extend.

## Categories on the site

The page shows four tabs instead of one long scrolling list (`🔥 急上昇` / `🎓 大学生世代に人気` / `🌱 若手バンド` / `⭐ いま売れている`), switchable client-side with no page reload (plain CSS/JS, no framework).

Each song appears in **at most one** tab. Categories are claimed in priority order — newcomer first, then youth/SNS, then surging, then popular — so the narrower/rarer signals get first pick and the broad "popular" catch-all fills in with whatever's left (see `categorize()` in `scripts/build_site.js`). With a small weekly song count, "popular" can end up empty some weeks if everything was already claimed by a more specific category — that's expected, not a bug.

- **🔥 急上昇 (surging this week)** — ranked by YouTube "view velocity" (view count ÷ days since the video was published) among songs with at least `surgingMinViewCount` (10000) views, a proxy for how fast a genuinely-watched song is gaining views. Requires `YOUTUBE_API_KEY` (see below); shows a placeholder note if not configured.
- **🎓 大学生世代に人気 (popular with college-age listeners)** — neither YouTube nor TikTok expose viewer-age demographics to third parties, so there's no direct way to measure this. Proxy instead: among songs with at least `youthMinViewCount` (1000) views, a song qualifies if (a) the post headline mentions an SNS/viral keyword (`snsKeywords` in `config/blogs.json`, e.g. Z世代/TikTok/バズ/バイラル), or (b) its view-velocity-to-subscriber-count ratio is at or above `snsBuzzRatioThreshold` (default 0.5) — i.e. it's getting disproportionately more views than its channel's usual subscriber base would predict, a common signature of something spreading via TikTok/SNS rather than an artist's existing fanbase. Ranked by that ratio.
- **🌱 若手バンド (notable young bands)** — there's no reliable free data source for actual band formation date, so this is a proxy: posts whose raw headline contains a debut-ish keyword (`newcomerKeywords` in `config/blogs.json`, e.g. デビュー/初シングル/1stアルバム), plus every eggs.mu entry that passes its own quality gate above. This is not a real "formed within 5 years" check.
- **⭐ いま売れている (currently popular)** — songs whose YouTube video was published within `popularWithinDays` (365, configurable) and has at least `popularMinViewCount` (10000) views, ranked by absolute view count. Also requires `YOUTUBE_API_KEY`.

**TikTok** was considered as a real data source too, but there's no practical free/legitimate API access for it (official API requires business/app review; scraping would violate ToS and break constantly), so each song instead gets a plain TikTok search link (`tiktokUrl` field) rather than real view-count data.

## Other Japanese music media considered and not added

Beyond the sources above, these were specifically investigated and rejected — noted here so they aren't re-researched from scratch later:

- **バズリズム02** (Nippon TV) — a broadcast TV program, not a website with articles; no feed or scrapable "new song" listing found.
- **FM802** — the station's own site (fm802.com) has no discoverable RSS feed. Its MINAMI WHEEL circuit event lineup is already used (see `config/circuit_artists.json`).
- **Skream!** (skream.jp) — no RSS feed found on the site.
- **Rock is** (rock-is.tv) — has a WordPress-style feed URL, but the site itself stopped publishing new articles in December 2019; the feed is effectively dead (one placeholder item from 2017).
- **ジロッケン / 環七フィーバーズNEO** — thematically a perfect fit ("次世代ミュージシャン発掘・応援番組", discovering young bands), and has a YouTube channel (`UCyk-Bg0YfcbUd2D28Bd2i8A`, usable as an RSS feed via `youtube.com/feeds/videos.xml?channel_id=...`), but the channel's last upload was January 2024 — inactive, not usable for "recent" content.
- **音いたち** (関西テレビ) — actively updating (weekly episodes), and does feature the right kind of young/emerging artists, but each episode page is an artist *profile/bio*, not a "new song release" announcement — there's no consistent "artist + specific song" pair to extract the way the RSS sources or eggs.mu provide. Used instead as a source of more names for `config/circuit_artists.json` (manually pulled from a few recent episodes) rather than as a weekly song feed.

### Enabling YouTube stats (view count / subscriber count)

This is a separate, simpler credential from the YouTube *upload* OAuth setup below — just a plain API key, read-only, no consent screen:

1. In [Google Cloud Console](https://console.cloud.google.com/) (same project as below is fine), go to **APIs & Services → Library**, search **YouTube Data API v3**, and enable it.
2. **APIs & Services → Credentials → + Create Credentials → API key**.
3. (Recommended) Restrict the key to "YouTube Data API v3" only.
4. Add it as a GitHub repo secret: **Settings → Secrets and variables → Actions → New repository secret**, name `YOUTUBE_API_KEY`. The workflow already passes it through to the fetch step. For local runs, set it as an environment variable instead: `YOUTUBE_API_KEY=xxx npm run fetch`.

Without this key, `fetch_songs.js` still runs fine — songs just get `youtube: null` and the surging/popular sections show a "not configured" note.

**Quota note:** each song without an embedded video ID triggers one YouTube `search` call (100 quota units; free daily quota is 10,000), so up to ~100 such songs/day is safe. Video/channel stats lookups are batched and cost far less. If you run `npm run fetch` many times in one day while testing (as happened during development), you can exhaust the daily quota — searches then fail and those songs just get `youtube: null` for the rest of the day. It resets on its own (~daily, per Google's quota window), no action needed beyond waiting.

## How it works

```
config/blogs.json              curated RSS feeds + tuning knobs (blogs, lookbackDays, maxSongsPerWeek, excludeKeywords, excludeArtists, newcomerKeywords, popularWithinDays, snsKeywords, snsBuzzRatioThreshold, eggs)
config/circuit_artists.json    allowlist of artists from real touring-circuit event lineups, used to validate eggs.mu-only songs
scripts/fetch_songs.js         pulls RSS feeds + eggs.mu ranking, extracts artist/title, filters, ranks, enriches with YouTube stats, applies the eggs-only quality gate, writes data/weekly/<monday>.json
scripts/lib/eggs.js             scrapes eggs.mu's daily song ranking (no RSS available) — Japan-only unsigned-artist platform, always flagged as newcomer
scripts/lib/youtube_stats.js   read-only YouTube Data API client (view/subscriber counts, video search fallback) — needs YOUTUBE_API_KEY
scripts/build_site.js          renders data/weekly/*.json into public/ (static HTML, split into the 4 tabs below)
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
