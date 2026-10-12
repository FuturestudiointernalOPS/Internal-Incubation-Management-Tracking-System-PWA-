/**
 * Authorization — context grant readiness / impact report (SERVICE layer).
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
 * Layer (see docs/LAYER_SPLIT.md): this is a decision/report, so it lives in the
 * service layer. Its two statements now live in
 * `@/models/authorization/contextGrantReadinessReads`; it no longer runs SQL.
 * Previously this module sat in the models folder and reached into the
 * authorization resolver — the one real model→service edge created by slice 1,
 * removed here.
 */

import { initDb } from "@/lib/db";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { getAuthorizationContext } from "./context";
import {
  contextGrantSentinel,
  resolveContextDesiredCaps,
} from "./contextGrants";
import {
  listActiveProgramAssignments,
  listProgramAssignmentContacts,
  loadAssignmentLookups,
} from "@/models/authorization/programAssignmentReads";
import {
  assignmentsForRole,
  deriveFacilitatorDesiredCaps,
  deriveAssignmentsExpiry,
} from "./programAssignments";
import {
  getContactNameAndRole,
  getSentinelGrantedCapabilities,
} from "@/models/authorization/contextGrantReadinessReads";
import { listProfileAssignments } from "@/models/authorization/profileAssignmentsStore";

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
        getContactNameAndRole(cid),
        listActiveProgramAssignments(cid),
      ]);
      contact = contactRes.rows?.[0] || contact;
      assignments = active.rows;
    } catch (error) {
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
        reason: `lookup-failed: ${error.message}`,
      });
      continue;
    }

    // Neither assignment row of any role → nothing to report for this person.
    if (assignments.length === 0) continue;

    // Phase G — the profile-assignment cards for this person, so the report
    // shows the PROFILE and the period that justifies the relationship. Read on
    // its own so an un-migrated registry never fails the whole row.
    let cards = [];
    try {
      const registry = await listProfileAssignments(cid);
      cards = (registry.rows || []).filter((row) => row.context_type === "program");
    } catch (_) {}

    // Their full effective matrix, resolved by the real resolver, so the impact
    // list reflects what they ACTUALLY hold (profile + group + grants − blocks).
    let effective = {};
    try {
      const ctx = await getAuthorizationContext({
        cid: String(cid),
        role: contact.role || undefined,
      });
      effective = ctx?.effective || {};
    } catch (error) {
      console.warn(`[Authz] readiness: context failed for ${cid}:`, error.message);
    }

    for (const roleKey of ["facilitator", "program_manager"]) {
      const mine = assignmentsForRole(assignments, roleKey);
      if (mine.length === 0) continue;

      const sentinel = contextGrantSentinel("program", roleKey);
      const desired = await desiredCapsFor(cid, roleKey, mine);
      const desiredKeys = new Set(Object.keys(desired));

      const appliedRes = await getSentinelGrantedCapabilities(cid, sentinel);
      const appliedRows = appliedRes.rows || [];
      const appliedKeys = new Set(
        appliedRows.map((row) => key(row.module, row.capability)),
      );

      // Expired-and-still-present rows are a real state (the resolver ignores
      // them; the sweep removes them) — surfaced separately so a stale row is
      // never mistaken for live access.
      const nowIso = new Date().toISOString();
      const expired = appliedRows
        .filter((row) => row.expires_at && String(row.expires_at) < nowIso)
        .map((row) => key(row.module, row.capability));

      const programEffective = Object.entries(effective).flatMap(
        ([module, capabilities]) =>
          PROGRAM_MODULES.has(module)
            ? Object.entries(capabilities || {})
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
        programs: mine.map((assignment) => String(assignment.program_id)),
        expiresAt: deriveAssignmentsExpiry(mine),
        applied: [...appliedKeys].sort(),
        expired: expired.sort(),
        driftToAdd: [...desiredKeys].filter((capabilityKey) => !appliedKeys.has(capabilityKey)).sort(),
        driftToRemove: [...appliedKeys].filter((capabilityKey) => !desiredKeys.has(capabilityKey)).sort(),
        // Capabilities held today that the ASSIGNMENT does not justify: the
        // exact list that a strict assignment-derived model would withdraw.
        wouldLose: programEffective
          .filter((capabilityKey) => !desiredKeys.has(capabilityKey))
          .sort(),
        // Phase G — profile + card: the registry entries for this role, with
        // their period, source and state.
        cards: cards
          .filter((card) => card.profile_key === roleKey)
          .map((card) => ({
            profileKey: card.profile_key,
            contextId: card.context_id,
            source: card.source,
            startedAt: card.started_at,
            endsAt: card.ends_at,
            status: card.status,
          })),
        reason: Object.keys(desired).length ? "assigned" : "no-per-program-rights",
      });
    }
  }

  const withDrift = rows.filter(
    (row) => row.driftToAdd.length > 0 || row.driftToRemove.length > 0,
  );
  const withImpact = rows.filter((row) => row.wouldLose.length > 0);

  return {
    success: true,
    rows,
    truncated,
    summary: {
      people: new Set(rows.map((row) => row.cid)).size,
      assignments: rows.length,
      drift: withDrift.length,
      impact: withImpact.length,
      wouldLose: [...new Set(withImpact.flatMap((row) => row.wouldLose))].sort(),
    },
  };
}
