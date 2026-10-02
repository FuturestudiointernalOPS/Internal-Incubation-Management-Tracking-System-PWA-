/**
 * ImpactOS — PROGRAM SCOPE READINESS (step 1 of the program-scope program)
 * SERVICE layer.
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
 * It also answers the TEMPLATE SPLIT question (step 3) without touching anyone.
 *
 * READ-ONLY. Nothing here changes access, and the computation is deliberately
 * template-based (a handful of queries) rather than a per-person resolver loop.
 *
 * Layer (see docs/LAYER_SPLIT.md): the computation lives here; every statement
 * lives in `@/models/authorization/programScopeReadinessReads`.
 */

import { initDb } from "@/lib/db";
import { isProgramEnded } from "@/models/authorization/programAssignmentReads";
import {
  PROGRAM_SCOPE_WAVES,
  PROGRAM_SCOPE_WAVE_INFO,
} from "@/models/authorization/programScopeWaves";
import {
  listPortfolioTemplates,
  listTemplateCapabilities,
  listRoleDefaults,
  listTemplateHolders,
  listRunningAttachmentRows,
  listProgramsForScopeReadiness,
} from "@/models/authorization/programScopeReadinessReads";

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

/** The effective template a holder sits on: an override, else their role default. */
function effectiveProfileFor(row, roleDefaults, templatesById) {
  if (row.access_profile_id) {
    return {
      profileId: String(row.access_profile_id),
      profile: row.override_profile_name || null,
      viaRole: null,
    };
  }
  const via = roleDefaults.find((roleDefault) => roleDefault.role_name === row.role);
  if (!via) return { profileId: null, profile: null, viaRole: null };
  return {
    profileId: String(via.access_profile_id),
    profile: templatesById[String(via.access_profile_id)] || null,
    viaRole: row.role || null,
  };
}

/** Every running programme attachment, grouped by person. */
async function listRunningAttachments() {
  const rows = await listRunningAttachmentRows();
  const byCid = {};
  for (const row of rows) {
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
  const templateIds = templates.map((template) => template.id);
  const templatesById = Object.fromEntries(templates.map((template) => [String(template.id), template.name]));

  const [capsByProfile, roleDefaults, programRes] = await Promise.all([
    listTemplateCapabilities(templateIds),
    listRoleDefaults(),
    listProgramsForScopeReadiness(),
  ]);

  // Candidate roles whose default points at one of the portfolio templates.
  const roles = [
    ...new Set(
      roleDefaults
        .filter((roleDefault) => templateIds.includes(roleDefault.access_profile_id))
        .map((roleDefault) => roleDefault.role_name),
    ),
  ];

  const [holders, attachments] = await Promise.all([
    listTemplateHolders(templateIds, roles),
    listRunningAttachments(),
  ]);

  const programs = programRes.rows || [];
  const running = programs.filter((program) => !isProgramEnded(program));

  // 1. Running programmes nobody manages. A programme-manager STAFF row counts
  //    as a manager even when assigned_pm_id is empty — the two are read
  //    together everywhere else, so they must be read together here.
  const managedByStaffRow = new Set();
  for (const programIds of Object.values(attachments)) {
    for (const id of programIds) managedByStaffRow.add(id);
  }
  const unmanaged = running
    .filter((program) => {
      const hasNamed = program.assigned_pm_id && String(program.assigned_pm_id).trim() !== "";
      return !hasNamed && !managedByStaffRow.has(String(program.id));
    })
    .map((program) => ({
      id: String(program.id),
      name: program.name || null,
      status: program.status || null,
      endDate: program.end_date ? String(program.end_date).slice(0, 10) : null,
    }));

  // 2. Who would lose access, and how much. "Kept" is the count of RUNNING
  //    programmes they are attached to; zero means the rule would leave them
  //    with nothing.
  const holderRows = holders.map((holder) => {
    const kept = attachments[String(holder.cid)] || [];
    const effective = effectiveProfileFor(holder, roleDefaults, templatesById);
    return {
      cid: String(holder.cid),
      name: holder.name || null,
      role: holder.role || null,
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
  for (const template of templates) {
    const rows = capsByProfile[String(template.id)] || [];
    const present = new Set(rows.map((row) => key(row.module, row.capability)));
    for (const bundle of MISPLACED_BUNDLES) {
      if (present.has(key(bundle.module, bundle.capability))) {
        removals.push({
          profileId: template.id,
          profile: template.name,
          module: bundle.module,
          capability: bundle.capability,
          why: bundle.why,
          holders: holderRows.filter((holder) => holder.profileId === String(template.id)).length,
        });
      }
    }
  }

  // Which templates bundle programme capability with an unrelated power —
  // the answer to "why can't we just narrow it in place".
  const portfolioTemplates = templates.map((template) => ({
    id: template.id,
    name: template.name,
    isActive: Number(template.is_active) === 1,
    capabilities: (capsByProfile[String(template.id)] || [])
      .map((row) => key(row.module, row.capability))
      .sort(),
    holders: holderRows.filter((holder) => holder.profileId === String(template.id)).length,
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
  const exemptSurfaces = coverage.flatMap((waveCoverage) => waveCoverage.exempt);

  return {
    success: true,
    unmanaged,
    holders: holderRows
      .slice()
      .sort((first, second) => first.keptCount - second.keptCount || String(first.name).localeCompare(String(second.name))),
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
      losesEverything: holderRows.filter((holder) => holder.losesEverything).length,
      keptSome: holderRows.filter((holder) => !holder.losesEverything).length,
      partialWaves: coverage.filter((waveCoverage) => waveCoverage.partial).length,
      coveredWaves: coverage.filter((waveCoverage) => waveCoverage.covered).length,
      exemptSurfaces: exemptSurfaces.length,
    },
  };
}
