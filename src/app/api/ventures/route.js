import { NextResponse } from "next/server";
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
 */
export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager", "participant", "founder", "teacher", "developer"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const contactId = searchParams.get("contact_id");

    // Access scoping (Phase 2 — assignment-aware):
    //  - GLOBAL roles (super_admin/developer/admin) may list every Venture.
    //  - Delegated staff/program_manager see Ventures they are ASSIGNED to
    //    or MEMBERS of — never the whole directory.
    //  - Other roles (participant/founder/teacher/member) see only their own
    //    ventures via membership.
    let effectiveContactId = contactId;
    try {
      const session = await getSession();
      if (session && !["super_admin", "developer", "admin"].includes(session.role)) {
        if (["staff", "program_manager"].includes(session.role)) {
          sql += " AND (v.venture_id IN (SELECT venture_id FROM venture_staff_assignments WHERE staff_contact_id = ? AND status = 'active')";
          args.push(session.cid);
          sql += " OR v.venture_id IN (SELECT vm.venture_id FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?))";
          args.push(session.cid, session.cid);
        } else {
          effectiveContactId = session.cid;
        }
      }
    } catch (_) {}

    const result = await listVenturesWithCounts({ effectiveContactId, status, search });

    return NextResponse.json({
      success: true,
      ventures: result.rows,
    });
  },
);

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
      const ctx = await getAuthorizationContext(session);
      if (!ctx?.isSuperAdmin) {
        const scopeId = await resolveVentureScopeId(id);
        const within =
          Boolean(scopeId) &&
          (await isWithinScope("venture_own", session?.cid, scopeId));
        if (!within) {
          const res = NextResponse.json(
            {
              success: false,
              error: "errors.insufficientPermissions",
              missing: { capability: "ventures.edit", scope: "venture_own" },
            },
            { status: 403 },
          );
          res.headers.set("X-Authz-Decision", "out-of-scope");
          return res;
        }
      }
    }
    // Lifecycle guardrail: only global roles or delegated staff with an active
    // assignment may change a Venture's status (founder/member edits keep all
    // other profile fields; status is silently preserved as-is).
    if (updates.status) {
      try {
        const session = await getSession();
        const globalRoles = ["super_admin", "developer", "admin"];
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
          const updatedFields = Object.keys(updates).filter(k => k !== "social_media" && k !== "branding");
          await recordVentureUpdatedTimeline({ contact_cid: session.cid, venture_id: id, updated_fields: updatedFields });
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, ...result });
});
