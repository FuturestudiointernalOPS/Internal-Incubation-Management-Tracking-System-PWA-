/**
 * Member dashboard — the ONE personal dashboard's assembly (SERVICE layer).
 *
 * `/dashboard` is the same page for every member. What differs is which blocks
 * exist, and that is decided HERE, from the relationships the person actually
 * holds — never from a role label, and never by hiding data the caller already
 * sent.
 *
 * The rule this module exists to enforce:
 *
 *   a block is built only when its relationship is TRUE, and every read that
 *   feeds it is scoped by the person's own ids.
 *
 * So a person with no program seat receives no program section at all (not an
 * empty one), no program progress is read for them, and the response cannot be
 * mistaken for "program data that the screen chose not to draw".
 *
 * Every statement lives in the repository layer (`@/models/**` and the domain
 * services that own each read). Decisions here, no SQL, no HTTP.
 */

import { resolveParticipantParticipation } from "@/services/participant/participation";
import { buildParticipantHome } from "@/services/participant/home";
import { buildParticipantProgress } from "@/services/participant/progress";
import { learnerHasEnrollments, getLearnerCourses } from "@/services/lms/learning";
import { buildInvestorDashboardSummary } from "@/services/investor/dashboard";
import { getVentureMembershipsForContact } from "@/models/contacts/programMembership";
import { getApprovedInvestorProfileIdByUserId } from "@/models/investor";
import { isFounderMembership } from "@/models/platform/roles";
import {
  listFacilitatedPrograms,
  listUpcomingSessionsForPrograms,
} from "@/models/memberDashboard";

/** A read of one block may fail without taking the whole page down. */
async function safe(read, fallback) {
  try {
    return await read();
  } catch (_) {
    return fallback;
  }
}

const EMPTY_PARTICIPATION = { memberships: [], isProgramParticipant: false };
const EMPTY_ROWS = { rows: [] };
const EMPTY_ACTION_CENTER = {
  overdue: [],
  dueSoon: [],
  pendingSubmissions: [],
  upcomingSessions: [],
};

/** One attended program, as the dashboard lists it. */
function programSeat(seat) {
  return {
    id: String(seat.program_id),
    name: seat.program_name || seat.program_id,
    status: seat.status || "active",
    completed: seat.completed === true,
    readOnly: seat.readOnly === true,
  };
}

/** The learning block's courses, trimmed to what the dashboard draws. */
function learningCourse(entry) {
  const course = entry.course || {};
  const progress = entry.progress || {};
  return {
    id: String(course.id),
    title: course.title || course.name || "",
    completedLessons: Number(progress.completedLessons || 0),
    totalLessons: Number(progress.totalLessons || 0),
    percent: Number(progress.percent || 0),
    complete: progress.complete === true,
    continueLessonId: entry.continueLesson?.id ?? null,
    certificateIssued: Boolean(entry.certificate),
  };
}

/**
 * Assemble the dashboard envelope for one person.
 *
 * Wave 1 answers "what is this person, here?". Wave 2 builds only the blocks
 * those answers open. A failed read contributes its empty value: one broken
 * source must never blank the whole page.
 *
 * @param {{session: Object, contact: Object}} input
 */
export async function buildMemberDashboard({ session, contact }) {
  const cid = session?.cid;
  const email = session?.email || contact?.email || "";

  const [
    participation,
    venturesResult,
    investorResult,
    enrolled,
    facilitatedResult,
  ] = await Promise.all([
    safe(
      () => resolveParticipantParticipation({ cid, email }),
      EMPTY_PARTICIPATION,
    ),
    safe(() => getVentureMembershipsForContact(cid), EMPTY_ROWS),
    safe(() => getApprovedInvestorProfileIdByUserId(cid), EMPTY_ROWS),
    safe(() => learnerHasEnrollments(cid), false),
    safe(() => listFacilitatedPrograms(cid, email), EMPTY_ROWS),
  ]);

  const seats = participation.memberships || [];
  const ventures = venturesResult.rows || [];
  const facilitated = facilitatedResult.rows || [];

  const profiles = {
    isProgramParticipant: seats.length > 0,
    isFacilitator: facilitated.length > 0,
    isVentureMember: ventures.length > 0,
    isFounder: ventures.some(isFounderMembership),
    isLearner: enrolled === true,
    isInvestor: (investorResult.rows || []).length > 0,
  };

  // ── Wave 2 — only what the person actually holds ─────────────────────────
  //
  // The participant home is read for everyone: it also carries the personal
  // announcements and the Venture sessions, which belong to no program. Its
  // PROGRAM content (progress, action centre, program sessions) is only exposed
  // when a program seat exists.
  const [home, progress, courses, investor, facilitatorSessions] =
    await Promise.all([
      safe(() => buildParticipantHome({ cid, email, contact }), null),
      profiles.isProgramParticipant
        ? safe(() => buildParticipantProgress({ cid, email, contact }), null)
        : Promise.resolve(null),
      profiles.isLearner
        ? safe(() => getLearnerCourses(cid), [])
        : Promise.resolve([]),
      profiles.isInvestor
        ? safe(() => buildInvestorDashboardSummary({ session }), null)
        : Promise.resolve(null),
      profiles.isFacilitator
        ? safe(
            () =>
              listUpcomingSessionsForPrograms(
                facilitated.map((program) => program.id),
              ),
            EMPTY_ROWS,
          )
        : Promise.resolve(EMPTY_ROWS),
    ]);

  const actionCenter = home?.actionCenter || EMPTY_ACTION_CENTER;
  const agenda = home?.calendarEvents || [];

  const programs =
    profiles.isProgramParticipant && home && home.programsData.length > 0
      ? {
          seats: seats.map(programSeat),
          primary: home.primaryProgram
            ? {
                id: String(home.primaryProgram.id),
                name: home.primaryProgram.name,
                status: home.primaryProgram.status,
                currentWeek: home.primaryProgram.currentWeek,
                durationWeeks: home.primaryProgram.durationWeeks,
              }
            : null,
          progress: progress
            ? { overall: progress.overall || null, totals: progress.totals || null }
            : null,
          actionCenter: {
            overdue: actionCenter.overdue || [],
            dueSoon: actionCenter.dueSoon || [],
            pendingSubmissions: actionCenter.pendingSubmissions || [],
            upcomingSessions: actionCenter.upcomingSessions || [],
          },
        }
      : null;

  const facilitator = profiles.isFacilitator
    ? {
        programs: facilitated.map((program) => ({
          id: String(program.id),
          name: program.name || String(program.id),
          status: program.status || "active",
        })),
        upcoming: (facilitatorSessions.rows || []).map((sessionRow) => ({
          id: String(sessionRow.id),
          title: sessionRow.title || "",
          date: sessionRow.date || null,
          time: sessionRow.start_time || null,
          programId: String(sessionRow.program_id || ""),
          programName: sessionRow.program_name || "",
        })),
      }
    : null;

  const venturesBlock = profiles.isVentureMember
    ? {
        isFounder: profiles.isFounder,
        items: ventures.map((membership) => ({
          id: String(membership.venture_id),
          name: membership.name || membership.venture_id,
          status: membership.status || "active",
          memberType: membership.member_type || null,
          isOwner:
            membership.is_owner === true || Number(membership.is_owner) === 1,
        })),
      }
    : null;

  const learning =
    profiles.isLearner && courses.length > 0
      ? { courses: courses.map(learningCourse) }
      : null;

  return {
    identity: {
      cid,
      name: contact?.name || session?.name || null,
      email,
      groupName: contact?.group_name || null,
      role: session?.role || null,
    },
    profiles,
    // Announcements are addressed to the person (or to everyone), never to a
    // program, so they are personal and always shown.
    announcements: home?.announcements || [],
    agenda,
    programs,
    facilitator,
    ventures: venturesBlock,
    learning,
    investor,
  };
}
