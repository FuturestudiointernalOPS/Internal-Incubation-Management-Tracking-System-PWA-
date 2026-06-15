import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
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
      } = payload;
      const result = await db.execute({
        sql: "INSERT INTO v2_sessions (program_id, title, description, week_number, status, weight, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name, kpi_ids, notes, extra_materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        args: [
          program_id,
          title,
          description,
          week_number || 1,
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
        ],
      });
      return NextResponse.json({ success: true, id: result.rows[0].id });
    }

    if (action === "add_requirement") {
      const { title, description, session_id, allowed_format, kpi_ids } =
        payload;
      await db.execute({
        sql: "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
        args: [
          program_id,
          title,
          description || null,
          session_id || null,
          allowed_format || "pdf",
          1,
          JSON.stringify(kpi_ids || []),
        ],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_status") {
      const { id, status } = payload;
      await db.execute({
        sql: "UPDATE v2_sessions SET status = ? WHERE id = ?",
        args: [status, id],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_deliverable") {
      const { id, is_completed } = payload;
      await db.execute({
        sql: "UPDATE v2_document_requirements SET is_completed = ? WHERE id = ?",
        args: [is_completed ? 1 : 0, id],
      });
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
      // Fetch existing materials
      const currentRes = await db.execute({
        sql: "SELECT materials FROM v2_sessions WHERE id = ?",
        args: [session_id],
      });
      let materials = [];
      try {
        const raw = currentRes.rows[0]?.materials;
        materials =
          typeof raw === "string" ? JSON.parse(raw || "[]") : raw || [];
      } catch (e) {
        materials = [];
      }

      const newMaterial = {
        name: file_name,
        timestamp: new Date().toISOString(),
        status: "anchored",
      };
      const updated = JSON.stringify([...materials, newMaterial]);

      await db.execute({
        sql: "UPDATE v2_sessions SET materials = ? WHERE id = ?",
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
                   ?, ?)`,
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
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const payload = await req.json();
    const { id, sessionId, field, value, handlerName, type } = payload;

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
      } else if (field === "kpi_ids") {
        sql = "UPDATE v2_sessions SET kpi_ids = ? WHERE id = ?";
        args = [JSON.stringify(value || []), targetId];
      }

      if (sql) {
        await db.execute({ sql, args });
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
    } else {
      const { title, description, allowed_format, kpi_ids } = payload;
      await db.execute({
        sql: "UPDATE v2_document_requirements SET title = ?, description = ?, allowed_format = ?, weight = 1, kpi_ids = ? WHERE id = ?",
        args: [
          title,
          description,
          allowed_format,
          JSON.stringify(kpi_ids || []),
          targetId,
        ],
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
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
    const { id, type } = await req.json();

    if (type === "session") {
      await db.execute({
        sql: "DELETE FROM v2_sessions WHERE id = ?",
        args: [id],
      });
      await db.execute({
        sql: "DELETE FROM v2_document_requirements WHERE session_id = ?",
        args: [id],
      });
    } else {
      await db.execute({
        sql: "DELETE FROM v2_document_requirements WHERE id = ?",
        args: [id],
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
