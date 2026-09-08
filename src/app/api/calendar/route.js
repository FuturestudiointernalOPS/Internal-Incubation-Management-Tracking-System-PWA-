import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

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
    const session = await getSession();
    const cid = session?.cid || null;

    // Role-aware program scope: facilitators see their assigned programs,
    // participants see their enrolled programs, others see everything.
    let scopedProgramIds = null; // null = no restriction
    if (session?.role === "facilitator" && cid) {
      const teams = await db.execute({
        sql: `SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM v2_teams WHERE handler_id = ?
              UNION
              SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM v2_program_staff WHERE role = 'facilitator' AND staff_id = ?`,
        args: [cid, cid],
      });
      scopedProgramIds = teams.rows.map((r) => r.pid);
    } else if (session?.role === "participant" && cid) {
      const pp = await db.execute({
        sql: "SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM participant_programs WHERE participant_id = ?",
        args: [cid],
      });
      scopedProgramIds = pp.rows.map((r) => r.pid);
    }

    // A scoped role (facilitator/participant) with NO assignments must see NO
    // program-scoped events — an empty scope list would silently remove the
    // program filter below and leak every program's events. The sentinel
    // matches no real program id.
    if (
      (session?.role === "facilitator" || session?.role === "participant") &&
      (!scopedProgramIds || scopedProgramIds.length === 0)
    ) {
      scopedProgramIds = ["__no_program_scope__"];
    }

    const scopePlaceholders = scopedProgramIds && scopedProgramIds.length
      ? scopedProgramIds.map(() => "?").join(",")
      : "";
    const programScopeSql = scopePlaceholders
      ? ` AND CAST(program_id AS TEXT) IN (${scopePlaceholders})`
      : "";
    const programTableScopeSql = scopePlaceholders
      ? ` AND CAST(id AS TEXT) IN (${scopePlaceholders})`
      : "";
    const programScopeArgs = scopedProgramIds || [];
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
        sql: `SELECT id, name, start_date, end_date, assigned_pm_id FROM v2_programs WHERE (start_date IS NOT NULL OR end_date IS NOT NULL) AND (is_archived IS NULL OR is_archived = 0)${programTableScopeSql}`,
        args: [...programScopeArgs],
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
              LEFT JOIN v2_programs p ON s.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
              WHERE s.start_at IS NOT NULL${programScopeSql}`,
        args: [...programScopeArgs],
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
              LEFT JOIN v2_programs p ON d.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
              WHERE d.due_date IS NOT NULL${programScopeSql}`,
        args: [...programScopeArgs],
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

    // 5. Follow-ups (v2_followups with scheduled_at)
    try {
      await db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS created_by TEXT");
      let followupSql = `SELECT f.id, f.comment, f.scheduled_at, f.followup_type, f.team_id, f.program_id, t.name AS team_name, p.name AS program_name
              FROM v2_followups f
              LEFT JOIN v2_teams t ON f.team_id = t.id
              LEFT JOIN v2_programs p ON f.program_id = p.id
              WHERE f.scheduled_at IS NOT NULL${programScopeSql}`;
      const followupArgs = [...programScopeArgs];

      // Follow-up visibility: super_admin sees all; participants see their own;
      // everyone else sees follow-ups they assigned (legacy NULL rows remain visible).
      if (session?.role === "participant" && cid) {
        followupSql += " AND f.participant_id = ?";
        followupArgs.push(cid);
      } else if (session?.role !== "super_admin" && cid) {
        followupSql += " AND (f.created_by IS NULL OR f.created_by = ?)";
        followupArgs.push(cid);
      }

      const followups = await db.execute({
        sql: followupSql,
        args: followupArgs,
      });
      for (const f of followups.rows) {
        events.push({
          id: `followup-${f.id}`,
          title: f.team_name
            ? `Coaching: ${f.team_name}`
            : `Follow-up: ${f.program_name || ""}`,
          date: f.scheduled_at,
          type: "follow_up",
          source: "followup",
          status: "scheduled",
          description: f.comment ? f.comment.substring(0, 80) : null,
          related_id: f.id,
          project_id: f.program_id,
          user_id: null,
        });
      }
    } catch (e) {
      console.error("Calendar: followups error:", e.message);
    }

    // 6. Venture sources (Vinance 3 Phase 1 — the platform calendar aggregates
    //    Venture activities too: venture-facing sessions, task deadlines,
    //    milestone target dates, journey stage targets).
    //    Scope: privileged roles see every Venture; founders/team see their
    //    own member ventures (venture_members rows keyed on the VNT code);
    //    delegated staff see their active assignments.
    try {
      const privilegedVentureRoles = ["staff", "super_admin", "program_manager", "developer", "admin"];
      const seesAllVentures = privilegedVentureRoles.includes(session?.role);
      let ventureScope = null; // null = no restriction
      if (!seesAllVentures && cid) {
        const vRes = await db.execute({
          sql: `SELECT venture_id FROM venture_members
                WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
                UNION
                SELECT venture_id FROM venture_staff_assignments
                WHERE staff_contact_id = ? AND status = 'active'`,
          args: [cid, cid, cid],
        }).catch(() => ({ rows: [] }));
        ventureScope = (vRes.rows || []).map((r) => r.venture_id).filter(Boolean);
      }

      if (seesAllVentures || (ventureScope && ventureScope.length > 0)) {
        // Membership codes are TEXT; canonical venture rows are UUID-keyed, so
        // resolve codes → internal ids and scope on BOTH key styles.
        let scopeIds = null;
        let scopeArgs = [];
        if (!seesAllVentures) {
          const idRes = await db.execute({
            sql: `SELECT id, venture_id FROM ventures WHERE venture_id IN (${ventureScope.map(() => "?").join(",")})`,
            args: ventureScope,
          }).catch(() => ({ rows: [] }));
          scopeIds = (idRes.rows || []).map((r) => r.id).filter(Boolean);
          scopeArgs = [...ventureScope, ...scopeIds];
        }
        const scopeSql = seesAllVentures
          ? ""
          : ` AND (venture_id IN (${ventureScope.map(() => "?").join(",")}) OR venture_id IN (${scopeIds.map(() => "?").join(",")}))`;
        const scopeQueryArgs = seesAllVentures ? [] : scopeArgs;

        // 6a. Venture-facing sessions
        const sessRes = await db.execute({
          sql: `SELECT id, title, start_time, coach_name, status FROM venture_sessions
                WHERE venture_facing = TRUE AND start_time IS NOT NULL${scopeSql}`,
          args: scopeQueryArgs,
        }).catch(() => ({ rows: [] }));
        for (const s of sessRes.rows || []) {
          events.push({
            id: `vsess-${s.id}`,
            title: s.title || "Venture session",
            date: s.start_time,
            type: "venture_session",
            source: "venture_session",
            status: s.status || "scheduled",
            description: s.coach_name ? `Coach: ${s.coach_name}` : null,
            related_id: s.id,
            project_id: null,
            user_id: null,
          });
        }

        // 6b. Venture task deadlines
        const vTaskRes = await db.execute({
          sql: `SELECT id, title, due_date, status FROM venture_tasks
                WHERE due_date IS NOT NULL${scopeSql}`,
          args: scopeQueryArgs,
        }).catch(() => ({ rows: [] }));
        for (const t of vTaskRes.rows || []) {
          events.push({
            id: `vtask-${t.id}`,
            title: `${t.title} (due)`,
            date: t.due_date,
            type: "venture_task_due",
            source: "venture_task",
            status: t.status || "backlog",
            description: null,
            related_id: t.id,
            project_id: null,
            user_id: null,
          });
        }

        // 6c. Venture milestone target dates
        const msRes = await db.execute({
          sql: `SELECT id, title, target_date, status FROM venture_milestones
                WHERE target_date IS NOT NULL${scopeSql}`,
          args: scopeQueryArgs,
        }).catch(() => ({ rows: [] }));
        for (const m of msRes.rows || []) {
          events.push({
            id: `vms-${m.id}`,
            title: `${m.title} (milestone)`,
            date: m.target_date,
            type: "venture_milestone",
            source: "venture_milestone",
            status: m.status || "not_started",
            description: null,
            related_id: m.id,
            project_id: null,
            user_id: null,
          });
        }

        // 6d. Journey stage targets (journey stages are UUID-keyed only)
        if (seesAllVentures || (scopeIds && scopeIds.length > 0)) {
          const stageRes = await db.execute({
            sql: seesAllVentures
              ? `SELECT id, name, target_date, status FROM venture_journey_stages
                 WHERE target_date IS NOT NULL`
              : `SELECT id, name, target_date, status FROM venture_journey_stages
                 WHERE target_date IS NOT NULL AND venture_id IN (${scopeIds.map(() => "?").join(",")})`,
            args: seesAllVentures ? [] : scopeIds,
          }).catch(() => ({ rows: [] }));
          for (const st of stageRes.rows || []) {
            events.push({
              id: `vstage-${st.id}`,
              title: st.name || "Journey stage",
              date: st.target_date,
              type: "venture_journey_target",
              source: "venture_journey",
              status: st.status || "locked",
              description: null,
              related_id: st.id,
              project_id: null,
              user_id: null,
            });
          }
        }
      }
    } catch (e) {
      console.error("Calendar: venture sources error:", e.message);
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
