import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { LmsError, lmsErrorResponse } from "@/lib/lms/errors";
import { extractYouTubeVideoId } from "@/lib/lms/youtube";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/video-info?v=<youtube url or video id>
 * Resolve YouTube video metadata (title + duration) for the lesson authoring
 * modal's duration auto-detection. Requires lms.edit.
 *
 * The public YouTube oEmbed endpoint does not expose durations, so this proxy
 * uses the YouTube Data API v3 (`videos.list?part=contentDetails,snippet`).
 * It is a no-op (501) until `YOUTUBE_DATA_API_KEY` is configured — the modal
 * then falls back to a manual duration entry.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const videoId = extractYouTubeVideoId(searchParams.get("v") || "");
    if (!videoId) throw new LmsError("lms.errors.invalidYouTubeUrl", 400);

    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, available: false, error: "lms.errors.videoInfoUnavailable" },
        { status: 501 },
      );
    }

    const apiUrl =
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet` +
      `&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
    let json;
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`YouTube API ${res.status}`);
      json = await res.json();
    } catch {
      throw new LmsError("lms.errors.videoInfoFailed", 502);
    }

    const item = (json.items || [])[0];
    if (!item) throw new LmsError("lms.errors.videoInfoNotFound", 404);

    const durationSeconds = parseIso8601Duration(item.contentDetails?.duration);
    return NextResponse.json({
      success: true,
      id: videoId,
      title: item.snippet?.title || null,
      durationSeconds,
      // Whole display minutes, rounded up (a 61s clip is "2 min"); the admin
      // sees the value in the field and can correct it.
      durationMinutes:
        durationSeconds != null ? Math.max(1, Math.ceil(durationSeconds / 60)) : null,
    });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * Parse an ISO-8601 duration as used by YouTube's contentDetails (`PT1H2M10S`,
 * optionally with days) into total seconds. Returns null on malformed input.
 */
function parseIso8601Duration(value) {
  if (value == null) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(value).trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  if (!d && !h && !min && !s) return null;
  return (Number(d || 0) * 86400) + (Number(h || 0) * 3600) + (Number(min || 0) * 60) + Number(s || 0);
}
