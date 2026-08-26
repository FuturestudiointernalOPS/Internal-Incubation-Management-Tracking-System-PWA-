import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/contacts/search?q=...&program_id=X
 *
 * MVP boundary: the general Future Studio CRM directory is NOT available to
 * external users.
 *
 * - Internal CRM roles (staff, program_manager, teacher, super_admin):
 *   general search across the contacts directory (they hold contacts.view).
 * - External users (participant, founder): search is scoped to their own
 *   program context ONLY — participants of the program, its staff and its
 *   assigned program manager. A `program_id` is required and the caller must
 *   belong to that program (participant_programs, or a venture founder whose
 *   venture belongs to the program). Names/emails only — never full records.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant",
      "founder",
      "staff",
      "program_manager",
      "super_admin",
      "teacher",
    ]);
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const programId = searchParams.get("program_id");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const isExternal = ["participant", "founder"].includes(session.role);
    const like = `%${q}%`;

    if (isExternal) {
      // External users: program-scoped search only — never the general CRM
      // directory. The caller must belong to the requested program.
      if (!programId) {
        return NextResponse.json(
          {
            success: false,
            error: "External users can only search within their own program.",
          },
          { status: 403 },
        );
      }

      const isParticipant = (
        await db.execute({
          sql: `SELECT 1 FROM participant_programs
                WHERE participant_id = ? AND CAST(program_id AS TEXT) = ?
                LIMIT 1`,
          args: [session.cid, programId],
        })
      ).rows.length > 0;

      const isFounder = (
        await db.execute({
          sql: `SELECT 1 FROM venture_members vm
                JOIN ventures v ON v.venture_id = vm.venture_id
                WHERE (vm.user_cid = ? OR vm.contact_id = ?)
                  AND CAST(v.program_id AS TEXT) = ?
                LIMIT 1`,
          args: [session.cid, session.cid, programId],
        })
      ).rows.length > 0;

      if (!isParticipant && !isFounder) {
        return NextResponse.json(
          { success: false, error: "You can only search within your own program." },
          { status: 403 },
        );
      }

      // Scoped pool: program participants, program staff, assigned program
      // manager. Name/email only — minimal identity, no full contact record.
      const result = await db.execute({
        sql: `SELECT cid, name, email FROM contacts
              WHERE (name ILIKE ? OR email ILIKE ?)
                AND (
                  cid IN (
                    SELECT participant_id FROM participant_programs
                    WHERE CAST(program_id AS TEXT) = ?
                  )
                  OR cid IN (
                    SELECT staff_id FROM v2_program_staff
                    WHERE CAST(program_id AS TEXT) = ?
                  )
                  OR cid IN (
                    SELECT assigned_pm_id FROM v2_programs
                    WHERE id::text = ? AND assigned_pm_id IS NOT NULL
                  )
                )
              ORDER BY name ASC LIMIT 20`,
        args: [like, like, programId, programId, programId],
      });

      return NextResponse.json({ success: true, contacts: result.rows || [] });
    }

    // Internal CRM roles: general directory search (unchanged).
    const result = await db.execute({
      sql: `SELECT cid, name, email FROM contacts
            WHERE (name ILIKE ? OR email ILIKE ?)
            ORDER BY name ASC LIMIT 20`,
      args: [like, like],
    });

    return NextResponse.json({ success: true, contacts: result.rows || [] });
  } catch (error) {
    console.error("GET /api/contacts/search error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
