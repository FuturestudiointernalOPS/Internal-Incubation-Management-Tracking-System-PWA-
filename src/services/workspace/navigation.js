/**
 * Workspace service — the post-login navigation list and contexts.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — which workspaces
 * appear, how the participant enrollments are derived, which contexts are
 * built, and how the identity is labelled. Every statement lives in
 * `@/models/workspace`; the membership and learning decisions are reused from
 * their own services. No SQL, no HTTP.
 */

import { roleHomeHref } from "@/models/platform/roles";
import { isBaselineIdentity } from "@/lib/identity";
import { getEffectiveGroupsAndHistory } from "@/services/authorization/membership";
import { learnerHasEnrollments } from "@/services/lms/learning";
import { resolveParticipantParticipation } from "@/services/participant/participation";
import {
  getStaffAssignmentsForUser,
  getProgramAssignmentsFromContactRoles,
  getActiveResponsibilitiesForUser,
  getActiveVentureMembershipsForContact,
} from "@/models/workspace";

function assignmentHref(role, programId) {
  const normalizedRole = String(role || "").toLowerCase();
  if (normalizedRole === "facilitator") return `/facilitator/program/${programId}`;
  return roleHomeHref(normalizedRole);
}

/** Rows of a settled read, or an empty list when it failed. */
const rowsOf = (settled) =>
  settled.status === "fulfilled" ? settled.value.rows || [] : [];
/** The value of a settled read, or `fallback` when it failed. */
const valueOf = (settled, fallback) =>
  settled.status === "fulfilled" ? settled.value : fallback;

/**
 * THE READS, AND THE LIST THEY MAKE.
 *
 * Everything here is a function of the person's access and nothing else, which
 * is what lets the caller cache the result. It is split out of the handler for
 * that reason alone: the cached path skips this whole function.
 *
 * The reads are independent (only the user's id/email is required). They used to
 * be awaited one after another — twelve round trips (~1.6s in the observed
 * environment) before the hub could render. allSettled keeps the original
 * fail-open behaviour: a missing table or a failing read contributes an empty
 * list instead of breaking the endpoint.
 *
 * Eight reads for the hub, six for the shell, and not ten or eight: the ended
 * group memberships ride along with the group resolution, and the active
 * enrollments are filtered out of the membership list. Both used to send a table
 * that was already being read.
 */
export async function buildWorkspaceNavigation(session, contextsOnly) {
  /** A read this scope does not use: answered locally, never sent. */
  const notNeeded = () => Promise.resolve({ rows: [] });

  const [
    staffSettled,
    contactRolesSettled,
    membershipsSettled,
    groupsSettled,
    responsibilitiesSettled,
    venturesSettled,
    learningSettled,
  ] = await Promise.allSettled([
    contextsOnly
      ? notNeeded()
      : getStaffAssignmentsForUser(session.cid, session.email || session.cid),
    contextsOnly
      ? notNeeded()
      : getProgramAssignmentsFromContactRoles(session.cid),
    resolveParticipantParticipation({ cid: session.cid, email: session.email }),
    getEffectiveGroupsAndHistory(session.cid),
    getActiveResponsibilitiesForUser(session.cid),
    getActiveVentureMembershipsForContact(session.cid),
    learnerHasEnrollments(session.cid),
  ]);

  const staffRows = rowsOf(staffSettled);
  // The ONE participation rule (active, pending AND completed seats, plus the
  // older links). Completed seats stay listed, marked read-only, instead of
  // disappearing from the hub.
  const participations = valueOf(membershipsSettled, { memberships: [] }).memberships || [];

  // 1. Program staff assignments (facilitator / staff / ...)
  // 2. Participant enrollments (excluded when already a staff member there)
  const staffProgramIds = new Set(staffRows.map((row) => String(row.program_id)));

  const workspaces = [];

  for (const row of staffRows) {
    const role = String(row.role || "staff").toLowerCase();
    workspaces.push({
      type: "program",
      title: role,
      program_id: row.program_id,
      program_name: row.program_name || row.program_id,
      href: assignmentHref(role, row.program_id) || "/workspaces",
    });
  }

  for (const row of participations) {
    if (staffProgramIds.has(String(row.program_id))) continue;
    workspaces.push({
      type: "program",
      title: "participant",
      program_id: row.program_id,
      program_name: row.program_name || row.program_id,
      completed: row.completed === true,
      href: "/participant",
    });
  }

  // ── Phase 2A: CONTEXTUAL RESOLVER (additive, informational) ────────────
  // Answers: "what legitimate contexts does this person currently or
  // historically have?" Reuses the existing contextual tables. Every block
  // is fail-open: a missing table degrades to an empty list and never breaks
  // the endpoint. Does NOT change login, session.role, or any authorization.
  const contexts = {
    program_assignments: [], // contact_roles + legacy v2_program_staff not mirrored
    program_participations: [], // participant_programs incl. completed/historical
    org_memberships: [], // user_groups
    responsibilities: [], // user_responsibilities
    venture_memberships: [], // venture_members
  };

  // 1. Generalized program assignments (contact_roles) + legacy rows that
  //    have no current contact_roles mirror (deduplicated, no duplication).
  try {
    const crRows = rowsOf(contactRolesSettled);
    contexts.program_assignments = crRows.map((row) => {
      const roleKey = String(row.role || "staff").toLowerCase();
      return {
        ...row,
        source: "contact_roles",
        completed: false,
        href:
          roleKey === "facilitator"
            ? `/facilitator/program/${row.program_id}`
            : roleHomeHref(roleKey) || "/workspaces",
      };
    });
    const mirroredKeys = new Set(
      crRows
        .filter((row) => row.is_current)
        .map((row) => `${row.program_id}|${String(row.role).toLowerCase()}`),
    );
    const legacyOnly = staffRows.filter(
      (row) =>
        !mirroredKeys.has(`${row.program_id}|${String(row.role).toLowerCase()}`),
    );
    for (const row of legacyOnly) {
      const roleKey = String(row.role || "staff").toLowerCase();
      contexts.program_assignments.push({
        contact_cid: session.cid,
        role: row.role,
        title: row.role,
        program_id: row.program_id,
        is_current: true,
        status: "active",
        scope: null,
        started_at: null,
        ended_at: null,
        program_name: row.program_name || row.program_id,
        source: "v2_program_staff",
        completed: false,
        href:
          roleKey === "facilitator"
            ? `/facilitator/program/${row.program_id}`
            : roleHomeHref(roleKey) || "/workspaces",
      });
    }
  } catch (_) {}

  // 2. All participant seats with lifecycle status (incl. completed). The rule
  //    that decided they exist is the same one the menu and the dashboard use.
  try {
    contexts.program_participations = participations.map((membership) => ({
      program_id: membership.program_id,
      program_name: membership.program_name,
      status: membership.status,
      completed: membership.completed,
      readonly: membership.readOnly,
      completed_at: membership.completed_at || null,
      outcome: membership.outcome || null,
      certificate_issued: membership.certificate_issued === true,
      href: `/participant/${membership.program_id}`,
    }));
  } catch (_) {}

  // 3. Organizational memberships — ACTIVE memberships only (Phase 1:
  //    expired/ended memberships move to contexts.org_history; the person,
  //    account and history stay, only active authorization stops).
  //
  //    Built from the resolved effective groups themselves. That resolution
  //    already decides which groups count (a membership record governs a
  //    legacy edge), and the membership layer mirrors every membership into
  //    the legacy table precisely so this list is complete. Re-reading the
  //    legacy table by name was a second round trip for one field
  //    (role_in_group) that no consumer reads.
  try {
    // The group resolution now carries the ended memberships with it, so this
    // block answers both of the group questions from one read.
    const { groups, history } = valueOf(groupsSettled, {
      groups: [],
      history: [],
    });
    contexts.org_memberships = [...groups].sort().map((groupName) => ({
      group_name: groupName,
      href: roleHomeHref(session.role) || "/workspaces",
    }));
    contexts.org_history = history;
  } catch (_) {}

  // 4. Responsibilities.
  try {
    contexts.responsibilities = rowsOf(responsibilitiesSettled).map((row) => ({
      ...row,
      href: String(row.key || "").toLowerCase().includes("finance")
        ? "/staff/finance"
        : String(row.key || "").toLowerCase().includes("crm")
          ? "/staff/crm"
          : "/workspaces",
    }));
  } catch (_) {}

  // 5. Venture memberships.
  try {
    contexts.venture_memberships = rowsOf(venturesSettled).map((row) => ({
      ...row,
      href: `/participant/ventures/${row.venture_id}`,
    }));
  } catch (_) {}

  // 6. LMS learner context — one aggregate "Learning" context while the
  //    user holds a non-suspended enrollment (same rule as the My Learning
  //    nav gate). Learner access itself is always enforced server-side by
  //    the LMS routes from lms_enrollments.
  contexts.learning = valueOf(learningSettled, false)
    ? { enrolled: true, href: "/participant/learning" }
    : { enrolled: false };

  return { workspaces, contexts };
}

/**
 * The identity labels the workspace shell shows.
 *
 * `contacts.role` is the raw stored role (baseline identity OR legacy
 * contextual value). `session.role` is what today's gates see (identical to the
 * baseline role unless the legacy-role derivation surfaces a stored "member" as
 * participant/founder). Returns the baseline role plus the optional derived
 * role; the identity chip is deliberately never cached.
 */
export function deriveBaselineRole(session, storedRole) {
  let baselineRole = session.role;
  if (storedRole) baselineRole = String(storedRole).toLowerCase();
  const derivedRole =
    isBaselineIdentity(baselineRole) &&
    baselineRole === "member" &&
    session.role !== "member"
      ? session.role
      : null;
  return { baselineRole, derivedRole };
}
