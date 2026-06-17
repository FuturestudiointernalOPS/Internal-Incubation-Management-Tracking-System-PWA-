import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
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
    const email = session.email;

    const contactRes = await db.execute({
      sql: "SELECT cid, name, email, group_name, program_id, program_name, role FROM contacts WHERE cid = ?",
      args: [cid],
    });

    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }

    const contact = contactRes.rows[0];

    const programIds = new Set();
    if (contact.program_id) {
      String(contact.program_id)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => programIds.add(id));
    }
    if (contact.group_name) {
      const familyRes = await db.execute({
        sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
        args: [contact.group_name],
      });
      familyRes.rows.forEach((r) => {
        if (r.program_id != null) programIds.add(String(r.program_id).trim());
      });
      const groupRes = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
        args: [contact.group_name],
      });
      groupRes.rows.forEach((r) => {
        if (r.id != null) programIds.add(String(r.id).trim());
      });
    }
    // Path 4: participant_programs junction table
    try {
      const ppRes = await db.execute({
        sql: "SELECT program_id FROM participant_programs WHERE participant_id = ?",
        args: [cid],
      });
      ppRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
    } catch (_) {}
    // Path 5: v2_participants (direct participant enrollments)
    try {
      const vpRes = await db.execute({
        sql: "SELECT program_id FROM v2_participants WHERE email = ?",
        args: [email],
      });
      vpRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
    } catch (_) {}

    const programIdList = Array.from(programIds);
    const programsData = [];

    for (const pid of programIdList) {
      const [progRes, sesRes, delRes, subRes, attRes, kpiRes] =
        await Promise.all([
          db.execute({
            sql: "SELECT * FROM v2_programs WHERE id = ?",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_sessions WHERE program_id = ? ORDER BY week_number ASC, start_at ASC",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_submissions WHERE participant_id = ? AND program_id = ?",
            args: [cid, pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_attendance WHERE participant_id = ? AND program_id = ?",
            args: [cid, pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
            args: [pid],
          }),
        ]);

      const program = progRes.rows[0];
      if (!program) continue;

      const sessions = sesRes.rows || [];
      const submissions = subRes.rows || [];
      const deliverables = delRes.rows || [];
      const attendance = attRes.rows || [];
      const kpis = kpiRes.rows || [];

      // ─── Determine unlocked sessions based on scheduled_date ───
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const unlockedSessions = sessions.filter((s) => {
        if (!s.scheduled_date) return true;
        const sched = new Date(s.scheduled_date);
        sched.setHours(0, 0, 0, 0);
        return sched <= today;
      });

      const unlockedSessionWeekNumbers = new Set(
        unlockedSessions.map((s) => s.week_number || 1),
      );
      const unlockedDeliverables = deliverables.filter((d) => {
        const wn = d.session_id
          ? sessions.find((s) => s.id === d.session_id)?.week_number || 1
          : d.week_number || 1;
        return unlockedSessionWeekNumbers.has(wn);
      });

      const currentWeek =
        unlockedSessions.length > 0
          ? Math.max(...unlockedSessions.map((s) => s.week_number || 1))
          : 1;

      const totalDeliverables = unlockedDeliverables.length || 1;
      const completedDeliverables = unlockedDeliverables.filter((d) => {
        const sub = submissions.find((s) => s.document_id === d.id);
        return sub && sub.status === "approved";
      }).length;
      const programCompletion = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      const totalSessions = unlockedSessions.length || 1;
      const attendedSessions = attendance.filter(
        (a) => a.status === "present",
      ).length;
      const attendanceRate = Math.round(
        (attendedSessions / totalSessions) * 100,
      );

      const totalAssignments = submissions.length || 1;
      const approvedAssignments = submissions.filter(
        (s) => s.status === "approved",
      ).length;
      const assignmentCompletion = Math.round(
        (approvedAssignments / totalAssignments) * 100,
      );

      const totalKpis = kpis.length || 1;
      const targetMetKpis = kpis.filter((k) => {
        const target = parseInt(k.target_value) || 0;
        const current = parseInt(k.current_value) || 0;
        return current >= target;
      }).length;
      const kpiCompletion = Math.round((targetMetKpis / totalKpis) * 100);

      programsData.push({
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: program.start_date,
        endDate: program.end_date,
        durationWeeks: program.duration_weeks,
        currentWeek,
        cohort: contact.group_name || "Cohort 1",
        metrics: {
          programCompletion,
          attendanceRate,
          assignmentCompletion,
          kpiCompletion,
        },
        sessions,
        deliverables,
        submissions,
        attendance,
      });
    }

    const primaryProgram = programsData[0] || null;
    const primarySubmissions = primaryProgram ? primaryProgram.submissions : [];
    const pendingSubmissions = primarySubmissions.filter(
      (s) => s.status === "pending",
    );

    let overdueItems = [];
    let dueSoonItems = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (primaryProgram) {
      for (const d of primaryProgram.deliverables) {
        if (!d.created_at) continue;
        const dueDate = new Date(d.created_at);
        dueDate.setHours(0, 0, 0, 0);
        const existingSub = primaryProgram.submissions.find(
          (s) => s.document_id === d.id,
        );
        const isApproved = existingSub?.status === "approved";
        if (!isApproved && dueDate < today) {
          overdueItems.push({
            id: d.id,
            title: d.title,
            type: "deliverable",
            dueDate: d.created_at,
            daysOverdue: Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)),
            programId: primaryProgram.id,
            programName: primaryProgram.name,
          });
        } else if (!isApproved && dueDate >= today) {
          const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7)
            dueSoonItems.push({
              id: d.id,
              title: d.title,
              type: "deliverable",
              dueDate: d.created_at,
              daysLeft: diffDays,
              programId: primaryProgram.id,
              programName: primaryProgram.name,
            });
        }
      }
    }

    const upcomingSessions = primaryProgram
      ? primaryProgram.sessions
          .filter((s) => {
            if (!s.start_at && !s.scheduled_date) return false;
            return new Date(s.start_at || s.scheduled_date) >= today;
          })
          .slice(0, 5)
      : [];

    const notifRes = await db.execute({
      sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? OR recipient_id = 'all' OR recipient_id = ? ORDER BY created_at DESC LIMIT 10",
      args: [cid, email],
    });
    const announcements = (notifRes.rows || []).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type || "announcement",
      isRead: n.is_read,
      createdAt: n.created_at,
    }));

    // ─── Build calendar events from ALL enrolled programs ───
    let calendarEvents = [];
    const seenEventKeys = new Set();

    for (const prog of programsData) {
      for (const s of prog.sessions || []) {
        const sessionDate = s.start_at || s.scheduled_date;
        if (!sessionDate) continue;
        const d = new Date(sessionDate);
        const dateStr = d.toISOString().split("T")[0];
        const key = `session-${s.id}`;
        if (seenEventKeys.has(key)) continue;
        seenEventKeys.add(key);
        calendarEvents.push({
          id: key,
          title: s.title,
          date: dateStr,
          time: s.start_time || null,
          type: "session",
          source: "v2_sessions",
          relatedId: s.id,
          programId: prog.id,
          description: prog.name,
        });
      }
      for (const d of prog.deliverables || []) {
        if (!d.created_at) continue;
        const dd = new Date(d.created_at);
        const dateStr = dd.toISOString().split("T")[0];
        const key = `deliverable-${d.id}`;
        if (seenEventKeys.has(key)) continue;
        seenEventKeys.add(key);
        calendarEvents.push({
          id: key,
          title: `${d.title} (due)`,
          date: dateStr,
          time: null,
          type: "deadline",
          source: "v2_document_requirements",
          relatedId: d.id,
          programId: prog.id,
          description: prog.name,
        });
      }
    }
    calendarEvents.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      participant: {
        cid: contact.cid,
        name: contact.name,
        email: contact.email,
        groupName: contact.group_name,
      },
      primaryProgram: primaryProgram
        ? {
            id: primaryProgram.id,
            name: primaryProgram.name,
            description: primaryProgram.description,
            status: primaryProgram.status,
            startDate: primaryProgram.startDate,
            endDate: primaryProgram.endDate,
            durationWeeks: primaryProgram.durationWeeks,
            currentWeek: primaryProgram.currentWeek,
            cohort: primaryProgram.cohort,
            metrics: primaryProgram.metrics,
            sessionCount: primaryProgram.sessions.length,
            deliverableCount: primaryProgram.deliverables.length,
          }
        : null,
      programs: programsData.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        currentWeek: p.currentWeek,
        durationWeeks: p.durationWeeks,
        cohort: p.cohort,
        metrics: p.metrics,
      })),
      actionCenter: {
        overdue: overdueItems,
        dueSoon: dueSoonItems,
        pendingSubmissions: pendingSubmissions.map((s) => ({
          id: s.id,
          deliverableId: s.document_id,
          status: s.status,
          submittedAt: s.created_at,
          programId: s.program_id,
        })),
        upcomingSessions: upcomingSessions.map((s) => ({
          id: s.id,
          title: s.title,
          type: s.type,
          date: s.start_at || s.scheduled_date,
          time: s.start_time,
          weekNumber: s.week_number,
          programId: s.program_id,
        })),
      },
      calendarEvents,
      announcements,
    });
  } catch (error) {
    console.error("Participant Home API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
