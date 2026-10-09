import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import { requireAuthorization } from "@/models/authorization/index";
import { invalidateAuthorizationContext } from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import { getProfileDefinition } from "@/models/authorization/profile-catalog";
import {
  ensureProfileAssignmentsSchema,
  listProfileAssignments,
  findActiveAssignment,
  getProfileAssignmentById,
  insertProfileAssignment,
  closeProfileAssignment,
} from "@/models/authorization/profileAssignmentsStore";
import { listProfiles, getProfileRow } from "@/models/authorization/profilesStore";
import {
  CLOSE_ACTIONS,
  validateProfileAssignment,
} from "@/services/authorization/profileAssignments";

export const dynamic = "force-dynamic";

/**
 * PROFILE ASSIGNMENT REGISTRY API (Phase C).
 *
 *   GET ?cid=X  requires permissions.view_matrix
 *        → every assignment period of one person (present and past) + the
 *        profile catalogue for the manual form. Self-heals the table on read.
 *        State-changing GET (CSRF-1) — same-origin only.
 *
 *   POST  requires permissions.assign_responsibilities
 *        body: { cid, profile_key, context_type?, context_id?, started_at?,
 *                ends_at?, notes?, reason? }
 *        → open a NEW period. A reactivation after a close is a second row.
 *
 *   PATCH requires permissions.assign_responsibilities
 *        body: { id, action: "close"|"revoke", reason? }
 *        → close an ACTIVE period (status + ended_at), never delete it.
 *
 * The registry DESCRIBES assignments; it does not decide access. Phase D will
 * consume the active keys for eligibility, and Phase E will write the automatic
 * rows. Nothing here changes anyone's effective access.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    await ensureProfileAssignmentsSchema();
    const assignments = await listProfileAssignments(cid);
    const catalogue = await listProfiles();

    return NextResponse.json({
      success: true,
      cid: String(cid),
      assignments: assignments.rows,
      profiles: catalogue.rows.map((row) => {
        const definition = getProfileDefinition(row.key) || {};
        return {
          key: row.key,
          context: row.context,
          label_key: definition.labelKey || null,
          is_active: Number(row.is_active) === 1 ? 1 : 0,
        };
      }),
    });
  } catch (error) {
    console.error("[Profile Assignments] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_responsibilities");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const body = await req.json();

    // The profile is validated against the DATABASE: read its row and hand it to
    // the validator, so a profile created from the profiles screen is accepted.
    const profileKey = String(body.profile_key ?? body.profileKey ?? "");
    const profileRow = profileKey
      ? (await getProfileRow(profileKey)).rows?.[0] || null
      : null;

    const check = validateProfileAssignment(body, profileRow);
    if (!check.valid) {
      return NextResponse.json(
        { success: false, error: check.errors.join("; ") },
        { status: 400 },
      );
    }

    await ensureProfileAssignmentsSchema();

    // One ACTIVE period per (person, profile, context): a reactivation must go
    // through a close first, so the history stays two distinct records.
    const existing = await findActiveAssignment({
      contactCid: check.normalized.contactCid,
      profileKey: check.normalized.profileKey,
      contextType: check.normalized.contextType,
      contextId: check.normalized.contextId,
    });
    if ((existing.rows || []).length > 0) {
      return NextResponse.json(
        { success: false, error: "this profile is already active for this person" },
        { status: 409 },
      );
    }

    const inserted = await insertProfileAssignment({
      contactCid: check.normalized.contactCid,
      profileKey: check.normalized.profileKey,
      contextType: check.normalized.contextType,
      contextId: check.normalized.contextId,
      startedAt: check.normalized.startedAt,
      endsAt: check.normalized.endsAt,
      source: check.normalized.source,
      sourceRef: session?.cid || null,
      notes: check.normalized.notes,
      createdBy: session?.cid || null,
    });

    const reasonNote =
      body.reason && typeof body.reason === "string" && body.reason.trim()
        ? ` Reason: ${body.reason.trim()}`
        : "";
    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: check.normalized.contactCid,
      targetName: check.normalized.contactCid,
      action: "profile_assignment_created",
      details: `Assigned profile ${check.normalized.profileKey} in ${check.normalized.contextType}${
        check.normalized.contextId ? `:${check.normalized.contextId}` : ""
      }${reasonNote}`,
    });

    // Phase D — the assignment changes which eligibility ceilings apply to this
    // person, so their cached authorization context must go.
    invalidateAuthorizationContext(check.normalized.contactCid);

    return NextResponse.json({
      success: true,
      id: inserted.rows?.[0]?.id ?? null,
      assignment: {
        profile_key: check.normalized.profileKey,
        context_type: check.normalized.contextType,
        context_id: check.normalized.contextId,
        started_at: check.normalized.startedAt,
        ends_at: check.normalized.endsAt,
        source: check.normalized.source,
      },
    });
  } catch (error) {
    console.error("[Profile Assignments] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_responsibilities");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const body = await req.json();
    const { id, action, reason, ended_at } = body;

    const nextStatus = CLOSE_ACTIONS[String(action || "")];
    if (!nextStatus) {
      return NextResponse.json(
        { success: false, error: "action must be 'close' or 'revoke'" },
        { status: 400 },
      );
    }
    if (id === undefined || id === null || !Number.isInteger(Number(id))) {
      return NextResponse.json(
        { success: false, error: "id must be an integer" },
        { status: 400 },
      );
    }

    await ensureProfileAssignmentsSchema();
    const current = await getProfileAssignmentById(id);
    const row = current.rows?.[0];
    if (!row) {
      return NextResponse.json(
        { success: false, error: "assignment not found" },
        { status: 404 },
      );
    }
    if (String(row.status) !== "active") {
      return NextResponse.json(
        { success: false, error: "assignment is not active" },
        { status: 409 },
      );
    }

    await closeProfileAssignment({
      id: Number(id),
      status: nextStatus,
      endedAt: ended_at ?? null,
    });

    const reasonNote =
      reason && typeof reason === "string" && reason.trim()
        ? ` Reason: ${reason.trim()}`
        : "";
    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: row.contact_cid,
      targetName: row.contact_cid,
      action: "profile_assignment_closed",
      details: `${nextStatus === "revoked" ? "Revoked" : "Closed"} profile ${row.profile_key} in ${row.context_type}${
        row.context_id ? `:${row.context_id}` : ""
      }${reasonNote}`,
    });

    // Phase D — closing a period changes the person's active profiles, so drop
    // their cached context too.
    invalidateAuthorizationContext(row.contact_cid);

    return NextResponse.json({
      success: true,
      id: Number(id),
      status: nextStatus,
    });
  } catch (error) {
    console.error("[Profile Assignments] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
