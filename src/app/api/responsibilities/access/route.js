import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, logPermissionAudit } from "@/lib/auth";
import { normalizeAllowedRoles } from "@/lib/featureAccess";

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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

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
    const existing = await db.execute({
      sql: "SELECT id, name, key, allowed_roles FROM responsibilities WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Responsibility not found" },
        { status: 404 },
      );
    }
    const resp = existing.rows[0];

    let nextValue;
    if (rawRoles === null || rawRoles === undefined) {
      // Explicit reset → back to NULL so the seed defaults apply.
      nextValue = null;
    } else {
      if (!Array.isArray(rawRoles)) {
        return NextResponse.json(
          { success: false, error: "allowed_roles must be an array of roles" },
          { status: 400 },
        );
      }
      // Deduplicate, keep non-empty strings only.
      const cleaned = [...new Set(rawRoles.filter((r) => typeof r === "string" && r.trim()))];
      nextValue = JSON.stringify(cleaned);
    }

    await db.execute({
      sql: "UPDATE responsibilities SET allowed_roles = ?, updated_at = NOW() WHERE id = ?",
      args: [nextValue, id],
    });

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
