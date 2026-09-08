import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  archiveAnnouncementById,
  createAnnouncement,
  ensureAnnouncementsTable,
  ensureAnnouncementsTableForInsert,
  getAnnouncementAuthorById,
  getAnnouncementAuthorByIdForDelete,
  listAnnouncements,
  notifyAllActiveUsersOfAnnouncement,
  notifyAnnouncementGroupMembers,
  updateAnnouncementFields,
} from "@/models/communications";

/**
 * GET /api/announcements
 *   ?target_type=all&target_id=X  → active announcements for a given audience
 *   ?all=true                      → all announcements (admin only)
 *   (no params)                    → all active announcements for everyone
 */
export async function GET(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
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

    // Ensure table exists (safe migration)
    try {
      await ensureAnnouncementsTable();
    } catch (_) {}

    const res = await listAnnouncements({
      showAll,
      isSuperAdmin: session.role === "super_admin",
      targetType,
      targetId,
    });
    return NextResponse.json({ success: true, announcements: res.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/announcements
 * Body: { title, body, author_id, author_name, target_type, target_id, is_pinned }
 * Permissions: super_admin, program_manager, project_owner, department_lead
 */
export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const authError = await requireAuthorization(
      "internal_comms",
      "create_announcements",
    );
    if (authError) return authError;

    // Ensure table exists (safe migration)
    try {
      await ensureAnnouncementsTableForInsert();
    } catch (_) {}

    const {
      title,
      body,
      author_id,
      author_name,
      target_type,
      target_id,
      is_pinned,
    } = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { success: false, error: "Title and body are required." },
        { status: 400 },
      );
    }

    const effectiveAuthorId = author_id || session.cid;
    const effectiveAuthorName =
      author_name || session.name || effectiveAuthorId;

    const insertRes = await createAnnouncement({
      title,
      body,
      authorId: effectiveAuthorId,
      authorName: effectiveAuthorName,
      targetType: target_type,
      targetId: target_id,
      isPinned: is_pinned,
    });

    const newId = insertRes.rows[0]?.id;

    // Send notifications to targeted users
    try {
      const notifTitle = `New Announcement: ${title}`;
      const notifBody =
        body.length > 200 ? body.substring(0, 197) + "..." : body;

      if (target_type === "all" || !target_type || !target_id) {
        // Organization-wide: notify all users
        await notifyAllActiveUsersOfAnnouncement(notifTitle, notifBody);
      } else if (target_type === "group") {
        // Target by group: notify all users in that group
        await notifyAnnouncementGroupMembers(notifTitle, notifBody, target_id);
      }
    } catch (_) {
      // Notifications are non-blocking
    }

    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/announcements
 * Body: { id, is_archived, is_pinned, title, body }
 * Only the author or super_admin can edit.
 */
export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const authError = await requireAuthorization("internal_comms", "moderate");
    if (authError) return authError;

    const { id, is_archived, is_pinned, title, body } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Announcement id is required." },
        { status: 400 },
      );
    }

    // Verify ownership or super_admin
    const existing = await getAnnouncementAuthorById(id);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Announcement not found." },
        { status: 404 },
      );
    }
    if (
      existing.rows[0].author_id !== session.cid &&
      session.role !== "super_admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the author or super_admin can edit this announcement.",
        },
        { status: 403 },
      );
    }

    // No fields to update guard — the UPDATE itself is assembled in
    // src/models/communications.js (updateAnnouncementFields)
    if (
      is_archived === undefined &&
      is_pinned === undefined &&
      title === undefined &&
      body === undefined
    ) {
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 },
      );
    }

    await updateAnnouncementFields({ id, is_archived, is_pinned, title, body });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/announcements?id=X
 * Soft-archives an announcement. Only author or super_admin.
 */
export async function DELETE(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
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

    // Verify ownership or super_admin
    const existing = await getAnnouncementAuthorByIdForDelete(id);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Announcement not found." },
        { status: 404 },
      );
    }
    if (
      existing.rows[0].author_id !== session.cid &&
      session.role !== "super_admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only the author or super_admin can archive this announcement.",
        },
        { status: 403 },
      );
    }

    // Soft archive
    await archiveAnnouncementById(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
