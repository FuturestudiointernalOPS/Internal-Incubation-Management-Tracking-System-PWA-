import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import { getAuthorizationContext, requireAuthorization } from "@/lib/authorization";
import { isWithinScope, resolveVentureScopeId } from "@/lib/authorization/scope";
import { updateVenture } from "@/lib/ventures";
import {
  listVenturesWithCounts,
  recordVentureUpdatedTimeline,
} from "@/models/ventureWorkspace";

/**
 * GET /api/ventures
 * List all ventures with summary counts.
 *
 * The DOOR admits any signed-in person; which Ventures they see is decided by
 * their RELATIONSHIPS, never by the badge their account carries. A founder
 * whose baseline stays "member" is the normal case the identity model is built
 * around (see the I6C acceptance matrix: joining a Venture must NOT mutate the
 * baseline), and the sidebar already derives its "my Ventures" door from that
 * same relationship. Gating on badge strings opened that door onto a refusal —
 * and it refused a team member of a Venture in exactly the same way.
 */
export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const contactId = searchParams.get("contact_id");

  // The guard above already required a session; this second read exists because
  // the SCOPING below needs the identity, and it must never FAIL OPEN. Swallowing
  // the error left `effectiveContactId` as whatever the caller passed — usually
  // nothing, i.e. the whole directory.
  let session = null;
  try {
    session = await getSession();
  } catch (_) {
    session = null;
  }
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  // Access scoping (Phase 2 — assignment-aware):
  //  - GLOBAL roles (super_admin) may list every Venture.
  //  - Delegated staff/program_manager see the Ventures they are ASSIGNED to —
  //    never the whole directory.
  //  - Every other person sees ONLY the Ventures they belong to, by membership.
  //    The identifier in the address narrows a GLOBAL role's view; it can never
  //    widen anyone else's, because the session's own identity overwrites it.
  let effectiveContactId = contactId;
  let assignedStaffId = null;
  if (!["super_admin"].includes(session.role)) {
    if (["staff", "program_manager"].includes(session.role)) {
      assignedStaffId = session.cid;
    } else {
      effectiveContactId = session.cid;
    }
  }

  const result = await listVenturesWithCounts({
    effectiveContactId,
    assignedStaffId,
    status,
    search,
  });

  return NextResponse.json({
    success: true,
    ventures: result.rows,
  });
});

/**
 * POST /api/ventures
 * Create a new venture.
 */
export const POST = createHandler(async () => {
  // RETIRED (Phase 1): Venture creation only flows through the Forms/Runs
  // intake pipeline (Form → Run → Submission → Review → Approval → Venture).
  // Even Super Admin cannot create Ventures directly anymore.
  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_FLOW_RETIRED",
      error:
        "Direct Venture creation is retired. Ventures are created only through the Venture Application form approval pipeline.",
    },
    { status: 410 },
  );
});

/**
 * PUT /api/ventures
 * Update a venture. Expects { id: venture_id, ...fields } in body.
 */
export const PUT = createHandler(async (req) => {
  const capError = await requireAuthorization("ventures", "edit");
  if (capError) return capError;
  const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "id (venture_id) is required" }, { status: 400 });
    }

    // Phase 5c — capability is not enough: the venture must be THEIRS. Scope is
    // checked here so granting ventures.edit can never open unscoped writes.
    {
      const session = await getSession();
      const authzContext = await getAuthorizationContext(session);
      if (!authzContext?.isSuperAdmin) {
        const scopeId = await resolveVentureScopeId(id);
        const within =
          Boolean(scopeId) &&
          (await isWithinScope("venture_own", session?.cid, scopeId));
        if (!within) {
          const response = NextResponse.json(
            {
              success: false,
              error: "errors.insufficientPermissions",
              missing: { capability: "ventures.edit", scope: "venture_own" },
            },
            { status: 403 },
          );
          response.headers.set("X-Authz-Decision", "out-of-scope");
          return response;
        }
      }
    }
    // Lifecycle guardrail: only global roles or delegated staff with an active
    // assignment may change a Venture's status (founder/member edits keep all
    // other profile fields; status is silently preserved as-is).
    if (updates.status) {
      try {
        const session = await getSession();
        const globalRoles = ["super_admin"];
        if (!session || !globalRoles.includes(session.role)) {
          const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
          const assigned = session?.cid ? await hasActiveVentureAssignment(id, session.cid, db) : false;
          if (!assigned) delete updates.status;
        }
      } catch (_) {}
    }
    // Convert social_media/branding objects to JSON strings for SQLite
    if (updates.social_media) updates.social_media = JSON.stringify(updates.social_media);
    if (updates.branding) updates.branding = JSON.stringify(updates.branding);
    const result = await updateVenture(id, updates);

    // Timeline event
    if (result.updated) {
      try {
        const { getSession } = await import("@/lib/auth");
        const session = await getSession();
        if (session?.cid) {
          const updatedFields = Object.keys(updates).filter(field => field !== "social_media" && field !== "branding");
          await recordVentureUpdatedTimeline({ contact_cid: session.cid, venture_id: id, updated_fields: updatedFields });
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, ...result });
});
