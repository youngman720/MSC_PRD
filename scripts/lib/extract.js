const LEAD_TAGS =
  /^(track premiere|song premiere|video premiere|premiere|listen|watch|stream|new music|new song|new video)\s*:\s*/i;

// Some Japanese outlets (e.g. ROCKIN'ON JAPAN's news feed) prefix every headline with a category
// label like "ニュース - " (News -) using a dash, not a colon, so it needs its own strip pattern.
const JP_LEAD_TAGS = /^ニュース\s*[-–—]\s*/;

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
  return title.replace(LEAD_TAGS, "").replace(JP_LEAD_TAGS, "").trim();
}

// Japanese music-news convention (e.g. Spincoaster): song titles are wrapped in curly double quotes
// (“”), immediately preceded by a release-keyword, while album/EP/event titles use 『』
// instead — so requiring the curly quotes right after one of these keywords keeps album/tour/event
// posts from being misread as a song title.
const JP_RELEASE_KEYWORDS = "新曲|ニューシングル|シングル|コラボ曲|楽曲";
const JP_OPEN_QUOTE = String.fromCodePoint(0x201c); // “ LEFT DOUBLE QUOTATION MARK
const JP_CLOSE_QUOTE = String.fromCodePoint(0x201d); // ” RIGHT DOUBLE QUOTATION MARK
const JP_ARTIST_TITLE = new RegExp(
  `^(.+?)(?:${JP_RELEASE_KEYWORDS})${JP_OPEN_QUOTE}([^${JP_CLOSE_QUOTE}]{1,60})${JP_CLOSE_QUOTE}`
);

const JP_SCRIPT_CHAR = new RegExp("[\\u3040-\\u30ff\\u4e00-\\u9fff]");
const JP_PARTICLE = new RegExp("[\\u304c\\u3092\\u3068\\u306b\\u3067]"); // が を と に で
const LATIN_RUN = "[A-Za-z0-9$&¥.\\-' ]+";
const TRAILING_LATIN_RUN = new RegExp(`(${LATIN_RUN})$`);
const LEADING_LATIN_RUN = new RegExp(`^(${LATIN_RUN})`);

// A discarded remainder only looks like a real grammatical clause (safe to drop) once it's long
// enough and contains a particle — a short kanji run with no particle (e.g. "諭吉佳作" in
// "諭吉佳作/men") is more likely part of the artist's actual name, not a description.
function looksLikeClause(remainder) {
  return remainder.trim().length >= 6 && JP_PARTICLE.test(remainder);
}

function extractJpArtist(candidate) {
  const firstSegment = candidate.split("、")[0]; // 、 ideographic comma
  const lastSlash = firstSegment.lastIndexOf("・"); // ・ katakana middle dot
  let artist = (lastSlash === -1 ? firstSegment : firstSegment.slice(lastSlash + 1)).trim();

  // A descriptive clause is sometimes fused directly onto the artist name with no separator
  // (e.g. "日韓バイラルヒットを記録したPM Kenobi" or "3Li¥enがANARCHYと再コラボ"). When Japanese
  // script is still mixed in, fall back to whichever end of the string is a clean Latin-script run,
  // since band names in this scene are usually Latin/alphanumeric even for Japanese acts.
  if (JP_SCRIPT_CHAR.test(artist)) {
    const trailing = artist.match(TRAILING_LATIN_RUN);
    if (trailing && trailing[1].trim().length >= 2) {
      const remainder = artist.slice(0, artist.length - trailing[0].length);
      if (looksLikeClause(remainder)) return trailing[1].trim();
    }
    const leading = artist.match(LEADING_LATIN_RUN);
    if (leading && leading[1].trim().length >= 2) {
      const remainder = artist.slice(leading[0].length);
      if (looksLikeClause(remainder)) return leading[1].trim();
    }
  }

  return artist;
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

  let m = title.match(JP_ARTIST_TITLE);
  if (m) {
    const artist = extractJpArtist(m[1]);
    if (artist) {
      return { artist, title: trimPunctuation(m[2]), confident: true };
    }
  }

  // The English "Artist - Title" / "Artist announce ... 'Title'" patterns below are only meant for
  // English-language blog headlines. Without this guard, punctuation decoded from HTML entities
  // (e.g. an en dash from "&#8211;") can make a Japanese event-announcement headline accidentally
  // match the English dash pattern.
  if (!JP_SCRIPT_CHAR.test(title)) {
    m = title.match(ARTIST_TITLE_DASH);
    if (m) {
      return { artist: trimPunctuation(m[1]), title: trimPunctuation(m[2]), confident: true };
    }

    if (SHARE_VERBS.test(title)) {
      m = title.match(ARTIST_SHARE_TITLE);
      if (m) {
        return { artist: trimPunctuation(m[1]), title: trimPunctuation(m[2]), confident: true };
      }
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

// Best-effort nationality filter: excludes posts whose raw title mentions a non-Japan
// country/city/keyword from config/blogs.json's excludeKeywords list. Heuristic, not authoritative —
// see README for known false positive/negative cases.
function isExcludedByKeyword(rawTitle, excludeKeywords) {
  if (!excludeKeywords || excludeKeywords.length === 0) return false;
  return excludeKeywords.some((kw) => rawTitle.includes(kw));
}

export { parseArtistTitle, extractYoutubeId, normalizeKey, dedupeKey, isExcludedByKeyword };
