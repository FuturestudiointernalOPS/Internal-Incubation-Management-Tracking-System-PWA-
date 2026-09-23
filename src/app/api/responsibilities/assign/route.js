import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getSession,
  assignResponsibility,
  removeResponsibility,
  logPermissionAudit,
  getAllResponsibilities,
  seedDefaultResponsibilities,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { normalizeAllowedRoles } from "@/lib/featureAccess";
import {
  getAssignedResponsibilitiesForUser,
  getContactByCid,
  getContactName,
  getResponsibilityName,
  grantResponsibilityBaseAccess,
  revokeResponsibilityBaseAccess,
} from "@/models/responsibilities";

/**
 * PUT /api/responsibilities/assign
 *
 * Assign or remove a responsibility for a user.
 * Body: { user_cid, responsibility_id, action: 'assign' | 'remove' }
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const { user_cid, responsibility_id, action } = body;

    if (!user_cid || !responsibility_id || !action) {
      return NextResponse.json(
        { success: false, error: "user_cid, responsibility_id, and action are required" },
        { status: 400 },
      );
    }

    await initDb();

    // Get responsibility name for audit
    const responsibilityResult = await getResponsibilityName(responsibility_id);
    const respName = responsibilityResult.rows[0]?.name || "Unknown";

    // Get target user name
    const targetResult = await getContactName(user_cid);
    const targetName = targetResult.rows[0]?.name || "Unknown";

    if (action === "assign") {
      const result = await assignResponsibility(user_cid, responsibility_id, session?.cid);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      // Option 1 — align the responsibility with its feature's modules: grant
      // the base `view` capability so the sidebar area actually loads. Never
      // fails the assignment (best-effort; a failure only leaves the area
      // without module access, like before).
      const responsibilityKey = responsibilityResult.rows[0]?.key || null;
      let grantedModules = [];
      if (responsibilityKey) {
        try {
          grantedModules = await grantResponsibilityBaseAccess({
            userCid: user_cid,
            responsibilityKey,
            grantedBy: session?.cid,
          });
        } catch (grantErr) {
          console.error("[Responsibilities Assign] base access grant failed:", grantErr.message);
        }
      }

      const baseAccessNote = grantedModules.length
        ? `. Base access granted: ${grantedModules.join(", ")}`
        : "";

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName,
        action: "responsibility_assigned",
        details: `Assigned responsibility: ${respName}${baseAccessNote}`,
      });

      return NextResponse.json({
        success: true,
        message: `Assigned "${respName}" to ${targetName}${baseAccessNote}`,
      });
    }

    if (action === "remove") {
      const result = await removeResponsibility(user_cid, responsibility_id);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      // Symmetric with the assign path: revoke exactly the base grants THIS
      // responsibility created (its ledger), so removing a responsibility no
      // longer leaves its area silently reachable. Best-effort — a failure only
      // leaves the grants in place, as before.
      const responsibilityKey = responsibilityResult.rows[0]?.key || null;
      let revokedModules = [];
      if (responsibilityKey) {
        try {
          revokedModules = await revokeResponsibilityBaseAccess({
            userCid: user_cid,
            responsibilityKey,
          });
        } catch (revokeErr) {
          console.error("[Responsibilities Assign] base access revoke failed:", revokeErr.message);
        }
      }

      const revokeNote = revokedModules.length
        ? `. Base access revoked: ${revokedModules.join(", ")}`
        : "";

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName,
        action: "responsibility_removed",
        details: `Removed responsibility: ${respName}${revokeNote}`,
      });

      return NextResponse.json({
        success: true,
        message: `Removed "${respName}" from ${targetName}${revokeNote}`,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}. Use 'assign' or 'remove'` },
      { status: 400 },
    );
  } catch (err) {
    console.error("[Responsibilities Assign] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/responsibilities/assign?user_cid=X
 *
 * Get all responsibilities assigned to a user, with toggle info.
 * Also returns all available responsibilities so the UI can show
 * which ones are assigned and which aren't.
 */
export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    // Self-heal: ensure the responsibility definitions always exist so the
    // Responsibilities tab never renders an empty list.
    await seedDefaultResponsibilities();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (!userCid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    // Get all active responsibilities (self-seeds defaults when empty)
    const allResponsibilities = await getAllResponsibilities();

    // Get user's assigned responsibilities
    const assignedResponsibilities = await getAssignedResponsibilitiesForUser(userCid);

    const assignedIds = new Set(assignedResponsibilities.rows.map((row) => row.id));

    // Build full response with toggle state
    const responsibilities = allResponsibilities.map((responsibility) => ({
      ...responsibility,
      assigned: assignedIds.has(responsibility.id),
      allowed_roles: normalizeAllowedRoles(responsibility.allowed_roles),
    }));

    const user = await getContactByCid(userCid);

    return NextResponse.json({
      success: true,
      user: user.rows[0] || null,
      responsibilities,
    });
  } catch (err) {
    console.error("[Responsibilities Assign GET] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
