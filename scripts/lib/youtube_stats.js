import { google } from "googleapis";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function daysSince(isoDate, now) {
  const ms = now.getTime() - new Date(isoDate).getTime();
  return Math.max(1, ms / (1000 * 60 * 60 * 24));
}

// Wraps the read-only parts of the YouTube Data API (search, videos, channels) needed to enrich
// songs with view/subscriber counts. Uses a plain API key — no OAuth needed, unlike the upload
// script. Returns null for everything if no API key is configured, so callers can degrade
// gracefully instead of failing the whole fetch.
export function createYoutubeStatsClient(apiKey) {
  if (!apiKey) return null;
  const youtube = google.youtube({ version: "v3", auth: apiKey });

  async function searchVideoId(query) {
    try {
      const res = await youtube.search.list({ part: ["id"], q: query, type: ["video"], maxResults: 1 });
      return res.data.items?.[0]?.id?.videoId || null;
    } catch (err) {
      console.warn(`[warn] YouTube search failed for "${query}": ${err.message}`);
      return null;
    }
  }

  async function fetchVideoStats(videoIds) {
    const results = new Map();
    for (const batch of chunk(videoIds, 50)) {
      try {
        const res = await youtube.videos.list({ part: ["statistics", "snippet"], id: batch });
        for (const item of res.data.items || []) {
          results.set(item.id, {
            viewCount: Number(item.statistics?.viewCount || 0),
            channelId: item.snippet?.channelId || null,
            publishedAt: item.snippet?.publishedAt || null,
          });
        }
      } catch (err) {
        console.warn(`[warn] YouTube videos.list failed: ${err.message}`);
      }
    }
    return results;
  }

  async function fetchChannelStats(channelIds) {
    const results = new Map();
    const uniqueIds = [...new Set(channelIds.filter(Boolean))];
    for (const batch of chunk(uniqueIds, 50)) {
      try {
        const res = await youtube.channels.list({ part: ["statistics"], id: batch });
        for (const item of res.data.items || []) {
          results.set(item.id, Number(item.statistics?.subscriberCount || 0));
        }
      } catch (err) {
        console.warn(`[warn] YouTube channels.list failed: ${err.message}`);
      }
    }
    return results;
  }

  // Resolves a video id for every song (using the existing id if present, otherwise searching),
  // then batch-fetches video + channel stats and attaches a `youtube` stats block to each song.
  async function enrichSongs(songs, now = new Date()) {
    const videoIds = [];
    for (const song of songs) {
      let videoId = song.youtubeId;
      if (!videoId) {
        videoId = await searchVideoId(`${song.artist ?? ""} ${song.title}`.trim());
      }
      song._videoId = videoId;
      if (videoId) videoIds.push(videoId);
    }

    const videoStats = await fetchVideoStats(videoIds);
    const channelStats = await fetchChannelStats(
      [...videoStats.values()].map((v) => v.channelId)
    );

    for (const song of songs) {
      const stats = song._videoId ? videoStats.get(song._videoId) : null;
      if (!stats || !stats.publishedAt) {
        song.youtube = null;
      } else {
        const subscriberCount = channelStats.get(stats.channelId) ?? null;
        song.youtube = {
          videoId: song._videoId,
          viewCount: stats.viewCount,
          publishedAt: stats.publishedAt,
          channelSubscriberCount: subscriberCount,
          viewVelocity: stats.viewCount / daysSince(stats.publishedAt, now),
        };
      }
      delete song._videoId;
    }

    return songs;
  }

  return { enrichSongs };
}
