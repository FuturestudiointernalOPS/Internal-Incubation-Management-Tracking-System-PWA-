import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getSession,
  PERMISSION_MODULES,
  logPermissionAudit,
} from "@/lib/auth";
import {
  requireAuthorization,
  invalidateAllAuthorizationContexts,
  MODULE_TO_FEATURE,
  evaluateEligibility,
  validateCapabilitiesWithinEligibility,
} from "@/lib/authorization";

/**
 * Dependency normalization for profile capabilities.
 *
 * View is the base capability: in any module that carries a `view`
 * capability, granting another action (edit / create / delete / …) without
 * view is impossible — view is auto-granted (level 1). Zero rows are dropped
 * (absence already means level 0).
 */
function normalizeCapabilities(caps) {
  const out = {};
  for (const [module, capMap] of Object.entries(caps || {})) {
    if (!capMap || typeof capMap !== "object") continue;
    const next = {};
    for (const [capability, level] of Object.entries(capMap)) {
      const lvl = Math.max(0, Number(level) || 0);
      if (lvl > 0) next[capability] = lvl;
    }
    if (Object.prototype.hasOwnProperty.call(next, "view") && next.view === 0) {
      const othersActive = Object.keys(next).some(
        (c) => c !== "view" && next[c] > 0,
      );
      if (othersActive) next.view = 1; // edit/create/delete imply view
    }
    if (Object.keys(next).length > 0) out[module] = next;
  }
  return out;
}

/** Roles that use this profile as their default access template. */
async function profileDefaultRoles(profileId) {
  const res = await db.execute({
    sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
    args: [profileId],
  });
  return res.rows.map((r) => r.role_name);
}

/** Per-feature eligibility map for a role (fail closed on missing rows). */
async function eligibilityForRole(role) {
  const res = await db.execute({
    sql: `SELECT feature_key, eligible FROM feature_eligibility
          WHERE identity_type = 'role' AND identity_value = ?`,
    args: [role],
  });
  const map = {};
  for (const feature of Object.values(MODULE_TO_FEATURE)) {
    map[feature] = evaluateEligibility(res.rows, feature);
  }
  return map;
}

/**
 * A profile that is the default for role(s) must never grant a capability
 * whose feature one of those roles is not eligible for. Mirrors
 * assertTemplateCapsEligible (role-defaults route) but validates the incoming
 * payload instead of the persisted rows.
 */
async function assertCapsEligibleForRoles(caps, roles) {
  for (const role of roles) {
    const eligibility = await eligibilityForRole(role);
    const { valid, violations } = validateCapabilitiesWithinEligibility(
      caps,
      eligibility,
    );
    if (!valid) return { valid: false, violations, role };
  }
  return { valid: true, violations: [], role: null };
}

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
      const profile = await db.execute({
        sql: "SELECT id, name, description, is_active FROM access_profiles WHERE id = ?",
        args: [profileId],
      });
      if (profile.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Profile not found" },
          { status: 404 },
        );
      }

      const capabilities = await db.execute({
        sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ? ORDER BY module, capability",
        args: [profileId],
      });

      return NextResponse.json({
        success: true,
        profile: profile.rows[0],
        capabilities: capabilities.rows,
        modules: PERMISSION_MODULES,
      });
    }

    // List all profiles with role mappings
    const profiles = await db.execute({
      sql: `SELECT ap.*,
            (SELECT COUNT(*) FROM access_profile_capabilities apc WHERE apc.profile_id = ap.id) as capability_count
            FROM access_profiles ap ORDER BY ap.name`,
    });

    // Get role mappings for each profile
    const roleDefaults = await db.execute({
      sql: `SELECT rpd.role_name, rpd.access_profile_id, ap.name as profile_name
            FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            ORDER BY rpd.role_name`,
    });

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
  } catch (err) {
    console.error("[Access Profiles] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
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
    const result = await db.execute({
      sql: `INSERT INTO access_profiles (name, description, is_active)
            VALUES (?, ?, 1) RETURNING id`,
      args: [name.trim(), description || ""],
    });

    const profileId = Number(result.rows[0]?.id ?? result.lastInsertRowid);

    // Add capabilities if provided
    if (capabilities && typeof capabilities === "object") {
      const normalized = normalizeCapabilities(capabilities);
      for (const [module, caps] of Object.entries(normalized)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)`,
            args: [profileId, module, capability, level],
          });
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
  } catch (err) {
    console.error("[Access Profiles] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/access-profiles
 *
 * Update an access profile.
 * Body: { id, name?, description?, is_active?, capabilities?: { module: { capability: level } } }
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const { id, name, description, is_active, capabilities } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Profile id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Check profile exists
    const existing = await db.execute({
      sql: "SELECT id, name FROM access_profiles WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    // Update profile fields
    if (name !== undefined) {
      await db.execute({
        sql: "UPDATE access_profiles SET name = ?, updated_at = NOW() WHERE id = ?",
        args: [name.trim(), id],
      });
    }
    if (description !== undefined) {
      await db.execute({
        sql: "UPDATE access_profiles SET description = ?, updated_at = NOW() WHERE id = ?",
        args: [description, id],
      });
    }
    if (is_active !== undefined) {
      // Phase 7 governance: a profile that is a role default must never be
      // disabled through the API — that would silently drop the role's
      // default access (resolver falls back to legacy role_capabilities).
      // Change the role default first.
      if (!is_active) {
        const refs = await db.execute({
          sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
          args: [id],
        });
        if (refs.rows.length > 0) {
          const roles = refs.rows.map((r) => r.role_name).join(", ");
          return NextResponse.json(
            {
              success: false,
              error: `Cannot disable: profile is the default for role(s): ${roles}. Change the role default first.`,
            },
            { status: 400 },
          );
        }
      }
      await db.execute({
        sql: "UPDATE access_profiles SET is_active = ?, updated_at = NOW() WHERE id = ?",
        args: [is_active ? 1 : 0, id],
      });
    }

    // Replace capabilities if provided
    if (capabilities && typeof capabilities === "object") {
      const normalized = normalizeCapabilities(capabilities);

      // Eligibility is the boundary: when this profile is the default for
      // role(s), none of those roles may receive a capability whose feature
      // they are not eligible for.
      const defaultRoles = await profileDefaultRoles(id);
      if (defaultRoles.length > 0) {
        const check = await assertCapsEligibleForRoles(normalized, defaultRoles);
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
      }

      // Clear existing
      await db.execute({
        sql: "DELETE FROM access_profile_capabilities WHERE profile_id = ?",
        args: [id],
      });

      // Insert new
      for (const [module, caps] of Object.entries(normalized)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)`,
            args: [id, module, capability, level],
          });
        }
      }
    }

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: profileName,
      action: "profile_updated",
      details: `Updated access profile: ${profileName}`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      message: "Profile updated",
    });
  } catch (err) {
    console.error("[Access Profiles] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
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

    // Check if any role defaults reference this profile
    const roleRefs = await db.execute({
      sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
      args: [id],
    });

    if (roleRefs.rows.length > 0) {
      const roles = roleRefs.rows.map((r) => r.role_name).join(", ");
      return NextResponse.json({
        success: false,
        error: `Cannot delete: profile is the default for role(s): ${roles}. Change the role default first.`,
      });
    }

    // Check if any users reference this profile
    const userRefs = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM contacts WHERE access_profile_id = ?",
      args: [id],
    });

    // Get profile name for audit
    const profile = await db.execute({
      sql: "SELECT name FROM access_profiles WHERE id = ?",
      args: [id],
    });

    // Delete (cascade will remove capabilities)
    await db.execute({
      sql: "DELETE FROM access_profiles WHERE id = ?",
      args: [id],
    });

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: profile.rows[0]?.name || "Unknown",
      action: "profile_deleted",
      details: `Deleted access profile with ${userRefs.rows[0]?.cnt || 0} users still assigned`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      message: "Profile deleted",
    });
  } catch (err) {
    console.error("[Access Profiles] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
