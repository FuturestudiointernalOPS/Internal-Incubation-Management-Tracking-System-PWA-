import db, { initDb } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * PROJECT UPDATES API
 *
 * GET  /api/admin/projects/[id]/updates
 *   - Returns all weekly updates for a project, newest first
 *
 * POST /api/admin/projects/[id]/updates
 *   - Creates or updates a weekly narrative (upsert on project_id + week + year)
 *
 * Body (POST):
 *   user_id, user_name, week_number, year, status,
 *   accomplishments, current_focus, blockers, next_steps,
 *   overall_status, notes
 */

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    const result = await db.execute({
      sql: "SELECT * FROM v2_project_updates WHERE project_id::text = ? ORDER BY year DESC, week_number DESC",
      args: [id],
    });

    return NextResponse.json({ success: true, updates: result.rows });
  } catch (error) {
    console.error("GET project updates error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;
    const body = await req.json();

    const {
      user_id,
      user_name,
      week_number,
      year,
      status,
      accomplishments,
      current_focus,
      blockers,
      next_steps,
      overall_status,
      notes,
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    const currentWeek = week_number || getWeekNumber(new Date());
    const currentYear = year || new Date().getFullYear();

    // Check if an update already exists for this week
    const existing = await db.execute({
      sql: "SELECT id FROM v2_project_updates WHERE project_id::text = ? AND week_number = ? AND year = ?",
      args: [id, currentWeek, currentYear],
    });

    if (existing.rows.length > 0) {
      // Update existing
      const updateFields = [];
      const updateArgs = [];

      const fields = {
        accomplishments,
        current_focus,
        blockers,
        next_steps,
        overall_status,
        notes,
        status,
        user_name,
      };

      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateArgs.push(value);
        }
      }

      if (updateFields.length > 0) {
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        updateArgs.push(existing.rows[0].id);

        await db.execute({
          sql: `UPDATE v2_project_updates SET ${updateFields.join(", ")} WHERE id = ?`,
          args: updateArgs,
        });
      }

      return NextResponse.json({
        success: true,
        id: existing.rows[0].id,
        action: "updated",
        week_number: currentWeek,
        year: currentYear,
      });
    }

    // Create new
    const result = await db.execute({
      sql: `INSERT INTO v2_project_updates
        (project_id, user_id, user_name, week_number, year, status,
         accomplishments, current_focus, blockers, next_steps,
         overall_status, notes)
        VALUES (?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?)`,
      args: [
        id,
        user_id,
        user_name || "",
        currentWeek,
        currentYear,
        status || "draft",
        accomplishments || null,
        current_focus || null,
        blockers || null,
        next_steps || null,
        overall_status || "on_track",
        notes || null,
      ],
    });

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      action: "created",
      week_number: currentWeek,
      year: currentYear,
    });
  } catch (error) {
    console.error("POST project updates error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
