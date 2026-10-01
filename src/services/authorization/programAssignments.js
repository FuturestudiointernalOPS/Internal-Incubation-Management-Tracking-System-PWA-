/**
 * ImpactOS — PROGRAM ASSIGNMENT → CAPABILITY DERIVATION (SERVICE layer)
 *
 * A PROGRAM FACILITATOR and a PROGRAM MANAGER are CONTEXTUAL ROLES, not global
 * identities. Their program access must come from the assignment they hold on a
 * particular program — and only for as long as that program runs:
 *
 *   v2_program_staff (role = facilitator)   ─┐
 *   v2_programs.assigned_pm_id              ─┤→ active assignment rows
 *   v2_program_staff (role = program_manager)┘
 *          │
 *          ├─ FACILITATOR: the per-assignment tick levels decide WHICH
 *          │  capabilities the assignment really grants (JSON override →
 *          │  assignment profile → program default → unconfigured = granted),
 *          │  unioned across every program the person is assigned to.
 *          │
 *          └─ PROGRAM MANAGER: the Context Roles registry decides which
 *             profile's capabilities the assignment seeds.
 *          │
 *          └─ EXPIRY: the latest program end date. Past it the grant is dead
 *             (the resolver already ignores expired grants), so program access
 *             ends with the program even if no sweep ever runs.
 *
 * WHY "unconfigured = granted": before this model, a facilitator capability
 * absent from the stored tick list was never consulted at all — the person was
 * allowed. Reading an absent key as DENIED would therefore strip access from
 * every facilitator already in production. The derivation mirrors the live
 * resolution order exactly, with the live default as its last step, so the
 * applied grant can never disagree with what the person actually has.
 *
 * Layer (see docs/LAYER_SPLIT.md): the derivation lives here; the reads live in
 * `@/models/authorization/programAssignmentReads`. `programAssignments.js` in
 * models is a re-export facade.
 */

import {
  FACILITATOR_CAPABILITY_KEYS,
  parsePermissions,
} from "@/lib/facilitator-permissions";

/** Unconfigured means granted (see the module header). */
export const UNCONFIGURED_LEVEL = 1;

/** ISO date (YYYY-MM-DD) for a possibly-Date/possibly-string db value. */
function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  const iso = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/**
 * The capability level an ASSIGNMENT grants for one capability — mirrors
 * getFacilitatorPermissionLevel() in src/lib/auth.js step for step, adding the
 * live "unconfigured" default as the final step.
 *
 * @param {Object} assignment  { permissions, access_profile_id, program_id }
 * @param {Object} ctx         { profileCaps: Array<{module,capability,access_level}>,
 *                               programDefault: Object }
 */
export function resolveAssignmentCapabilityLevel(assignment, capability, ctx = {}) {
  const override = parsePermissions(assignment?.permissions);
  if (typeof override[capability] === "number") return override[capability];

  for (const row of ctx.profileCaps || []) {
    const dotKey = `${row.module}.${row.capability}`;
    if (dotKey === capability || row.capability === capability) {
      return Number(row.access_level) || 0;
    }
  }

  const programDefault = ctx.programDefault || {};
  if (typeof programDefault[capability] === "number") {
    return programDefault[capability];
  }

  // Nothing configured anywhere → this is what today's behaviour amounts to.
  return UNCONFIGURED_LEVEL;
}

/**
 * Pure: union of the facilitator capabilities a person's assignments grant,
 * each at the STRONGEST level across their programs (a capability held in any
 * program is held; the program-level tick narrows WHERE it applies).
 *
 * @returns {{ desired: Object, programs: string[] }}
 */
export function deriveFacilitatorDesiredCaps(assignments = [], lookups = {}) {
  const desired = {};
  const programs = [];
  for (const assignment of assignments) {
    const programId = String(assignment?.program_id ?? "");
    if (!programId) continue;
    if (!programs.includes(programId)) programs.push(programId);
    const ctx = {
      profileCaps: lookups.profileCapsByAssignment?.[programId] || null,
      programDefault: lookups.programDefaultById?.[programId] || null,
    };
    for (const capability of FACILITATOR_CAPABILITY_KEYS) {
      const level = Number(
        resolveAssignmentCapabilityLevel(assignment, capability, ctx),
      );
      if (!(level >= 1)) continue; // an explicit 0 is a deliberate removal
      const key = `facilitator.${capability}`;
      if (!desired[key] || level > desired[key].level) {
        desired[key] = { module: "facilitator", capability, level };
      }
    }
  }
  return { desired, programs };
}

/**
 * Pure: the expiry for a set of assignments — the LATEST program end date, so
 * the grant survives until the last program the person works on finishes.
 * Returns null (no expiry) when any active assignment has no end date, because
 * access cannot be bounded by a date that does not exist.
 */
export function deriveAssignmentsExpiry(assignments = []) {
  let latest = null;
  for (const assignment of assignments) {
    const end = toIsoDate(assignment?.end_date);
    if (!end) return null;
    if (!latest || end > latest) latest = end;
  }
  return latest;
}

/** Assignment rows for one role inside the program context. */
export function assignmentsForRole(rows = [], roleKey) {
  return rows.filter((row) => String(row.role_key || "") === roleKey);
}
