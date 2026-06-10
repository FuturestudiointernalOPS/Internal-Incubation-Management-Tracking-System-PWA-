import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * UNIFIED CALENDAR API
 *
 * GET /api/calendar?user_id=X&year=2026&month=6
 *
 * Returns normalized events from all sources:
 *   - Tasks (start_date, end_date)
 *   - Programs (start_date, end_date)
 *   - Sessions (start_at)
 *   - Deliverables (due_date)
 *   - Project milestones
 *
 * Each event is normalized to:
 *   { id, title, date, type, source, status, description, related_id }
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();
    const month =
      parseInt(searchParams.get("month")) || new Date().getMonth() + 1;

    const events = [];

    // 1. Tasks with dates
    try {
      let taskSql = `SELECT id, title, start_date, end_date, status, project_id, user_id, assigned_to FROM tasks WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)`;
      const taskArgs = [];

      // Filter by user if provided
      if (user_id) {
        taskSql += ` AND (user_id = ? OR assigned_to = ?)`;
        taskArgs.push(user_id, user_id);
      }

      const tasks = await db.execute({ sql: taskSql, args: taskArgs });
      for (const t of tasks.rows) {
        if (t.start_date) {
          events.push({
            id: `task-${t.id}-start`,
            title: t.title,
            date: t.start_date,
            type: "task_start",
            source: "task",
            status: t.status,
            description: null,
            related_id: t.id,
            project_id: t.project_id,
            user_id: t.user_id,
          });
        }
        if (t.end_date) {
          events.push({
            id: `task-${t.id}-end`,
            title: `${t.title} (due)`,
            date: t.end_date,
            type: "task_due",
            source: "task",
            status: t.status,
            description: null,
            related_id: t.id,
            project_id: t.project_id,
            user_id: t.user_id,
          });
        }
      }
    } catch (e) {
      console.error("Calendar: tasks error:", e.message);
    }

    // 2. Programs (v2_programs)
    try {
      const programs = await db.execute({
        sql: `SELECT id, name, start_date, end_date, assigned_pm_id FROM v2_programs WHERE start_date IS NOT NULL OR end_date IS NOT NULL`,
        args: [],
      });
      for (const p of programs.rows) {
        if (p.start_date) {
          events.push({
            id: `program-${p.id}-start`,
            title: `${p.name} starts`,
            date: p.start_date,
            type: "program_start",
            source: "program",
            status: "active",
            description: null,
            related_id: p.id,
            project_id: null,
            user_id: p.assigned_pm_id,
          });
        }
        if (p.end_date) {
          events.push({
            id: `program-${p.id}-end`,
            title: `${p.name} ends`,
            date: p.end_date,
            type: "program_end",
            source: "program",
            status: "active",
            description: null,
            related_id: p.id,
            project_id: null,
            user_id: p.assigned_pm_id,
          });
        }
      }
    } catch (e) {
      console.error("Calendar: programs error:", e.message);
    }

    // 3. Sessions (v2_sessions)
    try {
      const sessions = await db.execute({
        sql: `SELECT s.id, s.title, s.start_at, s.type, s.teacher_id, s.program_id, p.name AS program_name
              FROM v2_sessions s
              LEFT JOIN v2_programs p ON s.program_id = p.id
              WHERE s.start_at IS NOT NULL`,
        args: [],
      });
      for (const s of sessions.rows) {
        events.push({
          id: `session-${s.id}`,
          title: s.title,
          date: s.start_at,
          type: "session",
          source: "session",
          status: "scheduled",
          description: s.program_name
            ? `${s.type} — ${s.program_name}`
            : s.type,
          related_id: s.id,
          project_id: s.program_id,
          user_id: s.teacher_id,
        });
      }
    } catch (e) {
      console.error("Calendar: sessions error:", e.message);
    }

    // 4. Deliverables (v2_deliverables)
    try {
      const deliverables = await db.execute({
        sql: `SELECT d.id, d.title, d.due_date, d.week_number, d.program_id, p.name AS program_name
              FROM v2_deliverables d
              LEFT JOIN v2_programs p ON d.program_id = p.id
              WHERE d.due_date IS NOT NULL`,
        args: [],
      });
      for (const d of deliverables.rows) {
        events.push({
          id: `deliverable-${d.id}`,
          title: `${d.title} due`,
          date: d.due_date,
          type: "deliverable_due",
          source: "deliverable",
          status: "pending",
          description: d.program_name || null,
          related_id: d.id,
          project_id: d.program_id,
          user_id: null,
        });
      }
    } catch (e) {
      console.error("Calendar: deliverables error:", e.message);
    }

    // Normalize dates to YYYY-MM-DD format
    const normalized = events.map((e) => {
      let dateStr = e.date;
      if (dateStr && typeof dateStr === "string") {
        // Handle ISO strings like "2026-06-15T09:00:00.000Z"
        dateStr = dateStr.split("T")[0];
      } else if (dateStr && typeof dateStr === "object") {
        try {
          dateStr = dateStr.toISOString().split("T")[0];
        } catch (_) {
          dateStr = String(dateStr);
        }
      }
      return { ...e, date: dateStr };
    });

    // Filter to requested month/year
    const monthStr = String(month).padStart(2, "0");
    const filtered = normalized.filter((e) => {
      if (!e.date) return false;
      // Check if event falls within the requested month
      return e.date.startsWith(`${year}-${monthStr}`);
    });

    return NextResponse.json({
      success: true,
      events: filtered,
      total: filtered.length,
      month,
      year,
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
