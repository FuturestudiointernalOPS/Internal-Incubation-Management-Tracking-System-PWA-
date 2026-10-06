import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import {
  requireAuthorization,
  invalidateAllAuthorizationContexts,
} from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import {
  PROFILE_CONTEXTS,
  PROFILE_ROLE_ENFORCEMENT,
  getProfileDefinition,
} from "@/models/authorization/profile-catalog";
import {
  ensureProfilesSchema,
  seedProfiles,
  listProfiles,
  getProfileRow,
  updateProfile,
  insertProfile,
  deleteProfile,
} from "@/models/authorization/profilesStore";
import {
  ensureProfileAssignmentsSchema,
  countActiveAssignmentsForProfileKey,
} from "@/models/authorization/profileAssignmentsStore";
import { countContextRoleProfilesByKey } from "@/models/authorization/contextRoleProfiles";
import {
  normalizeAllowedRoles,
  validateProfileUpdate,
  validateProfileCreate,
} from "@/services/authorization/profileCatalog";
import {
  ensureProfileCapabilitiesSchema,
  listProfileCapabilities,
  listProfileCapabilityCounts,
  replaceProfileCapabilities,
  deleteProfileCapabilities,
  assertCapsEligibleForProfileKey,
  listRolesUsingProfileDefault,
} from "@/services/authorization/profileCapabilities";

export const dynamic = "force-dynamic";

/**
 * PROFILE CATALOGUE API — the source of truth for profiles and their
 * capabilities (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 *   GET  requires permissions.view_matrix
 *        ?key=<key> → one profile with its capabilities
 *        (none)     → the whole catalogue, each row with a capability_count
 *        Seeds the initial rows on first read (idempotent, DO NOTHING).
 *        State-changing GET (CSRF-1) — same-origin only.
 *
 *   PUT  requires permissions.configure_eligibility
 *        body: { key, allowed_roles, is_active?, notes?, capabilities?, reason? }
 *        → edit one profile; capabilities replace the profile's whole set when
 *          present (the same eligibility ceiling the access-profile editor
 *          enforced, checked against the profile's role defaults).
 *
 *   POST requires permissions.configure_eligibility
 *        body: { key, label, context, allowed_roles?, capabilities? }
 *        → create a profile. Profiles are DYNAMIC: a key is a free identifier.
 *
 *   DELETE requires permissions.configure_eligibility
 *        ?key=<key> → delete a profile, refused while a role default, a held
 *        assignment, or a context registry row still references it.
 */

/** The wire shape of one profile row. */
function shapeProfile(row, definition, capabilities, capabilityCount) {
  const shaped = {
    key: row.key,
    context: row.context,
    label: row.label || null,
    label_key: definition.labelKey || null,
    allowed_roles: normalizeAllowedRoles(row.allowed_roles),
    is_active: Number(row.is_active) === 1 ? 1 : 0,
    notes: row.notes || "",
  };
  if (capabilities !== undefined) shaped.capabilities = capabilities;
  if (capabilityCount !== undefined) shaped.capability_count = capabilityCount;
  return shaped;
}

export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await ensureProfilesSchema();
    await ensureProfileCapabilitiesSchema();
    try {
      await seedProfiles();
    } catch (error) {
      // The catalogue is still readable even when a reseed fails; the rows the
      // database already holds are what the screen shows.
      console.warn("[Profiles] seed failed:", error.message);
    }

    const key = new URL(req.url || "http://localhost").searchParams.get("key");

    if (key) {
      const row = (await getProfileRow(key)).rows?.[0];
      if (!row) {
        return NextResponse.json(
          { success: false, error: "Profile not found" },
          { status: 404 },
        );
      }
      const capabilities = await listProfileCapabilities(row.key);
      return NextResponse.json({
        success: true,
        contexts: PROFILE_CONTEXTS,
        role_enforcement: PROFILE_ROLE_ENFORCEMENT,
        profile: shapeProfile(row, getProfileDefinition(row.key) || {}, capabilities),
      });
    }

    const [result, counts] = await Promise.all([
      listProfiles(),
      listProfileCapabilityCounts(),
    ]);
    const profiles = (result.rows || []).map((row) =>
      shapeProfile(row, getProfileDefinition(row.key) || {}, undefined, counts[row.key] ?? 0),
    );

    return NextResponse.json({
      success: true,
      contexts: PROFILE_CONTEXTS,
      // Phase B — the profile ↔ role rule's current mode. "warn" reports an
      // écart without blocking; "block" (Phase H) refuses it.
      role_enforcement: PROFILE_ROLE_ENFORCEMENT,
      profiles,
    });
  } catch (error) {
    console.error("[Profiles] GET error:", error);
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
    const { key, allowed_roles, is_active, notes, capabilities, reason } = body;

    const check = validateProfileUpdate({ key, allowed_roles, is_active });
    if (!check.valid) {
      return NextResponse.json(
        { success: false, error: check.errors.join("; ") },
        { status: 400 },
      );
    }

    await ensureProfilesSchema();
    await ensureProfileCapabilitiesSchema();
    try {
      await seedProfiles();
    } catch (error) {
      console.warn("[Profiles] seed failed before write:", error.message);
    }

    const existing = (await getProfileRow(check.normalized.key)).rows?.[0];
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    const notesText = typeof notes === "string" ? notes.slice(0, 500) : existing.notes || "";

    await updateProfile({
      key: check.normalized.key,
      allowedRoles: check.normalized.allowed_roles,
      isActive: check.normalized.is_active,
      notes: notesText,
    });

    if (capabilities && typeof capabilities === "object") {
      const ceiling = await assertCapsEligibleForProfileKey(
        capabilities,
        check.normalized.key,
      );
      if (!ceiling.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "errors.ineligibleTemplateCaps",
            violations: ceiling.violations,
            role: ceiling.role,
          },
          { status: 400 },
        );
      }
      await replaceProfileCapabilities(check.normalized.key, capabilities);
    }

    const reasonNote =
      reason && typeof reason === "string" && reason.trim()
        ? ` Reason: ${reason.trim()}`
        : "";
    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: check.normalized.key,
      action: "profile_updated",
      details: `Profile ${check.normalized.key} → roles [${
        check.normalized.allowed_roles.join(", ") || "none"
      }]${check.normalized.is_active ? "" : " (inactive)"}${
        capabilities && typeof capabilities === "object" ? " + capabilities" : ""
      }${reasonNote}`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      role_enforcement: PROFILE_ROLE_ENFORCEMENT,
      profile: {
        key: check.normalized.key,
        allowed_roles: check.normalized.allowed_roles,
        is_active: check.normalized.is_active ? 1 : 0,
        notes: notesText,
      },
    });
  } catch (error) {
    console.error("[Profiles] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "configure_eligibility");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const body = await req.json();
    const { key, label, context, allowed_roles, capabilities } = body;

    const check = validateProfileCreate({ key, label, context, allowed_roles });
    if (!check.valid) {
      return NextResponse.json(
        { success: false, error: check.errors.join("; ") },
        { status: 400 },
      );
    }

    await ensureProfilesSchema();
    await ensureProfileCapabilitiesSchema();
    await ensureProfileAssignmentsSchema();

    const existing = (await getProfileRow(check.normalized.key)).rows?.[0];
    if (existing) {
      return NextResponse.json(
        { success: false, error: "profile_exists" },
        { status: 409 },
      );
    }

    await insertProfile({
      key: check.normalized.key,
      context: check.normalized.context,
      allowedRoles: check.normalized.allowed_roles,
      label: check.normalized.label,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : "",
    });

    if (capabilities && typeof capabilities === "object") {
      await replaceProfileCapabilities(check.normalized.key, capabilities);
    }

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: check.normalized.key,
      action: "profile_created",
      details: `Created profile ${check.normalized.key} (${check.normalized.label})`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({
      success: true,
      profile: {
        key: check.normalized.key,
        context: check.normalized.context,
        label: check.normalized.label,
        allowed_roles: check.normalized.allowed_roles,
        is_active: 1,
      },
    });
  } catch (error) {
    console.error("[Profiles] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "configure_eligibility");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const key = new URL(req.url || "http://localhost").searchParams.get("key");
    if (!key) {
      return NextResponse.json(
        { success: false, error: "Profile key is required" },
        { status: 400 },
      );
    }

    await ensureProfilesSchema();
    await ensureProfileCapabilitiesSchema();
    await ensureProfileAssignmentsSchema();

    const existing = (await getProfileRow(key)).rows?.[0];
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    // Reference guards, in order: role default → held assignment → context row.
    const roleRefs = await listRolesUsingProfileDefault(key);
    const roles = (roleRefs.rows || []).map((row) => row.role_name);
    if (roles.length > 0) {
      return NextResponse.json(
        { success: false, error: "profile_in_use_role_default", roles },
        { status: 400 },
      );
    }

    const assignedRes = await countActiveAssignmentsForProfileKey(key);
    const assignedCount = Number(assignedRes.rows?.[0]?.n || 0);
    if (assignedCount > 0) {
      return NextResponse.json(
        { success: false, error: "profile_in_use_assignments", assignedCount },
        { status: 400 },
      );
    }

    const contextRes = await countContextRoleProfilesByKey(key);
    const contextCount = Number(contextRes.rows?.[0]?.n || 0);
    if (contextCount > 0) {
      return NextResponse.json(
        { success: false, error: "profile_in_use_context", contextCount },
        { status: 400 },
      );
    }

    await deleteProfileCapabilities(key);
    await deleteProfile(key);

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: key,
      action: "profile_deleted",
      details: `Deleted profile ${key}`,
    });
    invalidateAllAuthorizationContexts();

    return NextResponse.json({ success: true, message: "Profile deleted" });
  } catch (error) {
    console.error("[Profiles] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
