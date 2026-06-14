import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const programId = params.id;

    const progRes = await db.execute({
      sql: "SELECT * FROM v2_programs WHERE id = ?",
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
          sql: "SELECT * FROM v2_sessions WHERE program_id = ? ORDER BY week_number ASC, start_at ASC",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
          args: [programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_submissions WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_attendance WHERE participant_id = ? AND program_id = ? ORDER BY date ASC",
          args: [cid, programId],
        }),
        db.execute({
          sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
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
          sql: "SELECT * FROM v2_knowledge_bank WHERE program_id = ? OR category = ? ORDER BY created_at DESC",
          args: [programId, programId],
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

    let pmName = null;
    if (program.assigned_pm_id) {
      const pmRes = await db.execute({
        sql: "SELECT name FROM contacts WHERE cid = ?",
        args: [program.assigned_pm_id],
      });
      if (pmRes.rows.length > 0) pmName = pmRes.rows[0].name;
    }

    // Build weekly curriculum
    const weeks = [];
    const weekMap = new Map();
    for (const s of sessions) {
      const wn = s.week_number || 1;
      if (!weekMap.has(wn))
        weekMap.set(wn, {
          number: wn,
          sessions: [],
          deliverables: [],
          locked: s.status === "locked",
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
          locked: false,
        });
      weekMap.get(wn).deliverables.push(d);
    }

    const unlockedSessions = sessions.filter((s) => s.status !== "locked");
    const maxCompletedWeek =
      unlockedSessions.length > 0
        ? Math.max(...unlockedSessions.map((s) => s.week_number || 1))
        : 0;
    const currentWeek = program.duration_weeks
      ? Math.min(Math.max(maxCompletedWeek, 1), program.duration_weeks)
      : 1;

    for (const [wn, data] of weekMap) {
      const completedDels = data.deliverables.filter((d) =>
        submissions.some(
          (s) => s.document_id === d.id && s.status === "approved",
        ),
      ).length;
      weeks.push({
        number: data.number,
        sessions: data.sessions,
        deliverables: data.deliverables.map((d) => {
          const sub = submissions.find((s) => s.document_id === d.id);
          return {
            id: d.id,
            title: d.title,
            description: d.description,
            dueDate: d.created_at,
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
        locked: data.locked,
        completed:
          data.deliverables.length > 0 &&
          completedDels === data.deliverables.length,
        isCurrent: data.number === currentWeek,
      });
    }
    weeks.sort((a, b) => a.number - b.number);

    // Build resources
    const resources = knowledgeItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      url: item.url,
      fileType: item.file_type,
      filePath: item.file_path,
      category: item.category,
      tags: item.tags ? item.tags.split(",").map((t) => t.trim()) : [],
      createdAt: item.created_at,
    }));
    const resourcesByWeek = new Map();
    for (const r of resources) {
      const matchedSession = sessions.find(
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

    const totalDeliverables = deliverables.length || 1;
    const completedDeliverables = deliverables.filter((d) =>
      submissions.some(
        (s) => s.document_id === d.id && s.status === "approved",
      ),
    ).length;
    const percentComplete = Math.round(
      (completedDeliverables / totalDeliverables) * 100,
    );
    const attendedSessions = attendance.filter(
      (a) => a.status === "present",
    ).length;
    const totalSessions = sessions.length || 1;
    const attendanceRate = Math.round((attendedSessions / totalSessions) * 100);
    const targetMetKpis = kpis.filter((k) => {
      const t = parseInt(k.target_value) || 0;
      const c = parseInt(k.current_value) || 0;
      return c >= t;
    }).length;
    const totalKpis = kpis.length || 1;
    const kpiCompletion = Math.round((targetMetKpis / totalKpis) * 100);

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
      kpis,
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
