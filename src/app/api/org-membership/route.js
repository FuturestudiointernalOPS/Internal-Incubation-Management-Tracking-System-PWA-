import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, logPermissionAudit } from "@/lib/auth";
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
import {
  listMemberships,
  listMembershipEvents,
  updateMembershipStatus,
  insertMembership,
  syncMembershipUserGroup,
  insertMembershipEvent,
} from "@/models/authorization";

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
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null; // invalid → caller decides
  return date;
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

    const memberships = (await listMemberships(whereSql, args)).rows;

    let events = [];
    if (withHistory) {
      const eventWhere = [];
      const eventArgs = [];
      if (group) {
        eventWhere.push("ev.group_name = ?");
        eventArgs.push(normalizeGroupName(group));
      }
      if (userCid) {
        eventWhere.push("ev.user_cid = ?");
        eventArgs.push(userCid);
      }
      const eventWhereSql = eventWhere.length ? `WHERE ${eventWhere.join(" AND ")}` : "";
      events = (await listMembershipEvents(eventWhereSql, eventArgs)).rows;
    }

    const protectedGroups = {};
    for (const membership of memberships) {
      if (protectedGroups[membership.group_name] === undefined) {
        protectedGroups[membership.group_name] = await isGroupProtected(membership.group_name);
      }
    }

    return NextResponse.json({
      success: true,
      memberships,
      events,
      protected: protectedGroups,
    });
  } catch (error) {
    console.error("[org-membership] GET error:", error.message);
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
      await updateMembershipStatus(
        row.status,
        row.started_at,
        row.expires_at,
        actor,
        userCid,
        groupName,
      );
    } else {
      await insertMembership(
        userCid,
        groupName,
        row.started_at,
        row.expires_at,
        row.status,
        actor,
      );
      // Keep user_groups in sync so legacy consumers (workspaces hub, etc.)
      // see the same membership edge.
      await syncMembershipUserGroup(userCid, groupName, actor || "admin");
    }
    await insertMembershipEvent(
      userCid,
      groupName,
      event.action,
      event.actor_cid,
      event.note,
    );

    // Unified permission audit trail (in addition to the membership events).
    await logPermissionAudit({
      actorCid: actor,
      actorName: session?.name || null,
      targetCid: userCid,
      targetName: `membership:${groupName}`,
      action: "membership_changed",
      details: `${action} → status ${row.status}`,
    });

    // Membership changes affect identity + authorization — drop the cache.
    invalidateAllAuthorizationContexts();

    const updated = await getMembership(userCid, groupName);
    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    console.error("[org-membership] PUT error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
