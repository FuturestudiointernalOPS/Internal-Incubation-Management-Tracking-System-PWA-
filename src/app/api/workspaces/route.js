import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { roleHomeHref } from "@/lib/platform/roles";
import { getEffectiveGroupsForUser } from "@/lib/authorization/membership";
import {
  getStaffAssignmentsForUser,
  getActiveParticipantEnrollments,
  getProgramAssignmentsFromContactRoles,
  getParticipantProgramMemberships,
  getInactiveGroupMembershipHistory,
  getActiveResponsibilitiesForUser,
  getActiveVentureMembershipsForContact,
  getContactStoredRole,
} from "@/models/workspace";
import { learnerHasEnrollments } from "@/lib/lms/learning";
import { isBaselineIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

/**
 * WORKSPACES API — neutral post-login hub data
 *
 * Returns the authenticated user's assignments (program staff roles and
 * participant enrollments) plus the fallback home dashboard for their global
 * role. Any authenticated user may call this; having no assignment
 * is a valid state.
 *
 * `?scope=contexts` answers only the context list the page shell renders (see
 * the scope note inside GET). The hub page calls it without a scope and gets
 * everything.
 */

function assignmentHref(role, programId) {
  const r = String(role || "").toLowerCase();
  if (r === "facilitator") return `/facilitator/program/${programId}`;
  return roleHomeHref(r);
}

export async function GET(request) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();

    // ── Scope ──────────────────────────────────────────────────────────────
    // The context switcher in the page shell calls this endpoint on EVERY page,
    // but reads only `contexts` (org memberships, responsibilities, program
    // participations, ventures, learning) and the identity chip. Four of the
    // reads below serve the hub page alone: the flat assignment list, the
    // generalized program assignments, the past-membership history and the
    // legacy active-enrollment list. Serving them to the shell put four
    // statements on the widest burst of every navigation, for data nobody read.
    const contextsOnly =
      new URL(request.url).searchParams.get("scope") === "contexts";
    /** A read this scope does not use: answered locally, never sent. */
    const notNeeded = () => Promise.resolve({ rows: [] });

    // ── Wave 1: every read that needs only the session identity ─────────────
    // The reads are independent (only the user's id/email is required). They
    // used to be awaited one after another — twelve round trips (~1.6s in the
    // observed environment) before the hub could render. allSettled keeps the
    // original fail-open behaviour: a missing table or a failing read
    // contributes an empty list instead of breaking the endpoint.
    const [
      staffSettled,
      partSettled,
      contactRolesSettled,
      membershipsSettled,
      activeGroupsSettled,
      historySettled,
      responsibilitiesSettled,
      venturesSettled,
      learningSettled,
      storedRoleSettled,
    ] = await Promise.allSettled([
      contextsOnly
        ? notNeeded()
        : getStaffAssignmentsForUser(session.cid, session.email || session.cid),
      contextsOnly ? notNeeded() : getActiveParticipantEnrollments(session.cid),
      contextsOnly
        ? notNeeded()
        : getProgramAssignmentsFromContactRoles(session.cid),
      getParticipantProgramMemberships(session.cid),
      getEffectiveGroupsForUser(session.cid),
      contextsOnly
        ? notNeeded()
        : getInactiveGroupMembershipHistory(session.cid),
      getActiveResponsibilitiesForUser(session.cid),
      getActiveVentureMembershipsForContact(session.cid),
      learnerHasEnrollments(session.cid),
      getContactStoredRole(session.cid),
    ]);

    /** Rows of a settled read, or an empty list when it failed. */
    const rowsOf = (settled) =>
      settled.status === "fulfilled" ? settled.value.rows || [] : [];
    /** The value of a settled read, or `fallback` when it failed. */
    const valueOf = (settled, fallback) =>
      settled.status === "fulfilled" ? settled.value : fallback;

    const staffRows = rowsOf(staffSettled);
    const partRows = rowsOf(partSettled);

    // 1. Program staff assignments (facilitator / staff / ...)
    // 2. Participant enrollments (excluded when already a staff member there)
    const staffProgramIds = new Set(staffRows.map((r) => r.program_id));

    const workspaces = [];

    for (const r of staffRows) {
      const role = String(r.role || "staff").toLowerCase();
      workspaces.push({
        type: "program",
        title: role,
        program_id: r.program_id,
        program_name: r.program_name || r.program_id,
        href: assignmentHref(role, r.program_id) || "/workspaces",
      });
    }

    for (const r of partRows) {
      if (staffProgramIds.has(r.program_id)) continue;
      workspaces.push({
        type: "program",
        title: "participant",
        program_id: r.program_id,
        program_name: r.program_name || r.program_id,
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
      contexts.program_assignments = crRows.map((r) => {
        const roleKey = String(r.role || "staff").toLowerCase();
        return {
          ...r,
          source: "contact_roles",
          completed: false,
          href:
            roleKey === "facilitator"
              ? `/facilitator/program/${r.program_id}`
              : roleHomeHref(roleKey) || "/workspaces",
        };
      });
      const mirroredKeys = new Set(
        crRows
          .filter((r) => r.is_current)
          .map((r) => `${r.program_id}|${String(r.role).toLowerCase()}`),
      );
      const legacyOnly = staffRows.filter(
        (r) =>
          !mirroredKeys.has(`${r.program_id}|${String(r.role).toLowerCase()}`),
      );
      for (const r of legacyOnly) {
        const roleKey = String(r.role || "staff").toLowerCase();
        contexts.program_assignments.push({
          contact_cid: session.cid,
          role: r.role,
          title: r.role,
          program_id: r.program_id,
          is_current: true,
          status: "active",
          scope: null,
          started_at: null,
          ended_at: null,
          program_name: r.program_name || r.program_id,
          source: "v2_program_staff",
          completed: false,
          href:
            roleKey === "facilitator"
              ? `/facilitator/program/${r.program_id}`
              : roleHomeHref(roleKey) || "/workspaces",
        });
      }
    } catch (_) {}

    // 2. All participant memberships with lifecycle status (incl. completed).
    try {
      contexts.program_participations = rowsOf(membershipsSettled).map((r) => {
        const completed =
          String(r.status || "").toLowerCase() === "completed" ||
          !!r.completed_at ||
          String(r.program_status || "").toLowerCase() === "completed";
        return {
          ...r,
          completed,
          readonly: completed,
          href: `/participant/${r.program_id}`,
        };
      });
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
      const activeGroups = valueOf(activeGroupsSettled, []);
      contexts.org_memberships = [...activeGroups].sort().map((groupName) => {
        const isIntern = /intern/i.test(String(groupName || ""));
        return {
          group_name: groupName,
          href: isIntern
            ? "/developer"
            : roleHomeHref(session.role) || "/workspaces",
        };
      });
      const pastRes = rowsOf(historySettled);
      contexts.org_history = pastRes;
    } catch (_) {}

    // 4. Responsibilities.
    try {
      contexts.responsibilities = rowsOf(responsibilitiesSettled).map((r) => ({
        ...r,
        href: String(r.key || "").toLowerCase().includes("finance")
          ? "/finance"
          : String(r.key || "").toLowerCase().includes("engineering")
            ? "/developer"
            : String(r.key || "").toLowerCase().includes("crm")
              ? "/crm"
              : "/workspaces",
      }));
    } catch (_) {}

    // 5. Venture memberships.
    try {
      contexts.venture_memberships = rowsOf(venturesSettled).map((r) => ({
        ...r,
        href: `/participant/ventures/${r.venture_id}`,
      }));
    } catch (_) {}

    // 6. LMS learner context — one aggregate "Learning" context while the
    //    user holds a non-suspended enrollment (same rule as the My Learning
    //    nav gate). Learner access itself is always enforced server-side by
    //    the LMS routes from lms_enrollments.
    contexts.learning = valueOf(learningSettled, false)
      ? { enrolled: true, href: "/participant/learning" }
      : { enrolled: false };

    // ── Phase I3: BASELINE ECHO (informational) ────────────────────────────
    // contacts.role is the raw stored role (baseline identity OR legacy
    // contextual value). session.role is what today's gates see (identical to
    // baseline_role unless the I2 legacy-role derivation is enabled, in which
    // case a stored "member" may be surfaced as participant/founder).
    // Read fresh (not taken from the 15s session cache) so the identity chip
    // always reflects the stored value.
    let baselineRole = session.role;
    const storedRows = rowsOf(storedRoleSettled);
    const raw = storedRows[0]?.role;
    if (raw) baselineRole = String(raw).toLowerCase();
    const derivedRole =
      isBaselineIdentity(baselineRole) &&
      baselineRole === "member" &&
      session.role !== "member"
        ? session.role
        : null;

    return NextResponse.json({
      success: true,
      user: {
        cid: session.cid,
        name: session.name,
        email: session.email,
        role: session.role,
        baseline_role: baselineRole,
        derived_role: derivedRole,
      },
      home: roleHomeHref(session.role),
      workspaces,
      contexts,
    });
  } catch (e) {
    console.error("[workspaces] error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
