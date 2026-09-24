import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, logPermissionAudit } from "@/lib/auth";
import { requireAuthorization, assertTemplateCapsEligible, invalidateAuthorizationContext } from "@/lib/authorization";
import {
  getContactForAssignment,
  getActiveAccessProfile,
  getUserGroupNames,
  assignUserAccessProfile,
  clearUserAccessProfileOverride,
  getRoleDefaultProfileName,
  getContactAssignmentState,
  getAccessProfileSummary,
  getRoleDefaultAccessProfile,
  getCurrentBaseCapabilities,
  getProfileCapabilities,
} from "@/models/authorization";

/**
 * PUT /api/access-profiles/assign
 *
 * Assign/remove an access profile override for a specific user.
 * Body: { user_cid, profile_id, confirm? } — set profile_id to null to remove
 * the override. `confirm: true` accepts an assignment that removes
 * capabilities (see the capability-loss guard below).
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    await initDb();
    const { user_cid, profile_id, confirm } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    // Separation of duties: nobody changes their OWN access profile, not even a
    // Super Admin. Self-granting capabilities is the escalation this refuses.
    if (session?.cid && String(session.cid) === String(user_cid)) {
      return NextResponse.json(
        { success: false, error: "You cannot change your own access profile." },
        { status: 403 },
      );
    }

    // Verify user exists
    const user = await getContactForAssignment(user_cid);
    if (user.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    // If profile_id is provided, verify it exists
    if (profile_id) {
      const profile = await getActiveAccessProfile(profile_id);
      if (profile.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Access profile not found or inactive" },
          { status: 404 },
        );
      }

      // Phase 2: eligibility is the boundary — a template assigned to a
      // person must never grant capabilities the person's identity is not
      // eligible for.
      const groups = (await getUserGroupNames(user_cid)).rows.map(
        (row) => row.group_name,
      );
      const { valid, violations } = await assertTemplateCapsEligible({
        role: user.rows[0].role,
        groups,
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

      // Capability-loss guard. Assigning a profile REPLACES the person's base
      // capabilities: the resolver reads access_profile_capabilities INSTEAD OF
      // role_capabilities (see authorization/resolver.js). An empty or narrower
      // profile therefore silently strips access, so make the loss explicit and
      // require confirm:true before proceeding.
      if (confirm !== true) {
        const current = await getCurrentBaseCapabilities(user_cid);
        const newCaps = (await getProfileCapabilities(profile_id)).rows || [];

        const currentLevels = new Map(
          current.caps.map((cap) => [
            `${cap.module}:${cap.capability}`,
            cap.access_level,
          ]),
        );
        const newLevels = new Map(
          newCaps.map((cap) => [
            `${cap.module}:${cap.capability}`,
            Number(cap.access_level) || 0,
          ]),
        );

        // Removed = held today but not re-granted at an equal-or-higher level.
        const removed = current.caps
          .filter(
            (cap) =>
              (newLevels.get(`${cap.module}:${cap.capability}`) || 0) <
              cap.access_level,
          )
          .map((cap) => ({
            module: cap.module,
            capability: cap.capability,
            level: cap.access_level,
          }));
        // Gained = the reverse: newly held, or held at a higher level.
        const gained = newCaps
          .filter(
            (cap) =>
              Number(cap.access_level) >
              (currentLevels.get(`${cap.module}:${cap.capability}`) || 0),
          )
          .map((cap) => ({
            module: cap.module,
            capability: cap.capability,
            level: Number(cap.access_level) || 0,
          }));

        const loss = {
          currentSource: current.source,
          currentProfileName: current.profileName || null,
          currentCount: current.caps.length,
          newProfileName: profile.rows[0].name,
          newCount: newCaps.length,
          removedCount: removed.length,
          gainedCount: gained.length,
          removed: removed.slice(0, 25), // capped payload — counts stay exact
        };

        if (newCaps.length === 0) {
          return NextResponse.json(
            {
              success: false,
              requiresConfirmation: true,
              error: "profile_assignment_empty_profile",
              message: `That profile grants no capabilities. Assigning it removes all ${loss.removedCount} capabilities this user has today.`,
              loss,
            },
            { status: 409 },
          );
        }

        if (removed.length > 0) {
          return NextResponse.json(
            {
              success: false,
              requiresConfirmation: true,
              error: "profile_assignment_removes_capabilities",
              message: `This profile grants fewer capabilities than the user has today: ${loss.removedCount} will be removed, ${loss.gainedCount} added.`,
              loss,
            },
            { status: 409 },
          );
        }
      }

      await assignUserAccessProfile(profile_id, user_cid);

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName: user.rows[0].name,
        action: "profile_assigned",
        details: `Assigned access profile: ${profile.rows[0].name}`,
      });
      invalidateAuthorizationContext(user_cid);

      return NextResponse.json({
        success: true,
        message: `User assigned to profile "${profile.rows[0].name}"`,
        profileName: profile.rows[0].name,
      });
    }

    // Remove override
    await clearUserAccessProfileOverride(user_cid);

    // Get the role default that will now apply
    const roleDefault = await getRoleDefaultProfileName(user.rows[0].role);

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: user_cid,
      targetName: user.rows[0].name,
      action: "profile_removed",
      details: `Removed profile override, reverting to ${roleDefault.rows[0]?.name || "legacy"} default`,
    });
    invalidateAuthorizationContext(user_cid);

    return NextResponse.json({
      success: true,
      message: "Profile override removed, falling back to role default",
      roleDefaultName: roleDefault.rows[0]?.name || null,
    });
  } catch (error) {
    console.error("[Assign Profile] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/access-profiles/assign?user_cid=X
 *
 * Get the current profile assignment for a user.
 */
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

    const user = await getContactAssignmentState(userCid);
    if (user.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const userRow = user.rows[0];

    // Get explicitly assigned profile
    let assignedProfile = null;
    if (userRow.access_profile_id) {
      const profile = await getAccessProfileSummary(userRow.access_profile_id);
      if (profile.rows.length > 0) {
        assignedProfile = { id: profile.rows[0].id, name: profile.rows[0].name };
      }
    }

    // Get role default profile
    let roleDefault = null;
    const roleDefaultResult = await getRoleDefaultAccessProfile(userRow.role);
    if (roleDefaultResult.rows.length > 0) {
      roleDefault = {
        id: roleDefaultResult.rows[0].id,
        name: roleDefaultResult.rows[0].name,
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
    console.error("[Assign Profile GET] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
