import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import {
  requireAuthorization,
  invalidateAuthorizationContext,
} from "@/models/authorization/index";
import {
  getContactProfileOverrideTarget,
  getActiveProfileByKey,
  assignUserProfileKey,
  clearUserProfileKeyOverride,
  getRoleDefaultProfileLabel,
  getContactProfileOverrideState,
  getProfileSummaryByKey,
  getRoleDefaultProfileSummary,
} from "@/models/authorization";
import { listProfileCapabilities } from "@/models/authorization/profileCapabilitiesStore";
import { resolveCurrentBaseCapabilities } from "@/services/authorization/baseCapabilities";
import {
  isSelfAssignment,
  assertAssignmentEligible,
  evaluateCapabilityLoss,
  resolveRemovalFallback,
} from "@/services/authorization/profileAssignment";

export const dynamic = "force-dynamic";

/**
 * PER-PERSON PROFILE OVERRIDE (profiles takeover, decision A1).
 *
 * The on-person "replace profile" action, now by PROFILE KEY — the retired
 * `/api/access-profiles/assign` used a legacy access-profile id.
 *
 *   PUT  requires permissions.assign_capabilities
 *        body: { user_cid, profile_key, confirm? } — profile_key null REMOVES
 *        the override. `confirm: true` accepts an assignment that removes
 *        capabilities.
 *
 *   GET  requires permissions.view_matrix
 *        ?user_cid= → the person's override and the role default it would fall
 *        back to.
 */

export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    await initDb();
    const { user_cid, profile_key, confirm } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    // Separation of duties: nobody changes their OWN profile, not even a Super
    // Admin. Self-granting capabilities is the escalation this refuses.
    if (isSelfAssignment(session, user_cid)) {
      return NextResponse.json(
        { success: false, error: "You cannot change your own profile." },
        { status: 403 },
      );
    }

    const user = await getContactProfileOverrideTarget(user_cid);
    if (user.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    if (profile_key) {
      const profile = await getActiveProfileByKey(profile_key);
      if (profile.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Profile not found or inactive" },
          { status: 404 },
        );
      }

      // Eligibility is the boundary: a profile assigned to a person must never
      // grant capabilities their identity is not eligible for.
      const eligibility = await assertAssignmentEligible(user.rows[0], user_cid, {
        profileKey: profile_key,
      });
      if (!eligibility.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "errors.ineligibleTemplateCaps",
            violations: eligibility.violations,
          },
          { status: 400 },
        );
      }

      // Capability-loss guard: assigning a profile REPLACES the person's base
      // capabilities, so an empty or narrower profile silently strips access.
      if (confirm !== true) {
        const current = await resolveCurrentBaseCapabilities(user_cid);
        const newCaps = (await listProfileCapabilities(profile_key)).rows || [];

        const { loss, refusal } = evaluateCapabilityLoss(
          current,
          newCaps,
          profile.rows[0].label || profile_key,
        );

        if (refusal) {
          return NextResponse.json(
            {
              success: false,
              requiresConfirmation: true,
              error: refusal.error,
              message: refusal.message,
              loss,
            },
            { status: 409 },
          );
        }
      }

      await assignUserProfileKey(profile_key, user_cid);

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName: user.rows[0].name,
        action: "profile_assigned",
        details: `Assigned profile: ${profile.rows[0].label || profile_key}`,
      });
      invalidateAuthorizationContext(user_cid);

      return NextResponse.json({
        success: true,
        message: `User assigned to profile "${profile.rows[0].label || profile_key}"`,
        profileName: profile.rows[0].label || profile_key,
      });
    }

    // Remove the override.
    await clearUserProfileKeyOverride(user_cid);

    const roleDefault = await getRoleDefaultProfileLabel(user.rows[0].role);
    const roleDefaultName = resolveRemovalFallback(
      roleDefault.rows[0]?.label || roleDefault.rows[0]?.name,
    );

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: user_cid,
      targetName: user.rows[0].name,
      action: "profile_removed",
      details: `Removed profile override, reverting to ${roleDefaultName || "legacy"} default`,
    });
    invalidateAuthorizationContext(user_cid);

    return NextResponse.json({
      success: true,
      message: "Profile override removed, falling back to role default",
      roleDefaultName,
    });
  } catch (error) {
    console.error("[Profile override] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (!userCid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    const user = await getContactProfileOverrideState(userCid);
    if (user.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const userRow = user.rows[0];

    let assignedProfile = null;
    if (userRow.profile_key) {
      const profile = await getProfileSummaryByKey(userRow.profile_key);
      if (profile.rows.length > 0) {
        assignedProfile = { key: profile.rows[0].key, name: profile.rows[0].label || profile.rows[0].key };
      }
    }

    let roleDefault = null;
    const roleDefaultResult = await getRoleDefaultProfileSummary(userRow.role);
    if (roleDefaultResult.rows.length > 0) {
      roleDefault = {
        key: roleDefaultResult.rows[0].key,
        name: roleDefaultResult.rows[0].label || roleDefaultResult.rows[0].key,
      };
    }

    return NextResponse.json({
      success: true,
      user: { cid: userRow.cid, name: userRow.name, role: userRow.role },
      assignedProfile,
      roleDefault,
      effectiveSource: assignedProfile ? "user" : roleDefault ? "role" : "legacy",
    });
  } catch (error) {
    console.error("[Profile override GET] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
