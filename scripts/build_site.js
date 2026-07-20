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

function formatCount(n) {
  if (n == null) return null;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString("en-US");
}

async function loadConfig() {
  const raw = await fs.readFile(path.join(ROOT, "config", "blogs.json"), "utf-8");
  return JSON.parse(raw);
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
  p.week-label { font-size: 0.95rem; margin: 0 0 1.5rem; color: var(--muted); }
  h2.week { font-size: 1.2rem; margin: 0 0 1.25rem; color: var(--muted); font-weight: 600; }
  p.empty-note { color: var(--muted); font-size: 0.9rem; }
  .tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
  .tab-btn { font: inherit; cursor: pointer; background: transparent; border: 1px solid var(--border); color: var(--fg); padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.85rem; }
  .tab-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .tab-panel[hidden] { display: none; }
  .song { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.1rem; margin-bottom: 1rem; }
  .song h3 { margin: 0 0 0.15rem; font-size: 1.05rem; }
  .song .artist { color: var(--muted); font-size: 0.95rem; margin: 0 0 0.6rem; }
  .badge { display: inline-block; background: var(--accent); color: #fff; font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 999px; margin-left: 0.4rem; vertical-align: middle; }
  .badge-sns { background: #4a7fd6; }
  .badge-circuit { background: #2f9e5c; }
  .song iframe { width: 100%; aspect-ratio: 16/9; border: 0; border-radius: 6px; }
  .stats { font-size: 0.8rem; color: var(--muted); margin: 0.5rem 0 0; }
  .sources { font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; }
  .sources a { color: inherit; }
  .no-video { font-size: 0.85rem; }
  .no-video a, .stats a { color: var(--accent); }
  footer { margin-top: 3rem; color: var(--muted); font-size: 0.8rem; }
  `;
}

function songCard(song) {
  const badges = [
    song.newcomer ? '<span class="badge">新人</span>' : "",
    song.snsBuzz ? '<span class="badge badge-sns">SNSで話題</span>' : "",
    song.inCircuitScene ? '<span class="badge badge-circuit">対バンシーン出演実績</span>' : "",
  ].join("");
  const artistLine = song.artist ? `<p class="artist">${escapeHtml(song.artist)}${badges}</p>` : "";
  const videoId = song.youtube?.videoId || song.youtubeId;
  const media = videoId
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" title="${escapeHtml(song.title)}" allowfullscreen loading="lazy"></iframe>`
    : `<p class="no-video">No video found yet — <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((song.artist ? song.artist + " " : "") + song.title)}" target="_blank" rel="noopener">search on YouTube</a></p>`;

  const statsParts = [];
  if (song.youtube) {
    statsParts.push(`再生数 ${formatCount(song.youtube.viewCount)}回`);
    if (song.youtube.channelSubscriberCount != null) {
      statsParts.push(`登録者数 ${formatCount(song.youtube.channelSubscriberCount)}人`);
    }
  }
  if (song.tiktokUrl) {
    statsParts.push(`<a href="${escapeHtml(song.tiktokUrl)}" target="_blank" rel="noopener">TikTokで検索</a>`);
  }
  const stats = statsParts.length ? `<p class="stats">${statsParts.join(" ・ ")}</p>` : "";

  const sources = song.sources
    .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.blog)}</a>`)
    .join(" · ");
  return `
  <article class="song">
    <h3>${escapeHtml(song.title)}</h3>
    ${artistLine}
    ${media}
    ${stats}
    <p class="sources">Spotted on: ${sources}</p>
  </article>`;
}

function velocityRatio(song) {
  const subs = song.youtube?.channelSubscriberCount;
  if (!song.youtube || !subs) return 0;
  return song.youtube.viewVelocity / Math.max(subs, 1);
}

// Categories are claimed in priority order so a song only shows up in one tab: the narrower,
// harder-to-satisfy signals (newcomer, SNS breakout) get first pick, then the broader
// velocity/absolute-popularity rankings fill in with whatever's left.
function categorize(songs, config, referenceDate) {
  const withStats = songs.filter((s) => s.youtube);
  const hasStats = withStats.length > 0;
  const claimed = new Set();
  const unclaimed = (list) => list.filter((s) => !claimed.has(s));
  const claim = (list) => {
    list.forEach((s) => claimed.add(s));
    return list;
  };

  const newcomers = claim(
    unclaimed(songs.filter((s) => s.newcomer))
      .sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen))
      .slice(0, 10)
  );

  const buzzThreshold = config.snsBuzzRatioThreshold ?? 0.5;
  const youth = claim(
    unclaimed(withStats.filter((s) => s.snsBuzz || velocityRatio(s) >= buzzThreshold))
      .sort((a, b) => velocityRatio(b) - velocityRatio(a))
      .slice(0, 10)
  );

  const surging = claim(
    unclaimed(withStats)
      .sort((a, b) => b.youtube.viewVelocity - a.youtube.viewVelocity)
      .slice(0, 10)
  );

  const popularWithinDays = config.popularWithinDays ?? 365;
  const popularCutoff = referenceDate.getTime() - popularWithinDays * 24 * 60 * 60 * 1000;
  const popular = claim(
    unclaimed(withStats)
      .filter((s) => new Date(s.youtube.publishedAt).getTime() >= popularCutoff)
      .sort((a, b) => b.youtube.viewCount - a.youtube.viewCount)
      .slice(0, 10)
  );

  return { hasStats, newcomers, youth, surging, popular };
}

function tabPanel(id, list, emptyNote, active) {
  const body = list.length ? list.map(songCard).join("\n") : `<p class="empty-note">${emptyNote}</p>`;
  return `<div class="tab-panel" id="panel-${id}" role="tabpanel" ${active ? "" : "hidden"}>${body}</div>`;
}

function tabButton(id, label, active) {
  return `<button type="button" class="tab-btn${active ? " active" : ""}" data-tab="${id}" role="tab" aria-selected="${active}">${label}</button>`;
}

const TAB_SCRIPT = `
document.querySelectorAll('.tabs').forEach(function (tabs) {
  tabs.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      var panels = tabs.parentElement.querySelectorAll('.tab-panel');
      panels.forEach(function (p) { p.hidden = true; });
      document.getElementById('panel-' + btn.dataset.tab).hidden = false;
    });
  });
});
`;

function weekBody(week, config) {
  const label = formatWeekLabel(week.weekOf);
  if (week.songs.length === 0) {
    return `<h2 class="week">Week of ${label}</h2><p>No qualifying songs found this week.</p>`;
  }

  const referenceDate = new Date(week.generatedAt);
  const { hasStats, newcomers, youth, surging, popular } = categorize(week.songs, config, referenceDate);
  const noStatsNote = "YouTube APIキーが未設定のため、この項目は表示できません（README参照）。";

  const tabs = [
    { id: "surging", label: "🔥 急上昇", list: surging, emptyNote: hasStats ? "対象曲がありませんでした。" : noStatsNote },
    { id: "youth", label: "🎓 大学生世代に人気", list: youth, emptyNote: hasStats ? "対象曲がありませんでした（SNSでの話題性/伸び率で判定）。" : noStatsNote },
    { id: "newcomer", label: "🌱 若手バンド", list: newcomers, emptyNote: "対象曲が見つかりませんでした（デビュー/初シングル等のキーワード検出）。" },
    { id: "popular", label: "⭐ いま売れている", list: popular, emptyNote: hasStats ? "対象曲がありませんでした。" : noStatsNote },
  ];

  return [
    `<p class="week-label">Week of ${label}</p>`,
    `<div class="tabs" role="tablist">${tabs.map((t, i) => tabButton(t.id, t.label, i === 0)).join("")}</div>`,
    tabs.map((t, i) => tabPanel(t.id, t.list, t.emptyNote, i === 0)).join("\n"),
  ].join("\n");
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
<script>${TAB_SCRIPT}</script>
</body>
</html>`;
}

async function main() {
  const config = await loadConfig();
  const weeks = await loadWeeks();
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT_DIR, "archive"), { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, ".nojekyll"), "", "utf-8");

  const nav = `<a href="./">Latest</a> · <a href="./archive/">Archive</a>`;

  if (weeks.length > 0) {
    const latest = weeks[0];
    const html = pageShell({ title: SITE_TITLE, body: weekBody(latest, config), nav });
    await fs.writeFile(path.join(OUT_DIR, "index.html"), html, "utf-8");
  } else {
    const html = pageShell({ title: SITE_TITLE, body: "<p>No data yet. Run the weekly fetch to populate this site.</p>", nav });
    await fs.writeFile(path.join(OUT_DIR, "index.html"), html, "utf-8");
  }

  for (const week of weeks) {
    const html = pageShell({ title: `${SITE_TITLE} – ${week.weekOf}`, body: weekBody(week, config), nav });
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
