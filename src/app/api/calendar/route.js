import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getFacilitatorProgramScopePids,
  getParticipantProgramScopePids,
  getCalendarTasksWithDates,
  getCalendarPrograms,
  getCalendarSessions,
  getCalendarDeliverables,
  ensureFollowupsCreatedByColumn,
  getCalendarFollowups,
} from "@/models/workspace";

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
    const sessionCid = session?.cid || null;

    // Program scope is derived from RELATIONSHIPS, not from the platform role
    // label. The identity correction stopped mutating `contacts.role` when
    // someone takes a facilitator assignment, so keying this on
    // `role === 'facilitator'` left every other contextual identity (a
    // `member` acting as a facilitator, for instance) falling through to
    // `null` — which means NO restriction and every program's sessions,
    // deliverables and follow-ups. That was a fail-open read.
    //
    // Internal / privileged identities keep their existing unscoped view;
    // everyone else is restricted to the programs they are actually assigned
    // to (facilitator) or enrolled in (participant), and an empty scope stays
    // empty rather than silently meaning "all".
    const PROGRAM_UNSCOPED_ROLES = [
      "super_admin",
      "staff",
      "program_manager",
      "team",
    ];
    let scopedProgramIds = null; // null = no restriction
    if (sessionCid && !PROGRAM_UNSCOPED_ROLES.includes(session?.role)) {
      const [facilitatorPids, participantPids] = await Promise.all([
        getFacilitatorProgramScopePids(sessionCid),
        getParticipantProgramScopePids(sessionCid),
      ]);
      const programIdSet = new Set([
        ...facilitatorPids.rows.map((row) => String(row.pid)),
        ...participantPids.rows.map((row) => String(row.pid)),
      ]);
      // Fail closed: no relationship at all means NO program-scoped events.
      scopedProgramIds = programIdSet.size
        ? [...programIdSet]
        : ["__no_program_scope__"];
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
      // Filter by user if provided
      const tasks = await getCalendarTasksWithDates(user_id);
      for (const task of tasks.rows) {
        if (task.start_date) {
          events.push({
            id: `task-${task.id}-start`,
            title: task.title,
            date: task.start_date,
            type: "task_start",
            source: "task",
            status: task.status,
            description: null,
            related_id: task.id,
            project_id: task.project_id,
            user_id: task.user_id,
          });
        }
        if (task.end_date) {
          events.push({
            id: `task-${task.id}-end`,
            title: `${task.title} (due)`,
            date: task.end_date,
            type: "task_due",
            source: "task",
            status: task.status,
            description: null,
            related_id: task.id,
            project_id: task.project_id,
            user_id: task.user_id,
          });
        }
      }
    } catch (error) {
      console.error("Calendar: tasks error:", error.message);
    }

    // 2. Programs (v2_programs)
    try {
      const programs = await getCalendarPrograms(
        programTableScopeSql,
        programScopeArgs,
      );
      for (const program of programs.rows) {
        if (program.start_date) {
          events.push({
            id: `program-${program.id}-start`,
            title: `${program.name} starts`,
            date: program.start_date,
            type: "program_start",
            source: "program",
            status: "active",
            description: null,
            related_id: program.id,
            project_id: null,
            user_id: program.assigned_pm_id,
          });
        }
        if (program.end_date) {
          events.push({
            id: `program-${program.id}-end`,
            title: `${program.name} ends`,
            date: program.end_date,
            type: "program_end",
            source: "program",
            status: "active",
            description: null,
            related_id: program.id,
            project_id: null,
            user_id: program.assigned_pm_id,
          });
        }
      }
    } catch (error) {
      console.error("Calendar: programs error:", error.message);
    }

    // 3. Sessions (v2_sessions)
    try {
      const sessions = await getCalendarSessions(
        programScopeSql,
        programScopeArgs,
      );
      for (const sessionRow of sessions.rows) {
        events.push({
          id: `session-${sessionRow.id}`,
          title: sessionRow.title,
          date: sessionRow.start_at,
          type: "session",
          source: "session",
          status: "scheduled",
          description: sessionRow.program_name
            ? `${sessionRow.type} — ${sessionRow.program_name}`
            : sessionRow.type,
          related_id: sessionRow.id,
          project_id: sessionRow.program_id,
          user_id: sessionRow.teacher_id,
        });
      }
    } catch (error) {
      console.error("Calendar: sessions error:", error.message);
    }

    // 4. Deliverables (v2_deliverables)
    try {
      const deliverables = await getCalendarDeliverables(
        programScopeSql,
        programScopeArgs,
      );
      for (const deliverable of deliverables.rows) {
        events.push({
          id: `deliverable-${deliverable.id}`,
          title: `${deliverable.title} due`,
          date: deliverable.due_date,
          type: "deliverable_due",
          source: "deliverable",
          status: "pending",
          description: deliverable.program_name || null,
          related_id: deliverable.id,
          project_id: deliverable.program_id,
          user_id: null,
        });
      }
    } catch (error) {
      console.error("Calendar: deliverables error:", error.message);
    }

    // 5. Follow-ups (v2_followups with scheduled_at)
    try {
      await ensureFollowupsCreatedByColumn();
      // Follow-up visibility: super_admin sees all; participants see their own;
      // everyone else sees follow-ups they assigned (legacy NULL rows remain visible).
      let followupVisibilitySql = "";
      const followupVisibilityArgs = [];
      if (session?.role === "participant" && sessionCid) {
        followupVisibilitySql = " AND f.participant_id = ?";
        followupVisibilityArgs.push(sessionCid);
      } else if (session?.role !== "super_admin" && sessionCid) {
        followupVisibilitySql = " AND (f.created_by IS NULL OR f.created_by = ?)";
        followupVisibilityArgs.push(sessionCid);
      }

      const followups = await getCalendarFollowups(
        programScopeSql,
        programScopeArgs,
        followupVisibilitySql,
        followupVisibilityArgs,
      );
      for (const followup of followups.rows) {
        events.push({
          id: `followup-${followup.id}`,
          title: followup.team_name
            ? `Coaching: ${followup.team_name}`
            : `Follow-up: ${followup.program_name || ""}`,
          date: followup.scheduled_at,
          type: "follow_up",
          source: "followup",
          status: "scheduled",
          description: followup.comment
            ? followup.comment.substring(0, 80)
            : null,
          related_id: followup.id,
          project_id: followup.program_id,
          user_id: null,
        });
      }
    } catch (error) {
      console.error("Calendar: followups error:", error.message);
    }

    // 6. Venture sources (Vinance 3 Phase 1 — the platform calendar aggregates
    //    Venture activities too: venture-facing sessions, task deadlines,
    //    milestone target dates, journey stage targets).
    //    Scope: privileged roles see every Venture; founders/team see their
    //    own member ventures (venture_members rows keyed on the VNT code);
    //    delegated staff see their active assignments.
    try {
      const personalMode = searchParams.get("personal") === "1";
      const privilegedVentureRoles = ["staff", "super_admin", "program_manager"];
      // Personal mode (Vinance 3 Phase 1): even privileged roles see only the
      // Ventures they are assigned to / coach sessions they are attached to.
      const seesAllVentures = privilegedVentureRoles.includes(session?.role) && !personalMode;
      let ventureScope = null; // null = no restriction
      if ((!seesAllVentures || personalMode) && sessionCid) {
        const ventureScopeResult = await db.execute({
          sql: `SELECT venture_id FROM venture_members
                WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
                UNION
                SELECT venture_id FROM venture_staff_assignments
                WHERE staff_contact_id = ? AND status = 'active'`,
          args: [sessionCid, sessionCid, sessionCid],
        }).catch(() => ({ rows: [] }));
        let scopeList = (ventureScopeResult.rows || [])
          .map((row) => row.venture_id)
          .filter(Boolean);
        // A coach's own sessions count even when stored under a UUID key or
        // when the coach holds no assignment row yet.
        if (personalMode) {
          const coachSessionsResult = await db.execute({
            sql: "SELECT DISTINCT venture_id FROM venture_sessions WHERE coach_contact_id = ?",
            args: [sessionCid],
          }).catch(() => ({ rows: [] }));
          scopeList = [
            ...scopeList,
            ...(coachSessionsResult.rows || [])
              .map((row) => row.venture_id)
              .filter(Boolean),
          ];
        }
        ventureScope = [...new Set(scopeList)];
      }

      if (seesAllVentures || (ventureScope && ventureScope.length > 0)) {
        // Membership/assignment codes are TEXT; canonical venture rows are
        // UUID-keyed — resolve codes → internal ids and scope on BOTH key
        // styles. Entries that resolve to neither are kept as ids (stale
        // codes simply match nothing).
        let scopeIds = null;
        let scopeArgs = [];
        if (!seesAllVentures) {
          const ventureIdResult = await db.execute({
            sql: `SELECT id, venture_id FROM ventures WHERE venture_id IN (${ventureScope.map(() => "?").join(",")})`,
            args: ventureScope,
          }).catch(() => ({ rows: [] }));
          const resolvedCodes = new Set(
            (ventureIdResult.rows || []).map((row) => row.venture_id),
          );
          const mappedIds = (ventureIdResult.rows || [])
            .map((row) => row.id)
            .filter(Boolean);
          const leftoverIds = ventureScope.filter(
            (scopeKey) => !resolvedCodes.has(scopeKey),
          );
          scopeIds = [...new Set([...mappedIds, ...leftoverIds])];
          scopeArgs = [...ventureScope, ...scopeIds];
        }
        const scopeSql = seesAllVentures
          ? ""
          : ` AND (venture_id IN (${ventureScope.map(() => "?").join(",")}) OR venture_id IN (${scopeIds.map(() => "?").join(",")}))`;
        const scopeQueryArgs = seesAllVentures ? [] : scopeArgs;
        // Personal coach filter: coaches always see their own sessions even
        // when not marked venture-facing.
        const sessionsPersonalSql =
          personalMode && sessionCid
            ? " AND (coach_contact_id = ? OR venture_facing = TRUE)"
            : "";
        const sessionsPersonalArgs = personalMode && sessionCid ? [sessionCid] : [];

        // 6a. Venture sessions (founder-facing, plus the coach's own)
        const sessionsBaseWhere = personalMode
          ? "start_time IS NOT NULL"
          : "venture_facing = TRUE AND start_time IS NOT NULL";
        const ventureSessionsResult = await db.execute({
          sql: `SELECT id, title, start_time, coach_name, coach_contact_id, status FROM venture_sessions
                WHERE ${sessionsBaseWhere}${scopeSql}${sessionsPersonalSql}`,
          args: [...scopeQueryArgs, ...sessionsPersonalArgs],
        }).catch(() => ({ rows: [] }));
        for (const sessionRow of ventureSessionsResult.rows || []) {
          events.push({
            id: `vsess-${sessionRow.id}`,
            title: sessionRow.title || "Venture session",
            date: sessionRow.start_time,
            type: "venture_session",
            source: "venture_session",
            status: sessionRow.status || "scheduled",
            description: sessionRow.coach_name
              ? `Coach: ${sessionRow.coach_name}`
              : null,
            related_id: sessionRow.id,
            project_id: null,
            user_id: null,
          });
        }

        // 6b. Venture task deadlines
        const ventureTasksResult = await db.execute({
          sql: `SELECT id, title, due_date, status FROM venture_tasks
                WHERE due_date IS NOT NULL${scopeSql}`,
          args: scopeQueryArgs,
        }).catch(() => ({ rows: [] }));
        for (const ventureTask of ventureTasksResult.rows || []) {
          events.push({
            id: `vtask-${ventureTask.id}`,
            title: `${ventureTask.title} (due)`,
            date: ventureTask.due_date,
            type: "venture_task_due",
            source: "venture_task",
            status: ventureTask.status || "backlog",
            description: null,
            related_id: ventureTask.id,
            project_id: null,
            user_id: null,
          });
        }

        // 6c. Venture milestone target dates
        const ventureMilestonesResult = await db.execute({
          sql: `SELECT id, title, target_date, status FROM venture_milestones
                WHERE target_date IS NOT NULL${scopeSql}`,
          args: scopeQueryArgs,
        }).catch(() => ({ rows: [] }));
        for (const milestone of ventureMilestonesResult.rows || []) {
          events.push({
            id: `vms-${milestone.id}`,
            title: `${milestone.title} (milestone)`,
            date: milestone.target_date,
            type: "venture_milestone",
            source: "venture_milestone",
            status: milestone.status || "not_started",
            description: null,
            related_id: milestone.id,
            project_id: null,
            user_id: null,
          });
        }

        // 6d. Journey stage targets (journey stages are UUID-keyed only)
        if (seesAllVentures || (scopeIds && scopeIds.length > 0)) {
          const journeyStagesResult = await db.execute({
            sql: seesAllVentures
              ? `SELECT id, name, target_date, status FROM venture_journey_stages
                 WHERE target_date IS NOT NULL`
              : `SELECT id, name, target_date, status FROM venture_journey_stages
                 WHERE target_date IS NOT NULL AND venture_id IN (${scopeIds.map(() => "?").join(",")})`,
            args: seesAllVentures ? [] : scopeIds,
          }).catch(() => ({ rows: [] }));
          for (const stage of journeyStagesResult.rows || []) {
            events.push({
              id: `vstage-${stage.id}`,
              title: stage.name || "Journey stage",
              date: stage.target_date,
              type: "venture_journey_target",
              source: "venture_journey",
              status: stage.status || "locked",
              description: null,
              related_id: stage.id,
              project_id: null,
              user_id: null,
            });
          }
        }
      }
    } catch (error) {
      console.error("Calendar: venture sources error:", error.message);
    }

    // Normalize dates to YYYY-MM-DD format
    const normalized = events.map((event) => {
      let dateStr = event.date;
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
      return { ...event, date: dateStr };
    });

    // Filter to requested month/year
    const monthStr = String(month).padStart(2, "0");
    const filtered = normalized.filter((event) => {
      if (!event.date) return false;
      // Check if event falls within the requested month
      return event.date.startsWith(`${year}-${monthStr}`);
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
