import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getHomeContactByCid } from "@/models/participantPortal";
import { buildParticipantHome } from "@/services/participant";

export const dynamic = "force-dynamic";

export async function GET(_req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const email = session.email;

    const contactRes = await getHomeContactByCid(cid);
    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }

    // Every rule and read of the dashboard lives in the participant service
    // (src/services/participant/home.js); this handler only authenticates,
    // reads the contact and shapes the response.
    const { programsData, primaryProgram, actionCenter, calendarEvents, announcements } =
      await buildParticipantHome({ cid, email, contact: contactRes.rows[0] });

    return NextResponse.json({
      success: true,
      participant: {
        cid: contactRes.rows[0].cid,
        name: contactRes.rows[0].name,
        email: contactRes.rows[0].email,
        groupName: contactRes.rows[0].group_name,
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
      programs: programsData.map((program) => ({
        id: program.id,
        name: program.name,
        status: program.status,
        startDate: program.startDate,
        endDate: program.endDate,
        currentWeek: program.currentWeek,
        durationWeeks: program.durationWeeks,
        cohort: program.cohort,
        metrics: program.metrics,
      })),
      actionCenter: {
        overdue: actionCenter.overdue,
        dueSoon: actionCenter.dueSoon,
        pendingSubmissions: actionCenter.pendingSubmissions.map((submission) => ({
          id: submission.id,
          deliverableId: submission.document_id,
          status: submission.status,
          submittedAt: submission.created_at,
          programId: submission.program_id,
        })),
        upcomingSessions: actionCenter.upcomingSessions.map((session) => ({
          id: session.id,
          title: session.title,
          type: session.type,
          date: session.start_at || session.scheduled_date,
          time: session.start_time,
          weekNumber: session.week_number,
          programId: session.program_id,
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
