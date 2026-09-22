import { initDb } from "@/lib/db";
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
  ELIGIBILITY_IDENTITY_GROUPS,
  MODULE_TO_FEATURE,
  validateEligibilityChanges,
  findTemplatesGrantingFeature,
} from "@/lib/authorization";
import {
  listFeatureEligibilityRows,
  listDistinctUserGroupNames,
  listDistinctContactGroupNames,
  listEligibilityRoleIdentities,
  listRoleAccessProfileDefaults,
  getEligibilityRow,
  deleteEligibilityRow,
  upsertEligibilityRow,
} from "@/models/authorization";

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
  const r = await listFeatureEligibilityRows();
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
      listDistinctUserGroupNames(),
      listDistinctContactGroupNames(),
    ]);
    const groups = [
      ...new Set(
        [...groupsRes[0].rows, ...groupsRes[1].rows].map((r) => r.group_name),
      ),
    ].sort();

    // Roles the resolver actually consults that are NOT in the curated identity
    // list (mentor, teacher, program_manager…). The administrator
    // must be able to see and configure those ceilings from THIS screen —
    // otherwise a refused template save has no front-end remedy, which is
    // exactly how Staff Default became unsavable. Derived from the data, never a
    // new allowlist: nothing becomes configurable that the engine does not
    // already enforce.
    const [eligibilityRolesRes, roleDefaultsRes] = await Promise.all([
      listEligibilityRoleIdentities(),
      listRoleAccessProfileDefaults(),
    ]);
    const agreedIdentities = new Set(ELIGIBILITY_IDENTITIES);
    const extraRoles = [
      ...new Set([
        ...eligibilityRolesRes.rows.map((r) => r.identity_value),
        ...roleDefaultsRes.rows.map((r) => r.role_name),
      ]),
    ]
      .filter((r) => r && !agreedIdentities.has(r))
      .sort();

    return NextResponse.json({
      success: true,
      features: FEATURE_KEYS,
      identityTypes: IDENTITY_TYPES,
      // Capability module → feature key, so the UI can filter which modules
      // are relevant for a role based on its eligibility.
      moduleToFeature: MODULE_TO_FEATURE,
      // Agreed eligibility identities only (functions like program_manager are
      // not eligibility identities). ROLE_CATALOG stays
      // the full technical catalog for gate validation.
      roles: ELIGIBILITY_IDENTITIES,
      // Roles found in this database that the agreed list does not carry. The
      // UI renders them as a third, clearly-labelled group so no enforced
      // ceiling is invisible.
      extraRoles,
      // The honest split (UI-4c): baseline identities vs the context roles that
      // share the same ceiling table. The UI labels them, never conflates them.
      identityGroups: ELIGIBILITY_IDENTITY_GROUPS,
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

    // C2 — an eligibility DOWNGRADE (0 or unset) can strand capabilities that
    // role-default TEMPLATES still grant. Nothing is deleted automatically: the
    // first attempt reports the impacted templates and asks for an explicit
    // confirmation (`confirm: true`), so the admin decides knowingly.
    const downgrades = normalized.filter(
      (c) => c.identity_type === "role" && c.eligible !== 1,
    );
    if (downgrades.length > 0 && body?.confirm !== true) {
      const impacts = [];
      for (const c of downgrades) {
        const impactRes = await findTemplatesGrantingFeature(
          c.identity_value,
          c.feature_key,
        );
        const byTemplate = new Map();
        for (const r of impactRes.rows || []) {
          if (!byTemplate.has(r.id)) {
            byTemplate.set(r.id, { id: r.id, name: r.name, capabilities: [] });
          }
          byTemplate.get(r.id).capabilities.push(`${r.module}.${r.capability}`);
        }
        if (byTemplate.size > 0) {
          impacts.push({
            role: c.identity_value,
            feature: c.feature_key,
            templates: [...byTemplate.values()],
          });
        }
      }
      if (impacts.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "errors.eligibilityImpactsTemplates",
            requiresConfirmation: true,
            impacts,
          },
          { status: 409 },
        );
      }
    }

    for (const c of normalized) {
      // Read the previous value for the audit trail.
      const prev = (
        await getEligibilityRow(
          c.feature_key,
          c.identity_type,
          c.identity_value,
        )
      ).rows[0];
      const prevValue = prev ? Number(prev.eligible) : null;

      if (c.eligible === null) {
        await deleteEligibilityRow(
          c.feature_key,
          c.identity_type,
          c.identity_value,
        );
      } else {
        await upsertEligibilityRow(
          c.feature_key,
          c.identity_type,
          c.identity_value,
          c.eligible,
        );
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
