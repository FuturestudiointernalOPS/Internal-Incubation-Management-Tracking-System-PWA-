import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import {
  requireAuthorization,
  invalidateAllAuthorizationContexts,
} from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import { PROFILE_BASELINE_ROLES } from "@/models/authorization/profile-catalog";
import { getProfileRow } from "@/models/authorization/profilesStore";
import {
  ensureProfileCapabilitiesSchema,
  listRoleProfileDefaults,
  upsertRoleProfileDefault,
  deleteRoleProfileDefault,
} from "@/models/authorization/profileCapabilitiesStore";
import { assertTemplateCapsEligible } from "@/services/authorization/eligibilityAdmin";

export const dynamic = "force-dynamic";

/**
 * ROLE → PROFILE DEFAULTS API (profiles takeover, decision B1).
 *
 * Which profile a baseline role receives by default — the "Default for" control
 * on the Profiles screen (the retired access-profile editor used to own it).
 *
 *   GET  requires permissions.view_matrix
 *        → every role → profile default mapping (role_name, profile_key).
 *
 *   PUT  requires permissions.configure_eligibility
 *        body: { role_name, profile_key } — profile_key null REMOVES the default.
 *        The profile must exist and be active, and its capabilities must stay
 *        within the role's eligibility ceiling.
 */

export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await ensureProfileCapabilitiesSchema();
    const result = await listRoleProfileDefaults();
    return NextResponse.json({
      success: true,
      roles: PROFILE_BASELINE_ROLES,
      defaults: (result.rows || []).map((row) => ({
        role_name: row.role_name,
        profile_key: row.profile_key,
      })),
    });
  } catch (error) {
    console.error("[Role profile defaults] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "configure_eligibility");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const body = await req.json();
    const roleName = String(body.role_name ?? "");
    const profileKey = body.profile_key == null ? null : String(body.profile_key);

    if (!PROFILE_BASELINE_ROLES.includes(roleName)) {
      return NextResponse.json(
        { success: false, error: `unknown role: ${roleName}` },
        { status: 400 },
      );
    }

    await ensureProfileCapabilitiesSchema();

    if (profileKey) {
      const profile = (await getProfileRow(profileKey)).rows?.[0];
      if (!profile) {
        return NextResponse.json(
          { success: false, error: "Profile not found" },
          { status: 404 },
        );
      }

      // Eligibility is the boundary: a default profile must never grant a
      // capability its role is not eligible for (`ELIGIBLE ≠ GRANTED`).
      const ceiling = await assertTemplateCapsEligible({ role: roleName, profileKey });
      if (!ceiling.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "errors.ineligibleTemplateCaps",
            violations: ceiling.violations,
          },
          { status: 400 },
        );
      }

      await upsertRoleProfileDefault({ roleName, profileKey });
    } else {
      await deleteRoleProfileDefault(roleName);
    }

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: roleName,
      action: "role_profile_default_updated",
      details: profileKey
        ? `Role ${roleName} now defaults to profile ${profileKey}`
        : `Role ${roleName} default profile removed`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({ success: true, role_name: roleName, profile_key: profileKey });
  } catch (error) {
    console.error("[Role profile defaults] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
