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
    });
  } catch (e) {
    console.error("[workspaces] error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
