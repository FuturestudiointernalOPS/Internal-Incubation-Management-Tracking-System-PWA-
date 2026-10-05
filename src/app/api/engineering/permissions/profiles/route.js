import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import { requireAuthorization } from "@/models/authorization/index";
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
  updateProfile,
} from "@/models/authorization/profilesStore";
import {
  normalizeAllowedRoles,
  validateProfileUpdate,
} from "@/services/authorization/profileCatalog";

export const dynamic = "force-dynamic";

/**
 * PROFILE CATALOGUE API (Phase A).
 *
 *   GET  requires permissions.view_matrix
 *        → the catalogue rows (context, allowed baseline roles, active, notes).
 *        Seeds the initial rows on first read (idempotent, DO NOTHING).
 *        State-changing GET (CSRF-1) — same-origin only.
 *
 *   PUT  requires permissions.configure_eligibility
 *        body: { key, allowed_roles, is_active?, notes?, reason? }
 *        → edit one profile (allowed_roles / is_active / notes) + audit entry.
 *
 * The catalogue is DATA about who may hold which profile. Phase A stores it;
 * the enforcement (automatic attribution, eligibility ceiling) arrives in the
 * later roadmap phases. Nothing here changes anyone's effective access.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await ensureProfilesSchema();
    try {
      await seedProfiles();
    } catch (error) {
      // The catalogue is still readable even when a reseed fails; the rows the
      // database already holds are what the screen shows.
      console.warn("[Profiles] seed failed:", error.message);
    }

    const result = await listProfiles();
    const profiles = result.rows.map((row) => {
      const definition = getProfileDefinition(row.key) || {};
      return {
        key: row.key,
        context: row.context,
        label_key: definition.labelKey || null,
        allowed_roles: normalizeAllowedRoles(row.allowed_roles),
        is_active: Number(row.is_active) === 1 ? 1 : 0,
        notes: row.notes || "",
      };
    });

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
    const { key, allowed_roles, is_active, notes, reason } = body;

    const check = validateProfileUpdate({ key, allowed_roles, is_active });
    if (!check.valid) {
      return NextResponse.json(
        { success: false, error: check.errors.join("; ") },
        { status: 400 },
      );
    }

    const notesText = typeof notes === "string" ? notes.slice(0, 500) : "";

    await ensureProfilesSchema();
    try {
      await seedProfiles();
    } catch (error) {
      console.warn("[Profiles] seed failed before write:", error.message);
    }

    await updateProfile({
      key: check.normalized.key,
      allowedRoles: check.normalized.allowed_roles,
      isActive: check.normalized.is_active,
      notes: notesText,
    });

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
      }]${check.normalized.is_active ? "" : " (inactive)"}${reasonNote}`,
    });

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
