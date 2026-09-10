import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession, logPermissionAudit } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { getAccessProfileMeta, listAccessProfiles } from "@/models/authorization";
import {
  CONTEXT_ROLE_CONTEXTS,
  ensureContextRoleProfilesSchema,
  seedContextRoleProfiles,
  listContextRoleProfiles,
  upsertContextRoleProfile,
  countContextRoleHolders,
  isValidContextRoleContext,
  isValidContextRoleKey,
} from "@/models/authorization/contextRoleProfiles";

export const dynamic = "force-dynamic";

/**
 * CONTEXT ROLE → PROFILE REGISTRY API (Phase 4).
 *
 *   GET  requires permissions.view_matrix
 *        → registry rows (+ mapped profile name), holder counts, profiles list
 *        Seeds the initial mapping on first read (idempotent, DO NOTHING).
 *
 *   PUT  requires permissions.assign_capabilities
 *        body: { context, role_key, profile_id|null, is_active?, notes?, reason? }
 *        → upsert one mapping + permission audit entry
 *
 * This API edits a GOVERNANCE REGISTRY only. The resolver does not read it —
 * no authorization behavior changes in this phase, so no cache invalidation is
 * performed here. The phase that starts consuming the registry must add it.
 */
export async function GET() {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const seeded = await seedContextRoleProfiles();
    const rolesRes = await listContextRoleProfiles();
    const profilesRes = await listAccessProfiles();

    const roles = [];
    for (const row of rolesRes.rows) {
      roles.push({
        ...row,
        holders: await countContextRoleHolders(row.context, row.role_key),
      });
    }

    return NextResponse.json({
      success: true,
      contexts: CONTEXT_ROLE_CONTEXTS,
      roles,
      profiles: profilesRes.rows,
      seeded,
    });
  } catch (err) {
    console.error("[Context Roles] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const session = await getSession();
    const body = await req.json();
    const { context, role_key, profile_id, is_active, notes, reason } = body;

    if (!isValidContextRoleContext(context) || !isValidContextRoleKey(role_key)) {
      return NextResponse.json(
        {
          success: false,
          error: `context must be one of: ${CONTEXT_ROLE_CONTEXTS.join(", ")} and role_key must be a lowercase identifier`,
        },
        { status: 400 },
      );
    }

    const rawProfileId =
      profile_id === null || profile_id === undefined || profile_id === ""
        ? null
        : Number(profile_id);
    if (
      rawProfileId !== null &&
      (!Number.isInteger(rawProfileId) || rawProfileId <= 0)
    ) {
      return NextResponse.json(
        { success: false, error: "profile_id must be a positive integer or null" },
        { status: 400 },
      );
    }

    let profileName = null;
    if (rawProfileId !== null) {
      const meta = await getAccessProfileMeta(rawProfileId);
      if (meta.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Profile not found" },
          { status: 400 },
        );
      }
      profileName = meta.rows[0].name;
    }

    const isActive = is_active === undefined ? true : Boolean(is_active);
    const notesText = typeof notes === "string" ? notes.slice(0, 500) : "";

    await ensureContextRoleProfilesSchema();
    await upsertContextRoleProfile({
      context,
      roleKey: role_key,
      profileId: rawProfileId,
      isActive,
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
      targetName: `${context}:${role_key}`,
      action: "context_role_profile_updated",
      details: `Context role ${context}:${role_key} → ${
        profileName || "no default"
      }${isActive ? "" : " (inactive)"}${reasonNote}`,
    });

    // Phase 4 is governance-only: the resolver does not consume this registry,
    // so there is deliberately no invalidateAllAuthorizationContexts() here.
    // When a later phase wires the registry into resolution, it MUST add the
    // invalidation to this write path (and to the membership-apply path).

    return NextResponse.json({
      success: true,
      mapping: {
        context,
        role_key,
        profile_id: rawProfileId,
        profile_name: profileName,
        is_active: isActive ? 1 : 0,
        notes: notesText,
      },
    });
  } catch (err) {
    console.error("[Context Roles] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
