/**
 * Authorization — program scope readiness reads (REPOSITORY layer).
 *
 * The five statements behind the program-scope readiness report. The report
 * itself (what counts as unmanaged, who loses what, the template split) lives in
 * `@/services/authorization/programScopeReadiness`.
 *
 * SQL is byte-identical to what used to sit inline in
 * `models/authorization/programScopeReadiness.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** A runaway programme table must not turn this report into an unbounded scan. */
const MAX_PROGRAMS = 500;
const MAX_HOLDERS = 500;

/**
 * Templates that grant programme EDIT or PUBLISH — i.e. the ones that would be
 * narrowed by the program scope rule. A template that only grants programme
 * VIEW is left out: seeing the catalogue is deliberately portfolio-wide.
 */
export async function listPortfolioTemplates() {
  const res = await db.execute({
    sql: `SELECT ap.id, ap.name, ap.is_active
          FROM access_profiles ap
          WHERE EXISTS (
            SELECT 1 FROM access_profile_capabilities c
            WHERE c.profile_id = ap.id AND c.module = 'programs'
              AND c.capability IN ('edit', 'publish')
          )
          ORDER BY ap.name`,
  });
  return res.rows || [];
}

/** Every capability row of the given templates, grouped by template id. */
export async function listTemplateCapabilities(profileIds) {
  if (profileIds.length === 0) return {};
  const res = await db.execute({
    sql: `SELECT profile_id, module, capability, access_level
          FROM access_profile_capabilities
          WHERE profile_id IN (${profileIds.map(() => "?").join(",")})`,
    args: profileIds,
  });
  const byProfile = {};
  for (const row of res.rows || []) {
    const profileId = String(row.profile_id);
    byProfile[profileId] ??= [];
    byProfile[profileId].push(row);
  }
  return byProfile;
}

/** role → default template, read once. */
export async function listRoleDefaults() {
  const res = await db.execute({
    sql: "SELECT role_name, access_profile_id FROM role_access_profile_defaults",
  });
  return res.rows || [];
}

/**
 * People who currently resolve to one of those templates — by explicit profile
 * override, or by the role default their identity points at (no override).
 *
 * Deliberately two SIMPLE predicates rather than a correlated subquery: the
 * candidate roles are computed by the caller from the role-default map, so the
 * whole question is answerable by reading one WHERE clause.
 */
export async function listTemplateHolders(profileIds, roles) {
  if (profileIds.length === 0 || roles.length === 0) return [];

  const profilePlaceholders = profileIds.map(() => "?").join(",");
  const rolePlaceholders = roles.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT c.cid, c.name, c.role, c.access_profile_id,
                 ap.name AS override_profile_name
          FROM contacts c
          LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
          WHERE c.access_profile_id IN (${profilePlaceholders})
             OR (c.access_profile_id IS NULL AND c.role IN (${rolePlaceholders}))
          LIMIT ${MAX_HOLDERS}`,
    args: [...profileIds, ...roles],
  });
  return res.rows || [];
}

/**
 * Every programme attachment in one pass: named managers plus programme-manager
 * staff rows. The caller groups and filters them (an ended programme is not an
 * attachment anybody keeps).
 */
export async function listRunningAttachmentRows() {
  const res = await db.execute({
    sql: `SELECT CAST(p.id AS TEXT) AS program_id, CAST(p.assigned_pm_id AS TEXT) AS cid,
                 p.end_date, p.status, p.is_archived
          FROM v2_programs p
          WHERE p.assigned_pm_id IS NOT NULL
            AND TRIM(CAST(p.assigned_pm_id AS TEXT)) <> ''
          UNION
          SELECT CAST(ps.program_id AS TEXT) AS program_id, TRIM(ps.staff_id) AS cid,
                 p.end_date, p.status, p.is_archived
          FROM v2_program_staff ps
          LEFT JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
          WHERE ps.staff_id IS NOT NULL AND TRIM(ps.staff_id) <> ''`,
  });
  return res.rows || [];
}

/** The programmes the report inspects, capped. */
export async function listProgramsForScopeReadiness() {
  return db.execute({
    sql: `SELECT CAST(id AS TEXT) AS id, name, status, end_date, is_archived,
                 CAST(assigned_pm_id AS TEXT) AS assigned_pm_id
          FROM v2_programs
          LIMIT ${MAX_PROGRAMS}`,
  });
}
