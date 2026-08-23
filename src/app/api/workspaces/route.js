import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { roleHomeHref } from "@/lib/platform/roles";

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
    const staffRes = await db.execute({
      sql: `SELECT ps.role, CAST(ps.program_id AS TEXT) AS program_id, p.name AS program_name
            FROM v2_program_staff ps
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
            WHERE (ps.staff_id = ? OR LOWER(ps.staff_id) = LOWER(?))
            ORDER BY p.name ASC`,
      args: [session.cid, session.email || session.cid],
    });

    // 2. Participant enrollments (excluded when already a staff member there)
    const staffProgramIds = new Set(staffRes.rows.map((r) => r.program_id));
    const partRes = await db.execute({
      sql: `SELECT CAST(pp.program_id AS TEXT) AS program_id, p.name AS program_name
            FROM participant_programs pp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
            WHERE pp.participant_id = ? AND (pp.status IS NULL OR pp.status = 'active')
            ORDER BY p.name ASC`,
      args: [session.cid],
    });

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
      const crRes = await db.execute({
        sql: `SELECT cr.contact_cid, cr.role, cr.title, cr.context_id AS program_id,
                     cr.is_current, cr.status, cr.scope, cr.started_at, cr.ended_at,
                     p.name AS program_name
              FROM contact_roles cr
              LEFT JOIN v2_programs p ON p.id::text = cr.context_id::text
              WHERE cr.contact_cid = ? AND cr.context_type = 'program'
              ORDER BY cr.is_current DESC, cr.started_at DESC`,
        args: [session.cid],
      });
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
      const ppRes = await db.execute({
        sql: `SELECT pp.participant_id, pp.program_id, pp.status, pp.screening_status,
                     pp.accepted_at, pp.completed_at, pp.outcome, pp.certificate_issued,
                     p.name AS program_name, p.status AS program_status
              FROM participant_programs pp
              LEFT JOIN v2_programs p ON p.id::text = pp.program_id::text
              WHERE pp.participant_id = ?
              ORDER BY pp.assigned_at DESC`,
        args: [session.cid],
      });
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

    // 3. Organizational memberships (user_groups).
    try {
      const ugRes = await db.execute({
        sql: "SELECT group_name, role_in_group FROM user_groups WHERE user_cid = ? ORDER BY group_name",
        args: [session.cid],
      });
      contexts.org_memberships = ugRes.rows.map((g) => {
        const isIntern = /intern/i.test(String(g.group_name || ""));
        return {
          ...g,
          href: isIntern ? "/developer" : roleHomeHref(session.role) || "/workspaces",
        };
      });
    } catch (_) {}

    // 4. Responsibilities.
    try {
      const respRes = await db.execute({
        sql: `SELECT r.id, r.name, r.key, r.description, r.icon
              FROM user_responsibilities ur
              JOIN responsibilities r ON r.id = ur.responsibility_id
              WHERE ur.user_cid = ? AND r.is_active = 1
              ORDER BY r.name`,
        args: [session.cid],
      });
      contexts.responsibilities = respRes.rows.map((r) => ({
        ...r,
        href: String(r.key || "").toLowerCase().includes("finance")
          ? "/finance"
          : String(r.key || "").toLowerCase().includes("engineering")
            ? "/developer"
            : "/workspaces",
      }));
    } catch (_) {}

    // 5. Venture memberships.
    try {
      const vmRes = await db.execute({
        sql: `SELECT vm.*, COALESCE(v.company_name, v.name) AS venture_name, v.status AS venture_status
              FROM venture_members vm
              LEFT JOIN ventures v ON v.venture_id = vm.venture_id
              WHERE vm.contact_id = ? AND vm.removed_at IS NULL
              ORDER BY vm.joined_at DESC`,
        args: [session.cid],
      });
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
