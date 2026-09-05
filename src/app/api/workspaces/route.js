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
  getUserGroupMembershipsByNames,
  getInactiveGroupMembershipHistory,
  getActiveResponsibilitiesForUser,
  getActiveVentureMembershipsForContact,
} from "@/models/workspace";

export const dynamic = "force-dynamic";

/**
 * WORKSPACES API — neutral post-login hub data
 *
 * Returns the authenticated user's assignments (program staff roles and
 * participant enrollments) plus the fallback home dashboard for their
 * global role. Any authenticated user may call this; having no assignment
 * is a valid state.
 */

function assignmentHref(role, programId) {
  const r = String(role || "").toLowerCase();
  if (r === "facilitator") return `/facilitator/program/${programId}`;
  return roleHomeHref(r);
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();

    // 1. Program staff assignments (facilitator / staff / teacher / ...)
    const staffRes = await getStaffAssignmentsForUser(
      session.cid,
      session.email || session.cid,
    );

    // 2. Participant enrollments (excluded when already a staff member there)
    const staffProgramIds = new Set(staffRes.rows.map((r) => r.program_id));
    const partRes = await getActiveParticipantEnrollments(session.cid);

    const workspaces = [];

    for (const r of staffRes.rows) {
      const role = String(r.role || "staff").toLowerCase();
      workspaces.push({
        type: "program",
        title: role,
        program_id: r.program_id,
        program_name: r.program_name || r.program_id,
        href: assignmentHref(role, r.program_id) || "/workspaces",
      });
    }

    for (const r of partRes.rows) {
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
      const crRes = await getProgramAssignmentsFromContactRoles(session.cid);
      contexts.program_assignments = crRes.rows.map((r) => {
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
        crRes.rows
          .filter((r) => r.is_current)
          .map((r) => `${r.program_id}|${String(r.role).toLowerCase()}`),
      );
      const legacyOnly = staffRes.rows.filter(
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
      const ppRes = await getParticipantProgramMemberships(session.cid);
      contexts.program_participations = ppRes.rows.map((r) => {
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
    try {
      const activeGroups = await getEffectiveGroupsForUser(session.cid);
      let orgRows = [];
      if (activeGroups.length > 0) {
        const ugRes = await getUserGroupMembershipsByNames(session.cid, activeGroups);
        orgRows = ugRes.rows;
      }
      contexts.org_memberships = orgRows.map((g) => {
        const isIntern = /intern/i.test(String(g.group_name || ""));
        return {
          ...g,
          href: isIntern ? "/developer" : roleHomeHref(session.role) || "/workspaces",
        };
      });
      const pastRes = await getInactiveGroupMembershipHistory(session.cid);
      contexts.org_history = pastRes.rows;
    } catch (_) {}

    // 4. Responsibilities.
    try {
      const respRes = await getActiveResponsibilitiesForUser(session.cid);
      contexts.responsibilities = respRes.rows.map((r) => ({
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
      const vmRes = await getActiveVentureMembershipsForContact(session.cid);
      contexts.venture_memberships = vmRes.rows.map((r) => ({
        ...r,
        href: `/participant/ventures/${r.venture_id}`,
      }));
    } catch (_) {}

    return NextResponse.json({
      success: true,
      user: {
        cid: session.cid,
        name: session.name,
        email: session.email,
        role: session.role,
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
