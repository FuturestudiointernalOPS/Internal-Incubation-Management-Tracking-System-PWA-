import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { isParticipantInProgram } from "@/lib/participant-membership";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const { id: programId } = await params;

    // Verify the participant is actually assigned to this program.
    const contactRes = await db.execute({
      sql: "SELECT program_id, group_name FROM contacts WHERE cid = ?",
      args: [cid],
    });
    const contact = contactRes.rows[0];

    const isAssigned = await isParticipantInProgram({
      cid,
      email: session.email,
      programId,
      contact,
    });

    if (!isAssigned) {
      return NextResponse.json(
        { success: false, error: "You are not enrolled in this program." },
        { status: 403 },
      );
    }

    const progRes = await db.execute({
      sql: "SELECT * FROM v2_programs WHERE id::text = ?",
      args: [programId],
    });
    if (progRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }
    const program = progRes.rows[0];

    const [sesRes, delRes, subRes, attRes, kpiRes, staffRes, folRes, knowRes] =
      await Promise.all([
        db.execute({
          sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? ORDER BY created_at DESC",
          args: [cid, programId],
        }),
        db.execute({
          sql: "SELECT a.* FROM v2_attendance a JOIN v2_sessions s ON a.session_id::text = s.id::text WHERE a.participant_id::text = ? AND s.program_id::text = ? ORDER BY a.created_at ASC",
          args: [cid, programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id = c.cid WHERE ps.program_id = ?",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 10",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_knowledge_bank WHERE is_archived = 0 ORDER BY created_at DESC",
          args: [],
        }),
      ]);

    const sessions = sesRes.rows || [];
    const deliverables = delRes.rows || [];
    const submissions = subRes.rows || [];
    const attendance = attRes.rows || [];
    const kpis = kpiRes.rows || [];
    const facilitators = (staffRes.rows || []).map((s) => ({
      id: s.staff_id,
      name: s.staff_name || s.staff_id,
      role: s.role,
    }));
    const followups = folRes.rows || [];
    const knowledgeItems = knowRes.rows || [];

    // Fetch actual file URLs from knowledge_attachments
    let attachmentsByNote = {};
    if (knowledgeItems.length > 0) {
      try {
        const attachRes = await db.execute({
          sql:
            "SELECT * FROM v2_knowledge_attachments WHERE note_id IN (" +
            knowledgeItems.map(() => "?").join(",") +
            ") ORDER BY created_at DESC",
          args: knowledgeItems.map((k) => k.id),
        });
        for (const a of attachRes.rows || []) {
          if (!attachmentsByNote[a.note_id]) attachmentsByNote[a.note_id] = [];
          attachmentsByNote[a.note_id].push({ name: a.name, url: a.url });
        }
      } catch (_) {}
    }

    let pmName = null;
    if (program.assigned_pm_id) {
      const pmRes = await db.execute({
        sql: "SELECT name FROM contacts WHERE cid = ?",
        args: [program.assigned_pm_id],
      });
      if (pmRes.rows.length > 0) pmName = pmRes.rows[0].name;
    }

    // ─── Determine locked/unlocked status for all weeks ───
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkUnlocked = (s) => {
      if (s.status === "active" || s.status === "in progress" || s.status === "completed") return true;
      if (!s.scheduled_date) return true;
      const sched = new Date(s.scheduled_date);
      sched.setHours(0, 0, 0, 0);
      return sched <= today;
    };

    const unlockedSessions = sessions.filter(checkUnlocked);
    const unlockedSessionWeekNumbers = new Set(
      unlockedSessions.map((s) => s.week_number || 1),
    );

    const currentWeek =
      unlockedSessions.length > 0
        ? Math.max(...unlockedSessions.map((s) => s.week_number || 1))
        : 1;

    // Only show KPIs linked to all sessions
    const unlockedKpiIds = new Set();
    for (const s of sessions) {
      try {
        const ids =
          typeof s.kpi_ids === "string"
            ? JSON.parse(s.kpi_ids || "[]")
            : s.kpi_ids || [];
        for (const id of ids) unlockedKpiIds.add(Number(id));
      } catch (_) {}
    }
    const visibleKpis =
      unlockedKpiIds.size > 0
        ? kpis.filter((k) => unlockedKpiIds.has(Number(k.id)))
        : sessions.length > 0
          ? kpis
          : [];

    // Build weekly curriculum from all content
    const weeks = [];
    const weekMap = new Map();
    for (const s of sessions) {
      const wn = s.week_number || 1;
      if (!weekMap.has(wn))
        weekMap.set(wn, {
          number: wn,
          sessions: [],
          deliverables: [],
        });
      weekMap.get(wn).sessions.push(s);
    }
    for (const d of deliverables) {
      const wn = d.session_id
        ? sessions.find((s) => s.id === d.session_id)?.week_number || 1
        : d.week_number || 1;
      if (!weekMap.has(wn))
        weekMap.set(wn, {
          number: wn,
          sessions: [],
          deliverables: [],
        });
      weekMap.get(wn).deliverables.push(d);
    }

    for (const [wn, data] of weekMap) {
      const completedDels = data.deliverables.filter((d) =>
        submissions.some(
          (s) => String(s.deliverable_id) === String(d.id) && s.status === "approved",
        ),
      ).length;
      
      const isWeekUnlocked = data.sessions.some(checkUnlocked) || unlockedSessionWeekNumbers.has(wn) || (wn <= currentWeek);

      weeks.push({
        number: data.number,
        sessions: data.sessions,
        locked: !isWeekUnlocked,
        deliverables: data.deliverables.map((d) => {
          const sub = submissions.find((s) => String(s.deliverable_id) === String(d.id));
          return {
            id: d.id,
            title: d.title,
            description: d.description,
            dueDate: d.due_date || d.created_at,
            allowedFormat: d.allowed_format,
            weight: d.weight,
            submission: sub
              ? {
                  id: sub.id,
                  status: sub.status,
                  fileUrl: sub.file_url,
                  score: sub.score,
                  submittedAt: sub.created_at,
                }
              : null,
          };
        }),
        completed:
          data.deliverables.length > 0 &&
          completedDels === data.deliverables.length,
        isCurrent: data.number === currentWeek,
      });
    }
    weeks.sort((a, b) => a.number - b.number);

    // Build resources with real attachment URLs
    const resources = knowledgeItems.map((item) => {
      const attachments = attachmentsByNote[item.id] || [];
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        url: attachments.length > 0 ? attachments[0].url : null,
        fileType: item.file_type,
        filePath: item.file_path,
        category: item.category,
        tags: item.tags ? item.tags.split(",").map((t) => t.trim()) : [],
        attachments,
        createdAt: item.created_at,
      };
    });
    const resourcesByWeek = new Map();
    for (const r of resources) {
      const matchedSession = unlockedSessions.find(
        (s) =>
          r.tags?.includes(String(s.id)) ||
          r.category === String(s.id) ||
          r.title?.toLowerCase().includes(`week ${s.week_number}`),
      );
      const weekNum = matchedSession?.week_number || 0;
      if (!resourcesByWeek.has(weekNum)) resourcesByWeek.set(weekNum, []);
      resourcesByWeek.get(weekNum).push(r);
    }
    const generalResources = resources.filter((r) => {
      for (const [, rs] of resourcesByWeek) {
        if (rs.includes(r)) return false;
      }
      return true;
    });

    const unlockedWeeks = weeks.filter((w) => !w.locked);
    const unlockedDeliverables = unlockedWeeks.flatMap((w) => w.deliverables);

    // ─── 1. Program completion = how far the program itself has progressed ───
    // Use week-based progress: currentWeek / program.duration_weeks
    const durationWeeks = Number(program.duration_weeks) || weeks.length || 1;
    const percentComplete = Math.round((currentWeek / durationWeeks) * 100);

    // ─── 2. Deliverables done — exclude 'attendance' deliverables ───
    const unlockedNonAttendanceDeliverables = unlockedDeliverables.filter(
      (d) => !d.title?.toLowerCase().includes("attendance")
    );
    const totalDeliverables = unlockedNonAttendanceDeliverables.length;
    const completedDeliverables = unlockedNonAttendanceDeliverables.filter((d) =>
      submissions.some(
        (s) => String(s.deliverable_id) === String(d.id) && s.status === "approved",
      ),
    ).length;

    // ─── 3. Attendance — for this participant only ───
    const attendedSessions = attendance.filter(
      (a) => a.status === "present",
    ).length;
    // Total sessions this participant was expected to attend = sessions that are unlocked
    const totalSessions = unlockedSessions.length || 1;
    // Attendance rate uses distinct recorded attendance dates (matches home/list endpoints)
    const expectedDaysRes = await db.execute({
      sql: "SELECT COUNT(DISTINCT date) as total_days FROM v2_attendance WHERE program_id::text = ?",
      args: [programId],
    });
    const totalExpectedDays = parseInt(expectedDaysRes.rows[0]?.total_days) || 1;
    const attendanceRate = Math.round((attendedSessions / totalExpectedDays) * 100);

    // ─── 4. KPI Progress — per participant ───
    // A participant's KPI achievement is the average across the program's KPIs,
    // where each KPI counts as "achieved" only if they have an APPROVED
    // submission on a deliverable linked to that KPI.
    let kpiCompletion = 0;
    const approvedSubs = (submissions || []).filter(
      (s) => s.status === "approved",
    );
    const deliverableIdsByKpi = new Map();
    for (const d of deliverables || []) {
      let linkedKpiIds = [];
      try {
        linkedKpiIds =
          typeof d.kpi_ids === "string"
            ? JSON.parse(d.kpi_ids || "[]")
            : d.kpi_ids || [];
      } catch (_) {
        linkedKpiIds = [];
      }
      for (const kid of linkedKpiIds) {
        const key = String(kid);
        if (!deliverableIdsByKpi.has(key)) {
          deliverableIdsByKpi.set(key, new Set());
        }
        deliverableIdsByKpi.get(key).add(String(d.id));
      }
    }
    if ((kpis || []).length > 0) {
      const perKpi = kpis.map((kpi) => {
        const linked = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
        const achieved = approvedSubs.some((s) =>
          linked.has(String(s.deliverable_id)),
        );
        return achieved ? 100 : 0;
      });
      kpiCompletion = Math.round(
        perKpi.reduce((sum, v) => sum + v, 0) / perKpi.length,
      );
    }

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: program.start_date,
        endDate: program.end_date,
        durationWeeks: program.duration_weeks,
        currentWeek,
        programMode: program.program_mode,
        pmName,
        facilitators,
        metrics: {
          percentComplete,
          attendanceRate,
          kpiCompletion,
          currentWeek,
          totalDeliverables,
          completedDeliverables,
          totalSessions,
          attendedSessions,
        },
      },
      curriculum: { weeks, totalWeeks: weeks.length, currentWeek },
      submissions,
      attendance,
      kpis: visibleKpis,
      followups,
      resources: {
        byWeek: Object.fromEntries(resourcesByWeek),
        general: generalResources,
        total: resources.length,
      },
    });
  } catch (error) {
    console.error("Participant Program Detail Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
