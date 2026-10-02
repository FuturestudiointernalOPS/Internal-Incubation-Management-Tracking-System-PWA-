import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, logPermissionAudit } from "@/lib/auth";
import { requireAuthorization, invalidateAllAuthorizationContexts } from "@/models/authorization/index";
import {
  setRoleDefaultProfile,
  removeRoleDefaultProfile,
  listRoleDefaultMappings,
} from "@/models/authorization";
import { assertRoleDefaultAssignable } from "@/services/authorization/accessProfileWrites";

/**
 * PUT /api/access-profiles/role-defaults
 *
 * Set which access profile a role uses by default.
 * Body: { role_name, profile_id }
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const { role_name, profile_id } = await req.json();

    if (!role_name || !profile_id) {
      return NextResponse.json(
        { success: false, error: "role_name and profile_id are required" },
        { status: 400 },
      );
    }

    // The profile must exist and be active, and the role must be eligible for
    // every feature the profile grants. The boundary lives in the service.
    const gate = await assertRoleDefaultAssignable(role_name, profile_id);
    if (!gate.ok) {
      return NextResponse.json(
        {
          success: false,
          error: gate.error,
          ...(gate.violations ? { violations: gate.violations } : {}),
        },
        { status: gate.status },
      );
    }

    await setRoleDefaultProfile(role_name, profile_id);

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: `role:${role_name}`,
      action: "role_default_changed",
      details: `Set default access profile for role "${role_name}" to "${gate.profileName}"`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      message: `Role "${role_name}" default set to "${gate.profileName}"`,
    });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/access-profiles/role-defaults
 *
 * Get all role→profile default mappings.
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const mappings = await listRoleDefaultMappings();

    return NextResponse.json({
      success: true,
      mappings: mappings.rows,
    });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/access-profiles/role-defaults
 *
 * Remove a role's default access profile mapping. The role then falls back to
 * legacy role_capabilities until another default is set.
 * Query: ?role_name=...&profile_id=...
 */
export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const role_name = searchParams.get("role_name");
    const profile_id = searchParams.get("profile_id");

    if (!role_name || !profile_id) {
      return NextResponse.json(
        { success: false, error: "role_name and profile_id are required" },
        { status: 400 },
      );
    }

    const result = await removeRoleDefaultProfile(role_name, profile_id);
    const removed = Number(result?.rowsAffected ?? 0);

    if (removed > 0) {
      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: "system",
        targetName: `role:${role_name}`,
        action: "role_default_changed",
        details: `Removed default access profile for role "${role_name}"`,
      });
      invalidateAllAuthorizationContexts();
    }

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
