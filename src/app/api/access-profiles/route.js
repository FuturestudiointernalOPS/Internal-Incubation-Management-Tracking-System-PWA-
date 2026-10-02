import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getSession,
  PERMISSION_MODULES,
  logPermissionAudit,
} from "@/lib/auth";
import {
  requireAuthorization,
  invalidateAllAuthorizationContexts,
} from "@/models/authorization/index";
import {
  getAccessProfileById,
  getProfileCapabilities,
  listAccessProfiles,
  listRoleAccessProfileDefaults,
  createAccessProfile,
  insertProfileCapability,
  getAccessProfileMeta,
  updateAccessProfileName,
  updateAccessProfileDescription,
  updateAccessProfileActiveState,
  getAccessProfileName,
  deleteAccessProfile,
} from "@/models/authorization";
import {
  normalizeCapabilities,
  assertProfileCanBeDeactivated,
  assertCapsEligibleForProfile,
  replaceProfileCapabilities,
  assertProfileDeletable,
} from "@/services/authorization/accessProfileWrites";

/**
 * GET /api/access-profiles
 *
 * Query params:
 *   ?id=X — get a single profile with capabilities
 *   (none) — list all profiles
 *
 * Returns:
 *   { success, profiles: [...], modules: {...} }
 *   or { success, profile: {...}, capabilities: [...] }
 */
export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("id");

    // Single profile with capabilities
    if (profileId) {
      const profile = await getAccessProfileById(profileId);
      if (profile.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Profile not found" },
          { status: 404 },
        );
      }

      const capabilities = await getProfileCapabilities(profileId);

      return NextResponse.json({
        success: true,
        profile: profile.rows[0],
        capabilities: capabilities.rows,
        modules: PERMISSION_MODULES,
      });
    }

    // List all profiles with role mappings
    const profiles = await listAccessProfiles();

    // Get role mappings for each profile
    const roleDefaults = await listRoleAccessProfileDefaults();

    // Build role→profile map
    const roleProfileMap = {};
    for (const row of roleDefaults.rows) {
      roleProfileMap[row.role_name] = {
        profileId: row.access_profile_id,
        profileName: row.profile_name,
      };
    }

    return NextResponse.json({
      success: true,
      profiles: profiles.rows,
      roleDefaults: roleProfileMap,
      modules: PERMISSION_MODULES,
    });
  } catch (error) {
    console.error("[Access Profiles] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/access-profiles
 *
 * Create a new access profile.
 * Body: { name, description, capabilities: { module: { capability: level } } }
 */
export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const { name, description, capabilities } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Profile name is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Create profile
    const result = await createAccessProfile(name.trim(), description || "");

    const profileId = Number(result.rows[0]?.id ?? result.lastInsertRowid);

    // Add capabilities if provided
    if (capabilities && typeof capabilities === "object") {
      const normalizedCapabilities = normalizeCapabilities(capabilities);
      for (const [module, moduleCapabilities] of Object.entries(normalizedCapabilities)) {
        for (const [capability, level] of Object.entries(moduleCapabilities)) {
          await insertProfileCapability(profileId, module, capability, level);
        }
      }
    }

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: name,
      action: "profile_created",
      details: `Created access profile: ${name}`,
    });
    // A new profile only matters once assigned/defaulted — safe to clear.
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      profileId,
      message: `Profile "${name}" created`,
    });
  } catch (error) {
    console.error("[Access Profiles] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/access-profiles
 *
 * Update an access profile.
 * Body: { id, name?, description?, is_active?, capabilities?: { module: { capability: level } }, reason? }
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const { id, name, description, is_active, capabilities, reason } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Profile id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Check profile exists
    const existing = await getAccessProfileMeta(id);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    const profileName = name !== undefined ? name.trim() : existing.rows[0]?.name || "Unknown";

    // Update profile fields
    if (name !== undefined) {
      await updateAccessProfileName(name.trim(), id);
    }
    if (description !== undefined) {
      await updateAccessProfileDescription(description, id);
    }
    if (is_active !== undefined) {
      // Phase 7 governance: a profile that is a role default must never be
      // disabled through the API — that would silently drop the role's
      // default access (resolver falls back to legacy role_capabilities).
      // Change the role default first.
      if (!is_active) {
        const gate = await assertProfileCanBeDeactivated(id);
        if (!gate.allowed) {
          return NextResponse.json(
            {
              success: false,
              error: `Cannot disable: profile is the default for role(s): ${gate.roles.join(", ")}. Change the role default first.`,
            },
            { status: 400 },
          );
        }
      }
      await updateAccessProfileActiveState(is_active ? 1 : 0, id);
    }

    // Replace capabilities if provided
    if (capabilities && typeof capabilities === "object") {
      // Eligibility is the boundary: when this profile is the default for
      // role(s), none of those roles may receive a capability whose feature
      // they are not eligible for.
      const check = await assertCapsEligibleForProfile(capabilities, id);
      if (!check.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "errors.ineligibleTemplateCaps",
            violations: check.violations,
            role: check.role,
          },
          { status: 400 },
        );
      }

      await replaceProfileCapabilities(id, capabilities);
    }

    const reasonNote =
      reason && typeof reason === "string" && reason.trim()
        ? ` Reason: ${reason.trim()}`
        : "";
    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: profileName,
      action: "profile_updated",
      details: `Updated access profile: ${profileName}${reasonNote}`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      message: "Profile updated",
    });
  } catch (error) {
    console.error("[Access Profiles] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/access-profiles?id=X
 *
 * Delete an access profile.
 */
export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Profile id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Reference guards: role default → people → context mappings, in that order.
    const gate = await assertProfileDeletable(id);
    if (gate.blocked) {
      const { blocked: _blocked, ...refusal } = gate;
      return NextResponse.json(
        { success: false, ...refusal },
        { status: 400 },
      );
    }

    // Get profile name for audit
    const profile = await getAccessProfileName(id);

    // Delete (cascade will remove capabilities)
    await deleteAccessProfile(id);

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: profile.rows[0]?.name || "Unknown",
      action: "profile_deleted",
      details:
        "Deleted access profile (no users, role defaults or context roles referenced it)",
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      message: "Profile deleted",
    });
  } catch (error) {
    console.error("[Access Profiles] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
