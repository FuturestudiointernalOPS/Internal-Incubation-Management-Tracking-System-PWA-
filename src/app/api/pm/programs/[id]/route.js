import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";

export const GET = createHandler(
  // Outer gate mirrors the program list endpoint's authenticated identities;
  // the capability check below is the actual decision (Phase 3: staff with
  // programs.view — default or individually granted — may view program
  // detail; everyone else is denied by the resolver, not by a hard-coded
  // role list).
  { roles: ["super_admin", "program_manager", "staff", "teacher"] },
  async (req, { params }) => {
    const capError = await requireAuthorization("programs", "view");
    if (capError) return capError;
    const { id } = await params;
    const result = await db.execute({
      sql: `SELECT p.*, c1.name as pm_name, c2.name as assistant_name, k.title as note_title
          FROM v2_programs p
          LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
          LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
          LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
          WHERE p.id = ?`,
      args: [id],
    });
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    // Lazy-ensure the program-level Facilitators group exists (system-defined,
    // non-participant representation of the people in v2_program_staff).
    try {
      await db.execute({
        sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
              SELECT ?, 'Facilitators', 'facilitators', 1
              WHERE NOT EXISTS (
                SELECT 1 FROM v2_groups
                WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
              )`,
        args: [String(id), String(id)],
      });
    } catch (_) {}

    // Program facilitators (external personnel, role='facilitator') — same
    // enrichment as the list endpoint so the PM facilitator management UI
    // can render assigned facilitators and prevent duplicates client-side.
    let facilitators = [];
    try {
      const facRes = await db.execute({
        sql: `SELECT ps.id, ps.staff_id, ps.role, ps.permissions, c.name, c.email
              FROM v2_program_staff ps
              LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
              WHERE CAST(ps.program_id AS TEXT) = ? AND ps.role = 'facilitator'`,
        args: [String(id)],
      });
      facilitators = facRes.rows.map((r) => {
        let perms = r.permissions || {};
        if (typeof perms === "string") {
          try { perms = JSON.parse(perms); } catch { perms = {}; }
        }
        return {
          id: r.id,
          cid: r.staff_id,
          role: r.role || "facilitator",
          permissions: perms,
          name: r.name || r.email || r.staff_id,
          email: r.email || r.staff_id,
        };
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      program: { ...result.rows[0], facilitators },
    });
  },
);
