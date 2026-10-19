import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import {
  requireAuthorization,
  getAuthorizationContext,
  invalidateAllAuthorizationContexts,
  FEATURE_KEYS,
  IDENTITY_TYPES,
  ELIGIBILITY_IDENTITIES,
  ELIGIBILITY_IDENTITY_GROUPS,
  MODULE_TO_FEATURE,
  validateEligibilityChanges,
  findTemplatesGrantingFeature,
} from "@/models/authorization/index";
import {
  resolveCanConfigure,
  selectTemplateImpactCandidates,
  collectTemplateImpacts,
  resolveEligibilityWrite,
  formatEligibilityAuditDetails,
} from "@/services/authorization/eligibilityConfiguration";
import { findOpenCeilingsWithoutRights, findRightsOnClosedCeiling, findUnassignableProfiles } from "@/services/authorization/eligibilityAdmin";
import {
  listFeatureEligibilityRows,
  getEligibilityRow,
  deleteEligibilityRow,
  upsertEligibilityRow,
} from "@/models/authorization";
import { listProfiles, ensureProfilesSchema } from "@/models/authorization/profilesStore";
import { listProfileCapabilities } from "@/models/authorization/profileCapabilitiesStore";
import { ensureProfileCapabilitiesSchema } from "@/models/authorization/profileCapabilitiesStore";

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
  const result = await listFeatureEligibilityRows();
  return result.rows;
}

/**
 * §12.3 — the per-PROFILE configuration alerts:
 *   - OPEN CEILING WITH NO RIGHT: eligible, yet no capability of the feature;
 *   - RIGHT ON A CLOSED CEILING: an explicit deny row, yet a capability held.
 *
 * The pure detectors decide; this only feeds them each profile's OWN rows and
 * capabilities. Best-effort: a read failure yields no alert, never a 500.
 */
async function collectProfileAlerts(rows, profileKeys) {
  const ceilingAlerts = [];
  const rightAlerts = [];
  for (const profileKey of profileKeys) {
    try {
      const openEligibility = {};
      const closedEligibility = {};
      for (const row of rows) {
        if (row.identity_type !== "profile") continue;
        if (String(row.identity_value) !== String(profileKey)) continue;
        if (Number(row.eligible) === 1) openEligibility[row.feature_key] = true;
        else if (Number(row.eligible) === 0) closedEligibility[row.feature_key] = true;
      }

      const capsRes = await listProfileCapabilities(profileKey);
      const capabilities = {};
      for (const cap of capsRes.rows || []) {
        capabilities[cap.module] = capabilities[cap.module] || {};
        capabilities[cap.module][cap.capability] = Number(cap.access_level) || 0;
      }

      if (Object.keys(openEligibility).length > 0) {
        for (const finding of findOpenCeilingsWithoutRights({ eligibility: openEligibility, capabilities })) {
          ceilingAlerts.push({
            identityType: "profile",
            identityValue: profileKey,
            feature: finding.feature,
            modules: finding.modules,
          });
        }
      }
      if (Object.keys(closedEligibility).length > 0) {
        for (const finding of findRightsOnClosedCeiling({ closedEligibility, capabilities })) {
          rightAlerts.push({
            identityType: "profile",
            identityValue: profileKey,
            feature: finding.feature,
            module: finding.module,
            capabilities: finding.capabilities,
          });
        }
      }
    } catch (error) {
      console.warn(`[eligibility] profile alert failed for ${profileKey}:`, error.message);
    }
  }
  return { ceilingAlerts, rightAlerts };
}

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuthorization("permissions", "view_matrix");
    if (authError) return authError;

    const session = await getSession();
    const authorizationContext = await getAuthorizationContext(session);
    const canConfigure = resolveCanConfigure(authorizationContext);

    const rows = await fetchAllRows();

    // The profiles come from the DATABASE (the catalogue table is the source of
    // truth), never from a hardcoded list: a profile created, renamed or deleted
    // from the profiles screen is offered here on the next read. The capabilities
    // schema is ensured too — `profiles.label` is added by it, and `listProfiles`
    // selects that column, so a drifted database must not make this read 500.
    await ensureProfilesSchema();
    await ensureProfileCapabilitiesSchema();
    const profilesRes = await listProfiles();
    const profiles = (profilesRes.rows || [])
      .map((row) => row.key)
      .sort();

    // §12.3 — configuration alerts: profiles whose ceiling and rights disagree,
    // and a profile no baseline role may hold.
    const { ceilingAlerts, rightAlerts } = await collectProfileAlerts(rows, profiles);
    const unassignableProfiles = findUnassignableProfiles(profilesRes.rows || []);

    return NextResponse.json({
      success: true,
      features: FEATURE_KEYS,
      identityTypes: IDENTITY_TYPES,
      // Capability module → feature key, so the UI can filter which modules
      // are relevant for a role based on its eligibility.
      moduleToFeature: MODULE_TO_FEATURE,
      // The role identities: the three BASELINE identities only. Every
      // contextual function is a PROFILE (see `profiles` below), never a role.
      roles: ELIGIBILITY_IDENTITIES,
      identityGroups: ELIGIBILITY_IDENTITY_GROUPS,
      // The profile keys a ceiling can be written against — read from the DB.
      profiles,
      rows,
      canConfigure: !!canConfigure,
      ceilingAlerts,
      rightAlerts,
      unassignableProfiles,
    });
  } catch (error) {
    console.error("[eligibility] GET error:", error.message);
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

    // Validate against the profiles that EXIST: a ceiling may only name a role
    // of the baseline or a profile the database holds.
    const profilesRes = await listProfiles();
    const profileKeys = (profilesRes.rows || []).map((row) => row.key);

    const { valid, errors, normalized } = validateEligibilityChanges(
      body?.changes,
      profileKeys,
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
    const downgrades = selectTemplateImpactCandidates(normalized);
    if (downgrades.length > 0 && body?.confirm !== true) {
      const impacts = await collectTemplateImpacts(
        downgrades,
        findTemplatesGrantingFeature,
      );
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

    // One session read for the whole batch: getSession() hits the DB to resolve
    // the token, so reading it per change made a bulk save cost one session
    // query per row. The actor is the same for every entry in one request.
    const session = await getSession();

    for (const change of normalized) {
      // Read the previous value for the audit trail.
      const previousRow = (
        await getEligibilityRow(
          change.feature_key,
          change.identity_type,
          change.identity_value,
        )
      ).rows[0];
      const write = resolveEligibilityWrite(change);
      if (write.operation === "delete") {
        await deleteEligibilityRow(
          change.feature_key,
          change.identity_type,
          change.identity_value,
        );
      } else {
        await upsertEligibilityRow(
          change.feature_key,
          change.identity_type,
          change.identity_value,
          change.eligible,
        );
      }

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: "system",
        targetName: `${change.identity_type}:${change.identity_value}`,
        action: "eligibility_changed",
        details: formatEligibilityAuditDetails(change, previousRow),
      });
    }

    // Eligibility changes can affect any user — drop the short-TTL context
    // cache so the resolver picks up the new configuration immediately.
    invalidateAllAuthorizationContexts();

    const rows = await fetchAllRows();
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("[eligibility] PUT error:", error.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
