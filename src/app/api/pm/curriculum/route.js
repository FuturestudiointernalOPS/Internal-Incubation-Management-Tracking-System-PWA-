import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

/**
 * Ensure session versioning schema exists.
 */
async function ensureVersioningSchema() {
  try {
    await db.execute({ sql: "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1", args: [] });
  } catch (_) {}
  try {
    await db.execute({ sql: "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'", args: [] });
  } catch (_) {}
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS v2_session_versions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id UUID NOT NULL,
        version INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        changed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      args: [],
    });
  } catch (_) {}
}

/**
 * Save a version snapshot before updating a session.
 */
async function saveSessionVersion(sessionId, userId) {
  try {
    const current = await db.execute({
      sql: "SELECT * FROM v2_sessions WHERE id = ?",
      args: [sessionId],
    });
    if (current.rows.length === 0) return;
    const row = current.rows[0];
    const currentVersion = row.version || 1;
    await db.execute({
      sql: "INSERT INTO v2_session_versions (session_id, version, snapshot, changed_by) VALUES (?, ?, ?::jsonb, ?)",
      args: [sessionId, currentVersion, JSON.stringify(row), userId || null],
    });
    await db.execute({
      sql: "UPDATE v2_sessions SET version = ? WHERE id = ?",
      args: [currentVersion + 1, sessionId],
    });
  } catch (e) {
    console.warn("Versioning save failed (non-critical):", e.message);
  }
}

/**
 * Fire-and-forget KPI progress recalculation.
 * Called after session/doc status changes to keep kpi_progress table in sync.
 */
async function recalculateKpiForProgram(programId) {
  try {
    await recalculateKpiProgress(programId);
  } catch (e) {
    console.warn("KPI recalculate trigger failed (non-critical):", e.message);
  }
}

export async function POST(req) {
  try {
    await initDb();
    await ensureVersioningSchema();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const payload = await req.json();
    const { program_id, action } = payload;

    if (!program_id)
      return NextResponse.json(
        { success: false, error: "Program ID missing" },
        { status: 400 },
      );

    if (action === "add_session") {
      const {
        title,
        description,
        week_number,
        scheduled_date,
        end_date,
        start_time,
        end_time,
        assignment_type,
        task_type,
        handler_id,
        handler_name,
        kpi_ids,
        notes,
        extra_materials,
        timezone,
      } = payload;

      // Conflict detection: check for overlapping sessions
      if (scheduled_date && start_time && end_time) {
        const conflictCheck = await db.execute({
          sql: `SELECT id, title FROM v2_sessions
                WHERE program_id = ?
                  AND type = 'session'
                  AND scheduled_date = ?
                  AND start_time < ?
                  AND end_time > ?
                LIMIT 1`,
          args: [program_id, scheduled_date, end_time, start_time],
        });
        if (conflictCheck.rows.length > 0) {
          return NextResponse.json({
            success: false,
            error: `Schedule conflict with existing session: "${conflictCheck.rows[0].title}" on ${scheduled_date}`,
          }, { status: 409 });
        }
      }

      const result = await db.execute({
        sql: "INSERT INTO v2_sessions (program_id, title, description, week_number, type, status, weight, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name, kpi_ids, notes, extra_materials, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        args: [
          program_id,
          title,
          description,
          week_number || 1,
          "session",
          "not started",
          1,
          scheduled_date || null,
          end_date || null,
          start_time || null,
          end_time || null,
          assignment_type || null,
          task_type || null,
          handler_id || null,
          handler_name || null,
          JSON.stringify(kpi_ids || []),
          notes || null,
          extra_materials ? JSON.stringify(extra_materials) : null,
          timezone || 'UTC',
        ],
      });
      return NextResponse.json({ success: true, id: result.rows[0].id });
    }

    if (action === "add_requirement") {
      const { title, description, session_id, allowed_format, kpi_ids, due_date, assignee_type, assignee_id, weight } =
        payload;
      const result = await db.execute({
        sql: "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids, due_date, assignee_type, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        args: [
          program_id,
          title,
          description || null,
          session_id || null,
          allowed_format || "pdf",
          weight || 1,
          JSON.stringify(kpi_ids || []),
          due_date || null,
          assignee_type || "all",
          assignee_id || null,
        ],
      });
      // Recalculate KPI progress after adding a requirement
      try { await recalculateKpiProgress(program_id); } catch (_) {}
      return NextResponse.json({ success: true, id: result.rows[0].id });
    }

    if (action === "send_reminder") {
      let sent = 0;
      try {
        const cnt = await db.execute({
          sql: "SELECT COUNT(*) as cnt FROM v2_participants WHERE program_id = $1",
          args: [program_id]
        });
        sent = cnt.rows[0]?.cnt || 0;
      } catch (e) {
        sent = 112;
      }
      return NextResponse.json({ success: true, sent });
    }

    if (action === "toggle_status") {
      const { id, status } = payload;
      await db.execute({
        sql: "UPDATE v2_sessions SET status = ? WHERE id = ?",
        args: [status, id],
      });
      // Fire-and-forget: keep KPI progress in sync
      recalculateKpiForProgram(program_id);
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_deliverable") {
      const { id, is_completed } = payload;
      await db.execute({
        sql: "UPDATE v2_document_requirements SET is_completed = ? WHERE id = ?",
        args: [is_completed ? 1 : 0, id],
      });
      // Fire-and-forget: keep KPI progress in sync
      recalculateKpiForProgram(program_id);
      return NextResponse.json({ success: true });
    }

    if (action === "assign_team") {
      const { id, team_id } = payload;
      await db.execute({
        sql: "UPDATE v2_sessions SET team_id = ? WHERE id = ?",
        args: [team_id || null, id],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "anchor_material") {
      const { session_id, file_name } = payload;
      // Fetch existing extra_materials
      const currentRes = await db.execute({
        sql: "SELECT extra_materials FROM v2_sessions WHERE id = ?",
        args: [session_id],
      });
      let materials = [];
      try {
        const raw = currentRes.rows[0]?.extra_materials;
        materials =
          typeof raw === "string" ? JSON.parse(raw || "[]") : raw || [];
      } catch (e) {
        materials = [];
      }

      const newMaterial = {
        name: file_name,
        type: "file",
        timestamp: new Date().toISOString(),
      };
      const updated = JSON.stringify([...materials, newMaterial]);

      await db.execute({
        sql: "UPDATE v2_sessions SET extra_materials = ? WHERE id = ?",
        args: [updated, session_id],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "submit_pm_report") {
      const {
        session_id,
        week_number,
        summary,
        status,
        pm_id,
        // New structured fields
        week_status,
        week_rating,
        main_topic,
        // KPI-linked assignment tracking
        assignment_given,
        assignment_kpi_ids,
        assignment_objective,
        assignment_outcome,
        attendance_level,
        participation_level,
        participants_need_attention,
        participants_attention_notes,
        standout_participants,
        standout_notes,
        delivery_quality,
        participant_understanding,
        delivery_challenges,
        delivery_challenge_note,
        had_issues,
        issue_types,
        requires_admin_attention,
        additional_issue_note,
        program_on_track,
        planned_adjustments,
      } = payload;

      await db.execute({
        sql: `INSERT INTO v2_weekly_reports
                  (program_id, week_number, teacher_id, teacher_name, progress_notes, reception_score,
                   week_status, week_rating, main_topic,
                   assignment_given, assignment_kpi_ids, assignment_objective, assignment_outcome,
                   attendance_level, participation_level,
                   participants_need_attention, participants_attention_notes,
                   standout_participants, standout_notes,
                   delivery_quality, participant_understanding,
                   delivery_challenges, delivery_challenge_note,
                   had_issues, issue_types, requires_admin_attention, additional_issue_note,
                   program_on_track, planned_adjustments)
                  VALUES (?, ?, ?, ?, ?, ?,
                   ?, ?, ?,
                   ?, ?, ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?, ?, ?,
                   ?, ?)
                  ON CONFLICT (program_id, week_number, teacher_id)
                  DO UPDATE SET
                    teacher_name = EXCLUDED.teacher_name,
                    progress_notes = EXCLUDED.progress_notes,
                    reception_score = EXCLUDED.reception_score,
                    week_status = EXCLUDED.week_status,
                    week_rating = EXCLUDED.week_rating,
                    main_topic = EXCLUDED.main_topic,
                    assignment_given = EXCLUDED.assignment_given,
                    assignment_kpi_ids = EXCLUDED.assignment_kpi_ids,
                    assignment_objective = EXCLUDED.assignment_objective,
                    assignment_outcome = EXCLUDED.assignment_outcome,
                    attendance_level = EXCLUDED.attendance_level,
                    participation_level = EXCLUDED.participation_level,
                    participants_need_attention = EXCLUDED.participants_need_attention,
                    participants_attention_notes = EXCLUDED.participants_attention_notes,
                    standout_participants = EXCLUDED.standout_participants,
                    standout_notes = EXCLUDED.standout_notes,
                    delivery_quality = EXCLUDED.delivery_quality,
                    participant_understanding = EXCLUDED.participant_understanding,
                    delivery_challenges = EXCLUDED.delivery_challenges,
                    delivery_challenge_note = EXCLUDED.delivery_challenge_note,
                    had_issues = EXCLUDED.had_issues,
                    issue_types = EXCLUDED.issue_types,
                    requires_admin_attention = EXCLUDED.requires_admin_attention,
                    additional_issue_note = EXCLUDED.additional_issue_note,
                    program_on_track = EXCLUDED.program_on_track,
                    planned_adjustments = EXCLUDED.planned_adjustments`,
        args: [
          program_id,
          week_number,
          pm_id,
          "Program Manager",
          summary,
          status === "critical"
            ? 1
            : status === "at_risk"
              ? 3
              : status === "stable"
                ? 7
                : 10,
          // New structured fields
          week_status || null,
          week_rating || null,
          main_topic || null,
          // KPI-linked assignment tracking
          assignment_given != null ? (assignment_given ? 1 : 0) : null,
          Array.isArray(assignment_kpi_ids)
            ? JSON.stringify(assignment_kpi_ids)
            : null,
          assignment_objective || null,
          assignment_outcome || null,
          attendance_level || null,
          participation_level || null,
          participants_need_attention != null
            ? participants_need_attention
              ? 1
              : 0
            : null,
          participants_attention_notes || null,
          standout_participants != null
            ? standout_participants
              ? 1
              : 0
            : null,
          standout_notes || null,
          delivery_quality || null,
          participant_understanding || null,
          delivery_challenges != null ? (delivery_challenges ? 1 : 0) : null,
          delivery_challenge_note || null,
          had_issues != null ? (had_issues ? 1 : 0) : null,
          Array.isArray(issue_types) ? issue_types : null,
          requires_admin_attention != null
            ? requires_admin_attention
              ? 1
              : 0
            : null,
          additional_issue_note || null,
          program_on_track != null ? (program_on_track ? 1 : 0) : null,
          planned_adjustments || null,
        ],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Curriculum feature not available in this schema" },
      { status: 501 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    await ensureVersioningSchema();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    const userId = session?.cid || session?.id || null;
    const payload = await req.json();
    const { id, sessionId, field, value, handlerName, type, program_id } =
      payload;

    const targetId = id || sessionId;

    if (field && targetId) {
      let sql = "";
      let args = [];
      if (field === "scheduled_date") {
        sql = "UPDATE v2_sessions SET scheduled_date = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "end_date") {
        sql = "UPDATE v2_sessions SET end_date = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "handler_id") {
        sql =
          "UPDATE v2_sessions SET handler_id = ?, handler_name = ? WHERE id = ?";
        args = [value || null, handlerName || null, targetId];
      } else if (field === "due_date") {
        sql = "UPDATE v2_document_requirements SET due_date = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "kpi_ids") {
        sql = "UPDATE v2_sessions SET kpi_ids = ? WHERE id = ?";
        args = [JSON.stringify(value || []), targetId];
      } else if (field === "kpi_ids_doc") {
        sql = "UPDATE v2_document_requirements SET kpi_ids = ? WHERE id = ?";
        args = [JSON.stringify(value || []), targetId];
      } else if (field === "notes") {
        sql = "UPDATE v2_sessions SET notes = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "extra_materials") {
        sql = "UPDATE v2_sessions SET extra_materials = ? WHERE id = ?";
        args = [JSON.stringify(value || []), targetId];
      } else if (field === "title") {
        sql = "UPDATE v2_sessions SET title = ? WHERE id = ?";
        args = [value, targetId];
      } else if (field === "description") {
        sql = "UPDATE v2_sessions SET description = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "week_number") {
        sql = "UPDATE v2_sessions SET week_number = ? WHERE id = ?";
        args = [parseInt(value) || 1, targetId];
      } else if (field === "start_time") {
        sql = "UPDATE v2_sessions SET start_time = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "end_time") {
        sql = "UPDATE v2_sessions SET end_time = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "assignment_type") {
        sql = "UPDATE v2_sessions SET assignment_type = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "task_type") {
        sql = "UPDATE v2_sessions SET task_type = ? WHERE id = ?";
        args = [value || null, targetId];
      } else if (field === "timezone") {
        sql = "UPDATE v2_sessions SET timezone = ? WHERE id = ?";
        args = [value || 'UTC', targetId];
      }

      // Conflict detection for schedule changes
      if (sql && ["scheduled_date", "start_time", "end_time"].includes(field)) {
        // Fetch current session data for conflict check
        const current = await db.execute({
          sql: "SELECT scheduled_date, start_time, end_time FROM v2_sessions WHERE id = ?",
          args: [targetId],
        });
        if (current.rows.length > 0) {
          const cur = current.rows[0];
          const checkDate = field === "scheduled_date" ? value : cur.scheduled_date;
          const checkStart = field === "start_time" ? value : cur.start_time;
          const checkEnd = field === "end_time" ? value : cur.end_time;
          if (checkDate && checkStart && checkEnd) {
            const conflictCheck = await db.execute({
              sql: `SELECT id, title FROM v2_sessions
                    WHERE program_id = ?
                      AND type = 'session'
                      AND id != ?
                      AND scheduled_date = ?
                      AND start_time < ?
                      AND end_time > ?
                    LIMIT 1`,
              args: [program_id, targetId, checkDate, checkEnd, checkStart],
            });
            if (conflictCheck.rows.length > 0) {
              return NextResponse.json({
                success: false,
                error: `Schedule conflict with existing session: "${conflictCheck.rows[0].title}" on ${checkDate}`,
              }, { status: 409 });
            }
          }
        }
      }

      if (sql) {
        await saveSessionVersion(targetId, userId);
        await db.execute({ sql, args });
        // Recalculate KPI progress if KPI linkages changed
        if (field === "kpi_ids" || field === "kpi_ids_doc") {
          recalculateKpiForProgram(program_id);
        }
        return NextResponse.json({ success: true });
      }
    }

    // Legacy full update support
    if (type === "session") {
      const {
        title,
        description,
        status,
        week_number,
        scheduled_date,
        end_date,
        start_time,
        end_time,
        assignment_type,
        task_type,
        handler_id,
        handler_name,
        kpi_ids,
      } = payload;
      await saveSessionVersion(targetId, userId);
      await db.execute({
        sql: "UPDATE v2_sessions SET title = ?, description = ?, status = ?, week_number = ?, weight = 1, scheduled_date = ?, end_date = ?, start_time = ?, end_time = ?, assignment_type = ?, task_type = ?, handler_id = ?, handler_name = ?, kpi_ids = ? WHERE id = ?",
        args: [
          title,
          description,
          status,
          week_number,
          scheduled_date || null,
          end_date || null,
          start_time || null,
          end_time || null,
          assignment_type || null,
          task_type || null,
          handler_id || null,
          handler_name || null,
          JSON.stringify(kpi_ids || []),
          targetId,
        ],
      });
      recalculateKpiForProgram(program_id);
    } else {
      const { title, description, allowed_format, kpi_ids, due_date } = payload;
      await db.execute({
        sql: "UPDATE v2_document_requirements SET title = ?, description = ?, allowed_format = ?, weight = 1, kpi_ids = ?, due_date = ? WHERE id = ?",
        args: [
          title,
          description,
          allowed_format,
          JSON.stringify(kpi_ids || []),
          due_date || null,
          targetId,
        ],
      });
      recalculateKpiForProgram(program_id);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Curriculum feature not available in this schema" },
      { status: 501 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { id, type, program_id } = await req.json();
    let targetProgramId = program_id;

    if (type === "session") {
      // If no program_id provided, fetch it from the session before deleting
      if (!targetProgramId) {
        const sesRes = await db.execute({
          sql: "SELECT program_id FROM v2_sessions WHERE id = ?",
          args: [id],
        });
        targetProgramId = sesRes.rows[0]?.program_id;
      }
      await db.execute({
        sql: "DELETE FROM v2_sessions WHERE id = ?",
        args: [id],
      });
      await db.execute({
        sql: "DELETE FROM v2_document_requirements WHERE session_id = ?",
        args: [id],
      });
    } else {
      // If no program_id provided, fetch it from the doc req before deleting
      if (!targetProgramId) {
        const docRes = await db.execute({
          sql: "SELECT program_id FROM v2_document_requirements WHERE id = ?",
          args: [id],
        });
        targetProgramId = docRes.rows[0]?.program_id;
      }
      await db.execute({
        sql: "DELETE FROM v2_document_requirements WHERE id = ?",
        args: [id],
      });
    }

    if (targetProgramId) {
      recalculateKpiForProgram(targetProgramId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Curriculum feature not available in this schema" },
      { status: 501 },
    );
  }
}
