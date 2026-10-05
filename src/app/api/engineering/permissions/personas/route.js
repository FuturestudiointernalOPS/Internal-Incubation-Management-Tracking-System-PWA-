import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import { requireAuthorization } from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import {
  PERSONA_CONTEXTS,
  getPersonaDefinition,
} from "@/models/authorization/persona-catalog";
import {
  ensurePersonasSchema,
  seedPersonas,
  listPersonas,
  updatePersona,
} from "@/models/authorization/personasStore";
import {
  normalizeAllowedRoles,
  validatePersonaUpdate,
} from "@/services/authorization/personaCatalog";

export const dynamic = "force-dynamic";

/**
 * PERSONA CATALOGUE API (Phase A).
 *
 *   GET  requires permissions.view_matrix
 *        → the catalogue rows (context, allowed baseline roles, active, notes).
 *        Seeds the initial rows on first read (idempotent, DO NOTHING).
 *        State-changing GET (CSRF-1) — same-origin only.
 *
 *   PUT  requires permissions.configure_eligibility
 *        body: { key, allowed_roles, is_active?, notes?, reason? }
 *        → edit one persona (allowed_roles / is_active / notes) + audit entry.
 *
 * The catalogue is DATA about who may hold which persona. Phase A stores it;
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

    await ensurePersonasSchema();
    try {
      await seedPersonas();
    } catch (error) {
      // The catalogue is still readable even when a reseed fails; the rows the
      // database already holds are what the screen shows.
      console.warn("[Personas] seed failed:", error.message);
    }

    const result = await listPersonas();
    const personas = result.rows.map((row) => {
      const definition = getPersonaDefinition(row.key) || {};
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
      contexts: PERSONA_CONTEXTS,
      personas,
    });
  } catch (error) {
    console.error("[Personas] GET error:", error);
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

    const check = validatePersonaUpdate({ key, allowed_roles, is_active });
    if (!check.valid) {
      return NextResponse.json(
        { success: false, error: check.errors.join("; ") },
        { status: 400 },
      );
    }

    const notesText = typeof notes === "string" ? notes.slice(0, 500) : "";

    await ensurePersonasSchema();
    try {
      await seedPersonas();
    } catch (error) {
      console.warn("[Personas] seed failed before write:", error.message);
    }

    await updatePersona({
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
      action: "persona_updated",
      details: `Persona ${check.normalized.key} → roles [${
        check.normalized.allowed_roles.join(", ") || "none"
      }]${check.normalized.is_active ? "" : " (inactive)"}${reasonNote}`,
    });

    return NextResponse.json({
      success: true,
      persona: {
        key: check.normalized.key,
        allowed_roles: check.normalized.allowed_roles,
        is_active: check.normalized.is_active ? 1 : 0,
        notes: notesText,
      },
    });
  } catch (error) {
    console.error("[Personas] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
