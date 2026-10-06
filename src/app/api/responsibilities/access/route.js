import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import { requireAuthorization } from "@/models/authorization/index";
import { normalizeAllowedRoles } from "@/lib/featureAccess";
import {
  getResponsibilityAccess,
  setResponsibilityAllowedRoles,
} from "@/models/responsibilities";
import { resolveAllowedRolesValue } from "@/services/authorization/responsibilityCatalog";

export const dynamic = "force-dynamic";

/**
 * PUT /api/responsibilities/access
 *
 * Super Admin only. Sets which roles can actually access the feature a
 * responsibility grants. The value is stored on the responsibilities row
 * (`allowed_roles`, a JSON array of role keys).
 *
 *   - `[]` means "explicitly nobody" (a real state, respected by warnings).
 *   - `null` / missing means "reset to seed defaults".
 *
 * Body: { id, allowed_roles: string[] | null }
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const id = Number(body?.id);
    const rawRoles = body?.allowed_roles;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "responsibility id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Load the responsibility so we can validate + audit.
    const existing = await getResponsibilityAccess(id);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Responsibility not found" },
        { status: 404 },
      );
    }
    const resp = existing.rows[0];

    // `null`/missing → reset to NULL (seed defaults apply). An array → stored as a
    // deduplicated JSON list. `[]` is a real state ("explicitly nobody"), never
    // collapsed into NULL.
    const resolved = resolveAllowedRolesValue(rawRoles);
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, error: resolved.error },
        { status: 400 },
      );
    }
    const nextValue = resolved.value;

    await setResponsibilityAllowedRoles(id, nextValue);

    await logPermissionAudit({
      actorCid: session.cid,
      actorName: session.name,
      targetCid: null,
      targetName: resp.name,
      action: "responsibility_access_updated",
      module: "responsibilities",
      capability: resp.key,
      previousValue: resp.allowed_roles || null,
      newValue: nextValue,
      details: `Allowed roles for responsibility "${resp.name}" updated`,
    });

    return NextResponse.json({
      success: true,
      responsibility: {
        id: resp.id,
        name: resp.name,
        key: resp.key,
        allowed_roles: normalizeAllowedRoles(nextValue),
      },
    });
  } catch (err) {
    console.error("[Responsibilities Access PUT] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
