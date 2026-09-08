import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, logPermissionAudit } from "@/lib/auth";
import { requireAuthorization, assertTemplateCapsEligible, invalidateAllAuthorizationContexts } from "@/lib/authorization";
import {
  getActiveProfileForRoleDefault,
  setRoleDefaultProfile,
  listRoleDefaultMappings,
} from "@/models/authorization";

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

    // Verify profile exists
    const profile = await getActiveProfileForRoleDefault(profile_id);
    if (profile.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Access profile not found or inactive" },
        { status: 404 },
      );
    }

    // Phase 2: eligibility is the boundary — a default template must never
    // grant capabilities whose feature the role is not eligible for.
    const { valid, violations } = await assertTemplateCapsEligible({
      role: role_name,
      groups: [],
      profileId: profile_id,
    });
    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: "errors.ineligibleTemplateCaps",
          violations,
        },
        { status: 400 },
      );
    }

    await setRoleDefaultProfile(role_name, profile_id);

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: `role:${role_name}`,
      action: "role_default_changed",
      details: `Set default access profile for role "${role_name}" to "${profile.rows[0].name}"`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      message: `Role "${role_name}" default set to "${profile.rows[0].name}"`,
    });
  } catch (e) {
    console.error("API Error:", e.message);
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
  } catch (e) {
    console.error("API Error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
