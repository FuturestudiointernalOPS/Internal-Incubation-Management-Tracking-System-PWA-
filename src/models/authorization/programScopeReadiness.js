/**
 * ImpactOS — PROGRAM SCOPE READINESS (step 1 of the program-scope program)
 *
 * Enforcing the where-it-applies rule for programmes is a REMOVAL: today a
 * person holding the programme capability reaches every programme, and the rule
 * would restrict them to the ones they are attached to. Two things can go wrong,
 * and both are invisible without this report:
 *
 *   1. UNMANAGED PROGRAMMES. A running programme with no manager recorded can
 *      never be reached by the rule — the relationship it would match on does
 *      not exist. Enforcing scope before repairing this would quietly make those
 *      programmes unreachable to everyone but the portfolio identity. This
 *      report is the worklist that repairs them (step 2).
 *
 *   2. PEOPLE WHO ARE ATTACHED TO NOTHING. A person whose template grants
 *      programme editing but who is not attached to a single running programme
 *      loses ALL programme access. That can be entirely correct (they left the
 *      programme), or it can be a missing assignment — and the difference is
 *      not visible from either side alone.
 *
 * It also answers the TEMPLATE SPLIT question (step 3) without touching anyone:
 * which templates currently bundle programme capability with unrelated powers,
 * and exactly which capabilities a portfolio template would stop granting. That
 * list is a property of the TEMPLATE, not of each person, which is why one
 * comparison answers it for everybody on it.
 *
 * READ-ONLY. Nothing here changes access, and the computation is deliberately
 * template-based (a handful of queries) rather than a per-person resolver loop,
 * so it stays honest about cost as the number of people grows.
 *
 * SQL lives here (MVC: models only). No HTTP imports.
 */

import db, { initDb } from "@/lib/db";
import { isProgramEnded } from "./programAssignments";
import {
  PROGRAM_SCOPE_WAVES,
  PROGRAM_SCOPE_WAVE_INFO,
} from "./programScopeWaves";

/** A runaway programme table must not turn this report into an unbounded scan. */
const MAX_PROGRAMS = 500;
const MAX_HOLDERS = 500;

/**
 * Capabilities that are NOT programme management and are currently granted by
 * the portfolio programme template. Compared against the portfolio template's
 * actual rows so the report states the truth rather than a hard-coded claim.
 */
const MISPLACED_BUNDLES = [
  { module: "contacts", capability: "create", why: "creating people is CRM work" },
  { module: "ventures", capability: "edit", why: "editing ventures is venture work" },
];

const key = (module, capability) => `${module}.${capability}`;

/**
 * Templates that grant programme EDIT or PUBLISH — i.e. the ones that would be
 * narrowed by the program scope rule. A template that only grants programme
 * VIEW is left out: seeing the catalogue is deliberately portfolio-wide.
 */
async function listPortfolioTemplates() {
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

/** Every capability row of the given templates, so the report can diff them. */
async function listTemplateCapabilities(profileIds) {
  if (profileIds.length === 0) return {};
  const res = await db.execute({
    sql: `SELECT profile_id, module, capability, access_level
          FROM access_profile_capabilities
          WHERE profile_id IN (${profileIds.map(() => "?").join(",")})`,
    args: profileIds,
  });
  const byProfile = {};
  for (const row of res.rows || []) {
    const id = String(row.profile_id);
    byProfile[id] ??= [];
    byProfile[id].push(row);
  }
  return byProfile;
}

/**
 * role → default template. Read once: the holder query needs the roles whose
 * default points at one of the candidate templates, and the report needs the
 * role a holder resolves THROUGH (an override wins, a role default does not).
 */
async function listRoleDefaults() {
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
 * candidate roles are computed here from the role-default map, so the whole
 * question is answerable by reading one WHERE clause.
 */
async function listTemplateHolders(profileIds, roleDefaults) {
  if (profileIds.length === 0) return [];
  const roles = [
    ...new Set(
      roleDefaults
        .filter((r) => profileIds.includes(r.access_profile_id))
        .map((r) => r.role_name),
    ),
  ];
  if (roles.length === 0) return [];

  const phProfiles = profileIds.map(() => "?").join(",");
  const phRoles = roles.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT c.cid, c.name, c.role, c.access_profile_id,
                 ap.name AS override_profile_name
          FROM contacts c
          LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
          WHERE c.access_profile_id IN (${phProfiles})
             OR (c.access_profile_id IS NULL AND c.role IN (${phRoles}))
          LIMIT ${MAX_HOLDERS}`,
    args: [...profileIds, ...roles],
  });
  return res.rows || [];
}

/** The effective template a holder sits on: an override, else their role default. */
function effectiveProfileFor(row, roleDefaults, templatesById) {
  if (row.access_profile_id) {
    return {
      profileId: String(row.access_profile_id),
      profile: row.override_profile_name || null,
      viaRole: null,
    };
  }
  const via = roleDefaults.find((r) => r.role_name === row.role);
  if (!via) return { profileId: null, profile: null, viaRole: null };
  return {
    profileId: String(via.access_profile_id),
    profile: templatesById[String(via.access_profile_id)] || null,
    viaRole: row.role || null,
  };
}

/**
 * Every running programme attachment in one pass: named managers plus
 * programme-manager staff rows. Grouped by person and filtered to running
 * programmes — an ended programme is not an attachment anybody keeps.
 */
async function listRunningAttachments() {
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
  const byCid = {};
  for (const row of res.rows || []) {
    if (!row.cid || isProgramEnded(row)) continue;
    const cid = String(row.cid);
    byCid[cid] ??= [];
    if (!byCid[cid].includes(String(row.program_id))) {
      byCid[cid].push(String(row.program_id));
    }
  }
  return byCid;
}

/**
 * The report.
 *
 * @returns {Promise<{success, unmanaged: Array, holders: Array, removals: Array,
 *                    summary: Object}>}
 */
export async function buildProgramScopeReadiness() {
  await initDb();

  const templates = await listPortfolioTemplates();
  const templateIds = templates.map((t) => t.id);
  const templatesById = Object.fromEntries(templates.map((t) => [String(t.id), t.name]));

  const [capsByProfile, roleDefaults, programRes] = await Promise.all([
    listTemplateCapabilities(templateIds),
    listRoleDefaults(),
    db.execute({
      sql: `SELECT CAST(id AS TEXT) AS id, name, status, end_date, is_archived,
                   CAST(assigned_pm_id AS TEXT) AS assigned_pm_id
            FROM v2_programs
            LIMIT ${MAX_PROGRAMS}`,
    }),
  ]);

  const [holders, attachments] = await Promise.all([
    listTemplateHolders(templateIds, roleDefaults),
    listRunningAttachments(),
  ]);

  const programs = programRes.rows || [];
  const running = programs.filter((p) => !isProgramEnded(p));

  // 1. Running programmes nobody manages. A programme-manager STAFF row counts
  //    as a manager even when assigned_pm_id is empty — the two are read
  //    together everywhere else, so they must be read together here.
  const managedByStaffRow = new Set();
  for (const programIds of Object.values(attachments)) {
    for (const id of programIds) managedByStaffRow.add(id);
  }
  const unmanaged = running
    .filter((p) => {
      const hasNamed = p.assigned_pm_id && String(p.assigned_pm_id).trim() !== "";
      return !hasNamed && !managedByStaffRow.has(String(p.id));
    })
    .map((p) => ({
      id: String(p.id),
      name: p.name || null,
      status: p.status || null,
      endDate: p.end_date ? String(p.end_date).slice(0, 10) : null,
    }));

  // 2. Who would lose access, and how much. "Kept" is the count of RUNNING
  //    programmes they are attached to; zero means the rule would leave them
  //    with nothing.
  const holderRows = holders.map((h) => {
    const kept = attachments[String(h.cid)] || [];
    const effective = effectiveProfileFor(h, roleDefaults, templatesById);
    return {
      cid: String(h.cid),
      name: h.name || null,
      role: h.role || null,
      profile: effective.profile,
      viaRole: effective.viaRole,
      profileId: effective.profileId,
      // Every returned holder is on a portfolio template by construction —
      // either by override or through their identity's role default.
      usesPortfolioTemplate: true,
      keptPrograms: kept,
      keptCount: kept.length,
      losesEverything: kept.length === 0,
    };
  });

  // 3. Template split impact: the capabilities the portfolio template grants
  //    that are not programme management. Reported as a property of the
  //    template (it is the same for everyone on it), with the template named.
  const removals = [];
  for (const t of templates) {
    const rows = capsByProfile[String(t.id)] || [];
    const present = new Set(rows.map((r) => key(r.module, r.capability)));
    for (const bundle of MISPLACED_BUNDLES) {
      if (present.has(key(bundle.module, bundle.capability))) {
        removals.push({
          profileId: t.id,
          profile: t.name,
          module: bundle.module,
          capability: bundle.capability,
          why: bundle.why,
          holders: holderRows.filter((h) => h.profileId === String(t.id)).length,
        });
      }
    }
  }

  // Which templates bundle programme capability with an unrelated power —
  // the answer to "why can't we just narrow it in place".
  const portfolioTemplates = templates.map((t) => ({
    id: t.id,
    name: t.name,
    isActive: Number(t.is_active) === 1,
    capabilities: (capsByProfile[String(t.id)] || [])
      .map((r) => key(r.module, r.capability))
      .sort(),
    holders: holderRows.filter((h) => h.profileId === String(t.id)).length,
  }));

  // COVERAGE — which write domains are fully protected and which are not. There
  // is no switch to report: the rule is enforced unconditionally, so the only
  // honest state to publish is where it does NOT reach.
  const coverage = PROGRAM_SCOPE_WAVES.map((wave) => {
    const info = PROGRAM_SCOPE_WAVE_INFO[wave];
    return {
      wave,
      label: info.label,
      covers: info.covers,
      partial: info.partial === true,
      covered: info.partial !== true,
      exempt: info.exempt || [],
    };
  });
  const exemptSurfaces = coverage.flatMap((c) => c.exempt);

  return {
    success: true,
    unmanaged,
    holders: holderRows
      .slice()
      .sort((a, b) => a.keptCount - b.keptCount || String(a.name).localeCompare(String(b.name))),
    portfolioTemplates,
    removals,
    coverage,
    summary: {
      runningPrograms: running.length,
      unmanaged: unmanaged.length,
      portfolioTemplates: portfolioTemplates.length,
      holders: holderRows.length,
      // People who hold program EDITING but are staffed on no running program:
      // with the rule enforced they can still SEE the catalog, but every write is
      // refused until somebody attaches them. This is the number to review before
      // and after a deploy, not a gate on one.
      losesEverything: holderRows.filter((h) => h.losesEverything).length,
      keptSome: holderRows.filter((h) => !h.losesEverything).length,
      partialWaves: coverage.filter((c) => c.partial).length,
      coveredWaves: coverage.filter((c) => c.covered).length,
      exemptSurfaces: exemptSurfaces.length,
    },
  };
}
