const LEAD_TAGS =
  /^(track premiere|song premiere|video premiere|premiere|listen|watch|stream|new music|new song|new video)\s*:\s*/i;

// Posts in these categories aren't single-song premieres (album/EP reviews, interviews, tour
// announcements, retrospectives, etc.) — extracting an "artist/title" from them would misrepresent
// an album name or feature topic as a song.
const NON_SONG_POST =
  /^(album review|ep review|live review|mixtape review|track[- ]by[- ]track|interview|playlist|best of|year[- ]in[- ]review|tour (news|dates)|.*\btour\b.*:)/i;

// Dash must be flanked by whitespace so mid-word/mid-name hyphens (e.g. "Jay-Z", "No-Shows") don't
// get misread as an "Artist - Title" separator.
const ARTIST_TITLE_DASH =
  /^([^–—-]{2,60}?)\s[–—-]\s["'“‘]?([^"'”’]{2,120})["'”’]?\s*$/;

const SHARE_VERB_WORDS =
  "share|shares|shared|drop|drops|dropped|release|releases|released|unveil|unveils|unveiled|premiere|premieres|premiered|announce|announces|announced|debut|debuts|debuted";

const SHARE_VERBS = new RegExp(`\\b(?:${SHARE_VERB_WORDS})\\b`, "i");

// Artist must be immediately followed by the verb (no arbitrary text in between), otherwise lazy
// matching grabs only the first word or two of a multi-word band name (e.g. "Stand" instead of
// "Stand Atlantic" from "Stand Atlantic announce ... share new single 'LUCID'").
const ARTIST_SHARE_TITLE = new RegExp(
  `^(.{2,60}?)\\s+(?:${SHARE_VERB_WORDS})\\b.*?["'“‘]([^"'”’]{2,120})["'”’]`,
  "i"
);

function stripLeadTags(title) {
  return title.replace(LEAD_TAGS, "").trim();
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeKey(str) {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function trimPunctuation(str) {
  return str.trim().replace(/^[,.;:\s]+/, "").replace(/[,.;:\s]+$/, "");
}

function parseArtistTitle(rawTitle) {
  if (NON_SONG_POST.test(rawTitle)) {
    return { artist: null, title: rawTitle.trim(), confident: false };
  }

  const title = stripLeadTags(rawTitle);

  let m = title.match(ARTIST_TITLE_DASH);
  if (m) {
    return { artist: trimPunctuation(m[1]), title: trimPunctuation(m[2]), confident: true };
  }

  if (SHARE_VERBS.test(title)) {
    m = title.match(ARTIST_SHARE_TITLE);
    if (m) {
      return { artist: trimPunctuation(m[1]), title: trimPunctuation(m[2]), confident: true };
    }
  }

  return { artist: null, title: title.trim(), confident: false };
}

const YOUTUBE_PATTERNS = [
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

function extractYoutubeId(html) {
  if (!html) return null;
  for (const pattern of YOUTUBE_PATTERNS) {
    const m = html.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function dedupeKey(parsed) {
  if (parsed.artist) {
    return normalizeKey(`${parsed.artist} ${parsed.title}`);
  }
  return normalizeKey(parsed.title);
}

export { parseArtistTitle, extractYoutubeId, normalizeKey, dedupeKey };
