import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  requireAuthorization,
  invalidateAllAuthorizationContexts,
} from "@/lib/authorization";
import {
  ensureMembershipSchema,
  normalizeGroupName,
  MEMBERSHIP_ACTIONS,
  applyMembershipAction,
  getMembership,
  isGroupProtected,
} from "@/lib/authorization/membership";

export const dynamic = "force-dynamic";

/**
 * ORGANIZATIONAL MEMBERSHIP API (Phase 1)
 *
 * The dedicated surface for group-membership lifecycle. FUTURE STUDIO (and
 * any protected group) can only be modified by org_membership.manage —
 * generic CRM access and assign_capabilities never grant it. Super Admin
 * bypasses through the resolver.
 *
 *   GET /api/org-membership?group=X&user_cid=Y&history=1
 *     requires org_membership.view
 *
 *   PUT /api/org-membership
 *     requires org_membership.manage
 *     body: { user_cid, group_name, action, expires_at?, note? }
 *     actions: joined | activated | deactivated | renewed | expired | ended
 *     - joined/activated/renewed → status active (+ optional expires_at)
 *     - deactivated/ended → status ended
 *     - expired → status expired
 *     Renewal updates the EXISTING membership row + records an event —
 *     never a duplicate person.
 */

function parseExpiresAt(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null; // invalid → caller decides
  return d;
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("org_membership", "view");
    if (authError) return authError;

    await ensureMembershipSchema();
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group");
    const userCid = searchParams.get("user_cid");
    const withHistory = searchParams.get("history") === "1";

    const where = [];
    const args = [];
    if (group) {
      where.push("gm.group_name = ?");
      args.push(normalizeGroupName(group));
    }
    if (userCid) {
      where.push("gm.user_cid = ?");
      args.push(userCid);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const memberships = (
      await db.execute({
        sql: `SELECT gm.user_cid, gm.group_name, gm.started_at, gm.expires_at,
                     gm.status, c.name, c.email
              FROM group_memberships gm
              LEFT JOIN contacts c ON c.cid = gm.user_cid
              ${whereSql}
              ORDER BY gm.group_name, gm.user_cid`,
        args,
      })
    ).rows;

    let events = [];
    if (withHistory) {
      const evWhere = [];
      const evArgs = [];
      if (group) {
        evWhere.push("group_name = ?");
        evArgs.push(normalizeGroupName(group));
      }
      if (userCid) {
        evWhere.push("user_cid = ?");
        evArgs.push(userCid);
      }
      const evWhereSql = evWhere.length ? `WHERE ${evWhere.join(" AND ")}` : "";
      events = (
        await db.execute({
          sql: `SELECT user_cid, group_name, action, actor_cid, note, created_at
                FROM group_membership_events
                ${evWhereSql}
                ORDER BY created_at DESC
                LIMIT 200`,
          args: evArgs,
        })
      ).rows;
    }

    const protectedGroups = {};
    for (const m of memberships) {
      if (protectedGroups[m.group_name] === undefined) {
        protectedGroups[m.group_name] = await isGroupProtected(m.group_name);
      }
    }

    return NextResponse.json({
      success: true,
      memberships,
      events,
      protected: protectedGroups,
    });
  } catch (e) {
    console.error("[org-membership] GET error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("org_membership", "manage");
    if (authError) return authError;

    await ensureMembershipSchema();
    const session = await getSession();
    const actor = session?.cid || session?.id || null;

    const body = await req.json().catch(() => null);
    const userCid = String(body?.user_cid || "").trim();
    const groupName = normalizeGroupName(body?.group_name);
    const action = String(body?.action || "").toLowerCase();
    const note = body?.note ? String(body.note) : null;

    if (!userCid || !groupName) {
      return NextResponse.json(
        { success: false, error: "errors.invalidMembershipRequest" },
        { status: 400 },
      );
    }
    if (!MEMBERSHIP_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: "errors.invalidMembershipAction" },
        { status: 400 },
      );
    }

    const expiresAt = parseExpiresAt(body?.expires_at);
    if (body?.expires_at !== undefined && body?.expires_at !== null && body?.expires_at !== "" && !expiresAt) {
      return NextResponse.json(
        { success: false, error: "errors.invalidMembershipDate" },
        { status: 400 },
      );
    }

    const current = await getMembership(userCid, groupName);
    if (!current) {
      if (action !== "joined") {
        return NextResponse.json(
          { success: false, error: "errors.membershipNotFound" },
          { status: 404 },
        );
      }
    }

    const { row, event } = applyMembershipAction(
      current || { user_cid: userCid, group_name: groupName, started_at: null, expires_at: null, status: null },
      action,
      { actor, note, expires_at: expiresAt ? expiresAt.toISOString() : expiresAt },
    );

    if (current) {
      await db.execute({
        sql: `UPDATE group_memberships
              SET status = ?, started_at = ?, expires_at = ?, updated_by = ?, updated_at = NOW()
              WHERE user_cid = ? AND group_name = ?`,
        args: [row.status, row.started_at, row.expires_at, actor, userCid, groupName],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO group_memberships
                (user_cid, group_name, started_at, expires_at, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [userCid, groupName, row.started_at, row.expires_at, row.status, actor],
      });
      // Keep user_groups in sync so legacy consumers (workspaces hub, etc.)
      // see the same membership edge.
      await db.execute({
        sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
              VALUES (?, ?, ?)
              ON CONFLICT (user_cid, group_name) DO NOTHING`,
        args: [userCid, groupName, actor || "admin"],
      });
    }
    await db.execute({
      sql: `INSERT INTO group_membership_events
              (user_cid, group_name, action, actor_cid, note)
            VALUES (?, ?, ?, ?, ?)`,
      args: [userCid, groupName, event.action, event.actor_cid, event.note],
    });

    // Membership changes affect identity + authorization — drop the cache.
    invalidateAllAuthorizationContexts();

    const updated = await getMembership(userCid, groupName);
    return NextResponse.json({ success: true, membership: updated });
  } catch (e) {
    console.error("[org-membership] PUT error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
