/**
 * ImpactOS — CONTEXT GRANT READINESS / IMPACT REPORT
 *
 * Read-only. Answers the two questions an administrator must be able to ask
 * BEFORE and AFTER the assignment-derived model changes anyone's access:
 *
 *   1. CONSISTENCY — for each person holding a program assignment, does what the
 *      system has applied match what the assignment actually justifies? A drift
 *      here means the next reconcile will change something; it is reported, not
 *      silently corrected.
 *
 *   2. IMPACT — which capabilities does this person hold today that their
 *      ASSIGNMENT does not justify? Those are exactly the capabilities that
 *      disappear the day access becomes strictly assignment-derived (i.e. the
 *      day the portfolio-wide defaults are narrowed). Nobody is blocked by this
 *      report; it exists so the narrowing can be done with the list in hand.
 *
 * Scope of the impact list is deliberate: only the modules that belong to the
 * PROGRAM feature (`programs`, `facilitator`). A person's messaging or contacts
 * capabilities have nothing to do with a program assignment and listing them
 * would make the report unreadable.
 *
 * SQL lives in the models it calls (MVC: models only). No HTTP imports.
 */

import db, { initDb } from "@/lib/db";
import { MODULE_TO_FEATURE } from "./eligibility";
import { getAuthorizationContext } from "./resolver";
import { contextGrantSentinel, resolveContextDesiredCaps } from "./contextGrants";
import {
  listActiveProgramAssignments,
  listProgramAssignmentContacts,
  assignmentsForRole,
  loadAssignmentLookups,
  deriveFacilitatorDesiredCaps,
  deriveAssignmentsExpiry,
} from "./programAssignments";

/** Modules the PROGRAM feature owns — the only ones an impact list may contain. */
const PROGRAM_MODULES = new Set(
  Object.entries(MODULE_TO_FEATURE)
    .filter(([, feature]) => feature === "programs")
    .map(([module]) => module),
);

/** A pathological dataset must not turn this report into an unbounded loop. */
const DEFAULT_LIMIT = 200;

const key = (module, capability) => `${module}.${capability}`;

/** Desired capability map for one role inside the program context. */
async function desiredCapsFor(cid, roleKey, assignments) {
  if (roleKey === "facilitator") {
    const lookups = await loadAssignmentLookups(assignments);
    return deriveFacilitatorDesiredCaps(assignments, lookups).desired;
  }
  const mapped = await resolveContextDesiredCaps("program", roleKey);
  return mapped.desired;
}

/**
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{success: boolean, rows: Array, summary: Object, truncated: boolean}>}
 */
export async function buildContextGrantReadiness({ limit = DEFAULT_LIMIT } = {}) {
  await initDb();

  const allCids = await listProgramAssignmentContacts();
  const truncated = allCids.length > limit;
  const cids = allCids.slice(0, limit);

  const rows = [];
  for (const cid of cids) {
    let contact = { name: null, role: null };
    let assignments = [];
    try {
      const [contactRes, active] = await Promise.all([
        db.execute({
          sql: "SELECT name, role FROM contacts WHERE cid = ?",
          args: [String(cid)],
        }),
        listActiveProgramAssignments(cid),
      ]);
      contact = contactRes.rows?.[0] || contact;
      assignments = active.rows;
    } catch (e) {
      rows.push({
        cid: String(cid),
        name: null,
        role: null,
        context: "program",
        roleKey: null,
        profile: null,
        programs: [],
        applied: [],
        expired: [],
        driftToAdd: [],
        driftToRemove: [],
        wouldLose: [],
        reason: `lookup-failed: ${e.message}`,
      });
      continue;
    }

    // Neither assignment row of any role → nothing to report for this person.
    if (assignments.length === 0) continue;

    // Their full effective matrix, resolved by the real resolver, so the impact
    // list reflects what they ACTUALLY hold (profile + group + grants − blocks).
    let effective = {};
    try {
      const ctx = await getAuthorizationContext({
        cid: String(cid),
        role: contact.role || undefined,
      });
      effective = ctx?.effective || {};
    } catch (e) {
      console.warn(`[Authz] readiness: context failed for ${cid}:`, e.message);
    }

    for (const roleKey of ["facilitator", "program_manager"]) {
      const mine = assignmentsForRole(assignments, roleKey);
      if (mine.length === 0) continue;

      const sentinel = contextGrantSentinel("program", roleKey);
      const desired = await desiredCapsFor(cid, roleKey, mine);
      const desiredKeys = new Set(Object.keys(desired));

      const appliedRes = await db.execute({
        sql: `SELECT module, capability, access_level, expires_at
              FROM user_capabilities
              WHERE user_cid = ? AND granted_by = ?`,
        args: [String(cid), sentinel],
      });
      const appliedRows = appliedRes.rows || [];
      const appliedKeys = new Set(
        appliedRows.map((r) => key(r.module, r.capability)),
      );

      // Expired-and-still-present rows are a real state (the resolver ignores
      // them; the sweep removes them) — surfaced separately so a stale row is
      // never mistaken for live access.
      const nowIso = new Date().toISOString();
      const expired = appliedRows
        .filter((r) => r.expires_at && String(r.expires_at) < nowIso)
        .map((r) => key(r.module, r.capability));

      const programEffective = Object.entries(effective).flatMap(
        ([module, caps]) =>
          PROGRAM_MODULES.has(module)
            ? Object.entries(caps || {})
                .filter(([, level]) => Number(level) >= 1)
                .map(([capability]) => key(module, capability))
            : [],
      );

      rows.push({
        cid: String(cid),
        name: contact.name || null,
        role: contact.role || null,
        context: "program",
        roleKey,
        profile:
          roleKey === "facilitator"
            ? "Facilitator assignment (per-program permissions)"
            : (await resolveContextDesiredCaps("program", roleKey)).profile,
        programs: mine.map((a) => String(a.program_id)),
        expiresAt: deriveAssignmentsExpiry(mine),
        applied: [...appliedKeys].sort(),
        expired: expired.sort(),
        driftToAdd: [...desiredKeys].filter((k) => !appliedKeys.has(k)).sort(),
        driftToRemove: [...appliedKeys].filter((k) => !desiredKeys.has(k)).sort(),
        // Capabilities held today that the ASSIGNMENT does not justify: the
        // exact list that a strict assignment-derived model would withdraw.
        wouldLose: programEffective
          .filter((k) => !desiredKeys.has(k))
          .sort(),
        reason: Object.keys(desired).length ? "assigned" : "no-per-program-rights",
      });
    }
  }

  const withDrift = rows.filter(
    (r) => r.driftToAdd.length > 0 || r.driftToRemove.length > 0,
  );
  const withImpact = rows.filter((r) => r.wouldLose.length > 0);

  return {
    success: true,
    rows,
    truncated,
    summary: {
      people: new Set(rows.map((r) => r.cid)).size,
      assignments: rows.length,
      drift: withDrift.length,
      impact: withImpact.length,
      wouldLose: [...new Set(withImpact.flatMap((r) => r.wouldLose))].sort(),
    },
  };
}
