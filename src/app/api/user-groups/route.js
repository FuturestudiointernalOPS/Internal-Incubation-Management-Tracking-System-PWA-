import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  isGroupProtected,
  normalizeGroupName,
  getMembership,
  applyMembershipAction,
} from "@/lib/authorization/membership";

/**
 * GET /api/user-groups?user_cid=X
 *
 * Returns all groups a user belongs to.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    let userCid = searchParams.get("user_cid");
    if (session.role !== "super_admin") {
      if (userCid && String(userCid) !== String(session.cid)) {
        return NextResponse.json({ success: false, error: "You can only view your own groups." }, { status: 403 });
      }
      userCid = userCid || session.cid;
    }
    if (!userCid) return NextResponse.json({ success: false, error: "user_cid required" }, { status: 400 });

    await initDb();

    // First try user_groups table (may not exist yet — migration pending)
    let groups = [];
    try {
      const result = await db.execute({
        sql: "SELECT group_name, role_in_group FROM user_groups WHERE user_cid = ? ORDER BY group_name",
        args: [userCid],
      });
      groups = result.rows.map((r) => r.group_name);
    } catch (e) {
      // user_groups table may not exist yet — fall through to legacy group_name
      groups = [];
    }

    // Fallback to legacy group_name on contacts
    if (groups.length === 0) {
      try {
        const userRes = await db.execute({
          sql: "SELECT group_name FROM contacts WHERE cid = ?",
          args: [userCid],
        });
        if (userRes.rows.length > 0 && userRes.rows[0].group_name) {
          groups = [userRes.rows[0].group_name];
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, groups, user_cid: userCid });
  } catch (err) {
    console.error("[user-groups] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/user-groups
 *
 * Assign a user to a group.
 * Body: { user_cid, group_name }
 */
export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const { user_cid, group_name } = await req.json();

    if (!user_cid || !group_name) {
      return NextResponse.json(
        { success: false, error: "user_cid and group_name required" },
        { status: 400 },
      );
    }

    // Protected groups (FUTURE STUDIO) require the dedicated organizational
    // membership authority — assign_capabilities alone must never grant the
    // ability to manage the internal organization.
    if (await isGroupProtected(group_name)) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const normalized = normalizeGroupName(group_name);
    await db.execute({
      sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
            VALUES (?, ?, 'admin')
            ON CONFLICT (user_cid, group_name) DO NOTHING`,
      args: [user_cid, normalized],
    });
    // Keep the membership layer in sync so the new edge is effective
    // immediately (active, no expiry) and has history.
    const existing = await getMembership(user_cid, normalized);
    if (!existing) {
      const { row, event } = applyMembershipAction(
        { user_cid, group_name: normalized, started_at: null, expires_at: null, status: null },
        "joined",
        { actor: "admin" },
      );
      const session = await getSession();
      await db.execute({
        sql: `INSERT INTO group_memberships
                (user_cid, group_name, started_at, expires_at, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [user_cid, normalized, row.started_at, row.expires_at, row.status, session?.cid || "admin"],
      });
      await db.execute({
        sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, ?, ?, ?)`,
        args: [user_cid, normalized, event.action, event.actor_cid, "legacy group API"],
      });
    }

    return NextResponse.json({
      success: true,
      message: `User added to ${group_name}`,
    });
  } catch (err) {
    console.error("[user-groups] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user-groups
 *
 * Remove a user from a group.
 * Body: { user_cid, group_name }
 */
export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const body = await req.json();
    const { user_cid, group_name } = body;

    if (!user_cid || !group_name) {
      return NextResponse.json(
        { success: false, error: "user_cid and group_name required" },
        { status: 400 },
      );
    }

    // Protected groups (FUTURE STUDIO) require the dedicated organizational
    // membership authority — same rule as POST.
    if (await isGroupProtected(group_name)) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const normalized = normalizeGroupName(group_name);
    await db.execute({
      sql: "DELETE FROM user_groups WHERE user_cid = ? AND group_name = ?",
      args: [user_cid, normalized],
    });
    // End (never delete) the membership record — the person, account, CRM
    // record and history stay; only active authorization stops.
    const existing = await getMembership(user_cid, normalized);
    if (existing) {
      const session = await getSession();
      await db.execute({
        sql: `UPDATE group_memberships
              SET status = 'ended', updated_by = ?, updated_at = NOW()
              WHERE user_cid = ? AND group_name = ?`,
        args: [session?.cid || "admin", user_cid, normalized],
      });
      await db.execute({
        sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, 'ended', ?, 'legacy group API')`,
        args: [user_cid, normalized, session?.cid || "admin"],
      });
    }

    return NextResponse.json({
      success: true,
      message: `User removed from ${group_name}`,
    });
  } catch (err) {
    console.error("[user-groups] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
