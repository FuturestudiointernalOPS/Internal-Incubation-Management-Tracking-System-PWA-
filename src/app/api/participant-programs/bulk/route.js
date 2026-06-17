import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

/**
 * PARTICIPANT-PROGRAMS BULK API
 * Handles bulk assign/remove of participants to/from a program.
 *
 * POST /api/participant-programs/bulk
 * Body: { participant_ids: ["p1", "p2"], program_id: "prog1", action: "add"|"remove", assigned_by: "sa" }
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const { participant_ids, program_id, action, assigned_by, source } = body;

    if (
      !participant_ids ||
      !Array.isArray(participant_ids) ||
      participant_ids.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "participant_ids (non-empty array) is required.",
        },
        { status: 400 },
      );
    }

    if (!program_id) {
      return NextResponse.json(
        { success: false, error: "program_id is required." },
        { status: 400 },
      );
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "action must be 'add' or 'remove'." },
        { status: 400 },
      );
    }

    // Verify the program exists before assigning (only on add)
    if (action === "add") {
      const progCheck = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE id = ?",
        args: [program_id],
      });
      if (progCheck.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Program "${program_id}" not found. Create it first before assigning.`,
          },
          { status: 404 },
        );
      }
    }

    const results = [];
    const errors = [];

    for (const participant_id of participant_ids) {
      try {
        if (action === "add") {
          await db.execute({
            sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
            args: [
              participant_id,
              program_id,
              assigned_by || null,
              source || "bulk",
            ],
          });
        } else {
          await db.execute({
            sql: "DELETE FROM participant_programs WHERE participant_id = ? AND program_id = ?",
            args: [participant_id, program_id],
          });
        }

        // Audit log
        await db.execute({
          sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by, source)
                VALUES (?, ?, ?, ?, ?)`,
          args: [
            participant_id,
            program_id,
            action === "add" ? "assigned" : "removed",
            assigned_by || null,
            source || "bulk",
          ],
        });

        results.push(participant_id);
      } catch (err) {
        console.error(
          `Bulk ${action} error for ${participant_id}:`,
          err.message,
        );
        errors.push({ participant_id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      program_id,
      processed: results,
      errors,
    });
  } catch (error) {
    console.error("POST participant-programs/bulk error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
