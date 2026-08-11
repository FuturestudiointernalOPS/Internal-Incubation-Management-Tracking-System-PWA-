import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

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
      await db.execute(`
        CREATE TABLE IF NOT EXISTS v2_announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL DEFAULT 'all',
          target_id TEXT,
          is_pinned BOOLEAN DEFAULT false,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (_) {}

    let query;
    let args = [];

    if (showAll && session.role === "super_admin") {
      // Admin: return everything including archived
      query =
        "SELECT * FROM v2_announcements ORDER BY is_pinned DESC, created_at DESC";
    } else if (targetType && targetId) {
      // Specific audience + global announcements
      query = `SELECT * FROM v2_announcements
        WHERE is_archived = false
          AND (target_type = 'all' OR (target_type = ? AND target_id = ?))
        ORDER BY is_pinned DESC, created_at DESC`;
      args = [targetType, targetId];
    } else {
      // Return all active announcements (for dashboards)
      query = `SELECT * FROM v2_announcements
        WHERE is_archived = false
        ORDER BY is_pinned DESC, created_at DESC`;
    }

    const res = await db.execute({ sql: query, args });
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
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "admin",
      "staff",
    ]);
    if (authError) return authError;

    // Ensure table exists (safe migration)
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS v2_announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL DEFAULT 'all',
          target_id TEXT,
          is_pinned BOOLEAN DEFAULT false,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
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

    const insertRes = await db.execute({
      sql: `INSERT INTO v2_announcements (title, body, author_id, author_name, target_type, target_id, is_pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        title,
        body,
        effectiveAuthorId,
        effectiveAuthorName,
        target_type || "all",
        target_id || null,
        is_pinned ? true : false,
      ],
    });

    const newId = insertRes.rows[0]?.id;

    // Send notifications to targeted users
    try {
      const notifTitle = `New Announcement: ${title}`;
      const notifBody =
        body.length > 200 ? body.substring(0, 197) + "..." : body;

      if (target_type === "all" || !target_type || !target_id) {
        // Organization-wide: notify all users
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                SELECT cid, ?, ?, 'announcement', 0, NOW() FROM users WHERE status = 'active'`,
          args: [notifTitle, notifBody],
        });
      } else if (target_type === "group") {
        // Target by group: notify all users in that group
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                SELECT gm.user_id, ?, ?, 'announcement', 0, NOW()
                FROM v2_group_members gm
                INNER JOIN users u ON u.cid = gm.user_id AND u.status = 'active'
                WHERE gm.group_name = ?`,
          args: [notifTitle, notifBody, target_id],
        });
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
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "admin",
      "staff",
    ]);
    if (authError) return authError;

    const { id, is_archived, is_pinned, title, body } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Announcement id is required." },
        { status: 400 },
      );
    }

    // Verify ownership or super_admin
    const existing = await db.execute({
      sql: "SELECT author_id FROM v2_announcements WHERE id = ?",
      args: [id],
    });
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

    // Build update
    const updates = [];
    const args = [];
    if (is_archived !== undefined) {
      updates.push("is_archived = ?");
      args.push(is_archived);
    }
    if (is_pinned !== undefined) {
      updates.push("is_pinned = ?");
      args.push(is_pinned);
    }
    if (title !== undefined) {
      updates.push("title = ?");
      args.push(title);
    }
    if (body !== undefined) {
      updates.push("body = ?");
      args.push(body);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 },
      );
    }

    updates.push("updated_at = NOW()");
    args.push(id);

    await db.execute({
      sql: `UPDATE v2_announcements SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

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
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "admin",
      "staff",
    ]);
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
    const existing = await db.execute({
      sql: "SELECT author_id FROM v2_announcements WHERE id = ?",
      args: [id],
    });
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
    await db.execute({
      sql: "UPDATE v2_announcements SET is_archived = true, updated_at = NOW() WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
