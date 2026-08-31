import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, logPermissionAudit } from "@/lib/auth";
import {
  requireAuthorization,
  getAuthorizationContext,
  authorize,
  invalidateAllAuthorizationContexts,
  FEATURE_KEYS,
  IDENTITY_TYPES,
  ELIGIBILITY_IDENTITIES,
  validateEligibilityChanges,
} from "@/lib/authorization";

export const dynamic = "force-dynamic";

/**
 * ELIGIBILITY CONFIGURATION API — the Permissions UI's control center for the
 * "who may receive this feature" boundary.
 *
 *   GET /api/engineering/permissions/eligibility
 *     requires permissions.view_matrix
 *     returns the full feature/identity catalog + current rows + whether the
 *     caller may configure (permissions.configure_eligibility)
 *
 *   PUT /api/engineering/permissions/eligibility
 *     requires permissions.configure_eligibility  (dedicated authority —
 *     deliberately separate from assign_capabilities)
 *     body: { changes: [{feature_key, identity_type, identity_value, eligible}] }
 *     eligible 0|1 → upsert row; null → delete row (fail-closed unset)
 *
 * The resolver consumes exactly these rows — this API only edits the same
 * configuration the engine enforces, and every write invalidates the
 * authorization cache so the new configuration applies immediately.
 */

async function fetchAllRows() {
  const r = await db.execute({
    sql: `SELECT feature_key, identity_type, identity_value, eligible
          FROM feature_eligibility
          ORDER BY feature_key, identity_type, identity_value`,
    args: [],
  });
  return r.rows;
}

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuthorization("permissions", "view_matrix");
    if (authError) return authError;

    const session = await getSession();
    const ctx = await getAuthorizationContext(session);
    const canConfigure = authorize(ctx, "permissions", "configure_eligibility");

    const rows = await fetchAllRows();

    // Distinct groups from user_groups + contacts.group_name fallback.
    const groupsRes = await Promise.all([
      db.execute({
        sql: "SELECT DISTINCT group_name FROM user_groups WHERE group_name IS NOT NULL AND group_name != ''",
        args: [],
      }),
      db.execute({
        sql: "SELECT DISTINCT group_name FROM contacts WHERE group_name IS NOT NULL AND group_name != ''",
        args: [],
      }),
    ]);
    const groups = [
      ...new Set(
        [...groupsRes[0].rows, ...groupsRes[1].rows].map((r) => r.group_name),
      ),
    ].sort();

    return NextResponse.json({
      success: true,
      features: FEATURE_KEYS,
      identityTypes: IDENTITY_TYPES,
      // Agreed eligibility identities only (functions like developer/teacher/
      // program_manager are not eligibility identities). ROLE_CATALOG stays
      // the full technical catalog for gate validation.
      roles: ELIGIBILITY_IDENTITIES,
      groups,
      rows,
      canConfigure: !!canConfigure,
    });
  } catch (e) {
    console.error("[eligibility] GET error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuthorization(
      "permissions",
      "configure_eligibility",
    );
    if (authError) return authError;

    const body = await req.json().catch(() => null);
    const { valid, errors, normalized } = validateEligibilityChanges(
      body?.changes,
    );
    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: "errors.invalidEligibilityChanges",
          detail: errors,
        },
        { status: 400 },
      );
    }

    for (const c of normalized) {
      // Read the previous value for the audit trail.
      const prev = (
        await db.execute({
          sql: `SELECT eligible FROM feature_eligibility
                WHERE feature_key = ? AND identity_type = ? AND identity_value = ?`,
          args: [c.feature_key, c.identity_type, c.identity_value],
        })
      ).rows[0];
      const prevValue = prev ? Number(prev.eligible) : null;

      if (c.eligible === null) {
        await db.execute({
          sql: `DELETE FROM feature_eligibility
                WHERE feature_key = ? AND identity_type = ? AND identity_value = ?`,
          args: [c.feature_key, c.identity_type, c.identity_value],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO feature_eligibility
                  (feature_key, identity_type, identity_value, eligible)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (feature_key, identity_type, identity_value)
                DO UPDATE SET eligible = EXCLUDED.eligible`,
          args: [c.feature_key, c.identity_type, c.identity_value, c.eligible],
        });
      }

      const session = await getSession();
      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: "system",
        targetName: `${c.identity_type}:${c.identity_value}`,
        action: "eligibility_changed",
        details:
          `${c.feature_key} ${c.identity_type}:${c.identity_value} ` +
          `${prevValue === null ? "unset" : prevValue} → ${c.eligible === null ? "unset" : c.eligible}`,
      });
    }

    // Eligibility changes can affect any user — drop the short-TTL context
    // cache so the resolver picks up the new configuration immediately.
    invalidateAllAuthorizationContexts();

    const rows = await fetchAllRows();
    return NextResponse.json({ success: true, rows });
  } catch (e) {
    console.error("[eligibility] PUT error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
