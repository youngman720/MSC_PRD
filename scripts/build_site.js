import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "weekly");
const OUT_DIR = path.join(ROOT, "public");

const SITE_TITLE = "Indie Weekly";
const SITE_TAGLINE = "Songs from indie-leaning bands, surfaced weekly from independent music blogs.";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function formatWeekLabel(weekOf) {
  const d = new Date(`${weekOf}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

async function loadWeeks() {
  let files = [];
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }
  const weeks = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    weeks.push(JSON.parse(raw));
  }
  weeks.sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1));
  return weeks;
}

function styleBlock() {
  return `
  :root {
    color-scheme: light dark;
    --bg: #fafafa; --fg: #1a1a1a; --muted: #666; --card: #fff; --border: #e5e5e5; --accent: #d64545;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --fg: #eee; --muted: #999; --card: #1c1c1c; --border: #2a2a2a; --accent: #ff6b6b; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.5; }
  .wrap { max-width: 780px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  header.site { margin-bottom: 2rem; }
  header.site h1 { font-size: 1.9rem; margin: 0 0 0.25rem; }
  header.site p { color: var(--muted); margin: 0; }
  header.site nav { margin-top: 1rem; font-size: 0.9rem; }
  header.site nav a { color: var(--accent); text-decoration: none; }
  h2.week { font-size: 1.2rem; margin: 0 0 1.25rem; color: var(--muted); font-weight: 600; }
  .song { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.1rem; margin-bottom: 1rem; }
  .song h3 { margin: 0 0 0.15rem; font-size: 1.05rem; }
  .song .artist { color: var(--muted); font-size: 0.95rem; margin: 0 0 0.6rem; }
  .song iframe { width: 100%; aspect-ratio: 16/9; border: 0; border-radius: 6px; }
  .sources { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }
  .sources a { color: inherit; }
  .no-video { font-size: 0.85rem; }
  .no-video a { color: var(--accent); }
  footer { margin-top: 3rem; color: var(--muted); font-size: 0.8rem; }
  `;
}

function songCard(song) {
  const artistLine = song.artist ? `<p class="artist">${escapeHtml(song.artist)}</p>` : "";
  const media = song.youtubeId
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(song.youtubeId)}" title="${escapeHtml(song.title)}" allowfullscreen loading="lazy"></iframe>`
    : `<p class="no-video">No video found yet — <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((song.artist ? song.artist + " " : "") + song.title)}" target="_blank" rel="noopener">search on YouTube</a></p>`;
  const sources = song.sources
    .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.blog)}</a>`)
    .join(" · ");
  return `
  <article class="song">
    <h3>${escapeHtml(song.title)}</h3>
    ${artistLine}
    ${media}
    <p class="sources">Spotted on: ${sources}</p>
  </article>`;
}

function pageShell({ title, body, nav }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${styleBlock()}</style>
</head>
<body>
<div class="wrap">
<header class="site">
  <h1>${SITE_TITLE}</h1>
  <p>${SITE_TAGLINE}</p>
  <nav>${nav}</nav>
</header>
${body}
<footer>Auto-generated weekly. Song picks are curated from independent music blog coverage, not label promotion.</footer>
</div>
</body>
</html>`;
}

function weekBody(week) {
  const label = formatWeekLabel(week.weekOf);
  if (week.songs.length === 0) {
    return `<h2 class="week">Week of ${label}</h2><p>No qualifying songs found this week.</p>`;
  }
  return `<h2 class="week">Week of ${label}</h2>` + week.songs.map(songCard).join("\n");
}

async function main() {
  const weeks = await loadWeeks();
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT_DIR, "archive"), { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, ".nojekyll"), "", "utf-8");

  const nav = `<a href="./">Latest</a> · <a href="./archive/">Archive</a>`;

  if (weeks.length > 0) {
    const latest = weeks[0];
    const html = pageShell({ title: SITE_TITLE, body: weekBody(latest), nav });
    await fs.writeFile(path.join(OUT_DIR, "index.html"), html, "utf-8");
  } else {
    const html = pageShell({ title: SITE_TITLE, body: "<p>No data yet. Run the weekly fetch to populate this site.</p>", nav });
    await fs.writeFile(path.join(OUT_DIR, "index.html"), html, "utf-8");
  }

  for (const week of weeks) {
    const html = pageShell({ title: `${SITE_TITLE} – ${week.weekOf}`, body: weekBody(week), nav });
    await fs.writeFile(path.join(OUT_DIR, "archive", `${week.weekOf}.html`), html, "utf-8");
  }

  const archiveList = weeks
    .map((w) => `<li><a href="./${w.weekOf}.html">Week of ${escapeHtml(formatWeekLabel(w.weekOf))}</a> (${w.songs.length} songs)</li>`)
    .join("\n");
  const archiveHtml = pageShell({
    title: `${SITE_TITLE} – Archive`,
    body: `<h2 class="week">All weeks</h2><ul>${archiveList || "<li>No archived weeks yet.</li>"}</ul>`,
    nav,
  });
  await fs.writeFile(path.join(OUT_DIR, "archive", "index.html"), archiveHtml, "utf-8");

  console.log(`Built site: ${weeks.length} week(s) into ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
