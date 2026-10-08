import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  listAnnouncementFeed,
  publishAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
} from "@/services/communications/announcements";

/**
 * /api/announcements — the internal announcement board.
 *
 * GET    ?target_type=all&target_id=X  → active announcements for an audience
 *        ?all=true                      → all announcements (admin only)
 *        (no params)                    → all active announcements
 * POST   { title, body, target_type, target_id, is_pinned }  publish
 * PUT    { id, is_archived, is_pinned, title, body }         edit
 * DELETE ?id=X                                               soft-archive
 *
 * The feed / publish / moderation rules — including the "author is the session"
 * rule — live in `@/services/communications/announcements`; this route
 * authenticates, gates on the capability and shapes the HTTP answer.
 */

export async function GET(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";
    const targetType = searchParams.get("target_type");
    const targetId = searchParams.get("target_id");

    const announcements = await listAnnouncementFeed({
      session,
      showAll,
      targetType,
      targetId,
    });
    return NextResponse.json({ success: true, announcements });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const authError = await requireAuthorization("internal_comms", "create_announcements");
    if (authError) return authError;

    const payload = await req.json();
    const { title, body } = payload || {};
    if (!title || !body) {
      return NextResponse.json(
        { success: false, error: "Title and body are required." },
        { status: 400 },
      );
    }

    const { id } = await publishAnnouncement({ session, payload });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const authError = await requireAuthorization("internal_comms", "moderate");
    if (authError) return authError;

    const payload = await req.json();
    if (!payload?.id) {
      return NextResponse.json(
        { success: false, error: "Announcement id is required." },
        { status: 400 },
      );
    }

    const outcome = await updateAnnouncement({ session, payload });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: outcome.denied.error },
        { status: outcome.denied.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const authError = await requireAuthorization("internal_comms", "moderate");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Query param required: id" },
        { status: 400 },
      );
    }

    const outcome = await archiveAnnouncement({ session, id });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: outcome.denied.error },
        { status: outcome.denied.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
