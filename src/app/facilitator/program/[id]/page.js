"use client";

import { useState, use, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { getLocalToday } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";
import ProgramHeader from "@/components/facilitator/program-detail/ProgramHeader";
import ProgramTabs from "@/components/facilitator/program-detail/ProgramTabs";
import OverviewTab from "@/components/facilitator/program-detail/OverviewTab";
import CurriculumTab from "@/components/facilitator/program-detail/CurriculumTab";
import ParticipantsTab from "@/components/facilitator/program-detail/ParticipantsTab";
import AttendanceTab from "@/components/facilitator/program-detail/AttendanceTab";
import AssignmentsTab from "@/components/facilitator/program-detail/AssignmentsTab";
import ReviewTab from "@/components/facilitator/program-detail/ReviewTab";

export const dynamic = "force-dynamic";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_OBJECT = {};
const EMPTY_LIST = [];

const pickFullState = (response) => (response?.success ? response : null);
const pickList = (listKey) => (response) => (response?.success ? response[listKey] || [] : []);

// Called once, here: `pickList` is a factory, so calling it at the call site would
// hand the read a new identity on every render and re-issue its request.
const pickParticipants = pickList("participants");
const pickSubmissions = pickList("submissions");
const pickReviews = pickList("reviews");

/** Saved attendance, keyed the way the sheet addresses it. */
const pickAttendance = (response) => {
  const bySessionAndParticipant = {};
  if (!response?.success) return bySessionAndParticipant;
  for (const record of response.attendance || []) {
    bySessionAndParticipant[`${record.session_id}:${record.participant_id}`] = record.status;
  }
  return bySessionAndParticipant;
};

/**
 * Which week of the programme a day falls in. The day is a parameter rather than
 * read from the clock in here: called during a render, reading the clock is what
 * makes a value differ between the server's render and the browser's.
 */
const programWeekOn = (program, day) => {
  if (!program?.start_date) return 1;
  const start = new Date(String(program.start_date).slice(0, 10) + "T00:00:00");
  const today = new Date(day + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) return 1;
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 1;
  const max = Number(program.duration_weeks) || 13;
  return Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), max);
};

/**
 * FACILITATOR PROGRAM WORKSPACE
 * Participants (server-scoped), session attendance, assignment reviews,
 * and the weekly Facilitator Review submitted to the Program Manager.
 */

export default function FacilitatorProgram({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const { t } = useI18n();

  const [tab, setTab] = useState("participants");
  const [attendanceDate, setAttendanceDate] = useState(() => getLocalToday());

  // The five reads, through the shared hook: it owns the cache, the cache-first
  // paint and the discarding of a stale answer, so the page keeps no copy of its
  // own and reads its data during render.
  const {
    data: fullState,
    loading: fullStateLoading,
    refresh: refreshFullState,
  } = useApi(id ? `/api/pm/full-state?id=${id}` : null, {
    defaultValue: null,
    transform: pickFullState,
    deps: [id],
  });
  const program = fullState?.program || null;
  const sessions = fullState?.sessions ?? EMPTY_LIST;

  const {
    data: participants,
    loading: participantsLoading,
    refresh: refreshParticipants,
  } = useApi(id ? `/api/participants?program_id=${id}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickParticipants,
    deps: [id],
  });
  const {
    data: submissions,
    loading: submissionsLoading,
    refresh: refreshSubmissions,
  } = useApi(id ? `/api/submissions?program_id=${id}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickSubmissions,
    deps: [id],
  });
  const {
    data: myReviews,
    loading: reviewsLoading,
    refresh: refreshReviews,
  } = useApi(id ? `/api/facilitator-reviews?program_id=${id}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickReviews,
    deps: [id],
  });
  const {
    data: storedAttendance,
    loading: attendanceLoading,
    refresh: refreshAttendance,
  } = useApi(
    id ? `/api/attendance?program_id=${id}&date=${attendanceDate}` : null,
    { defaultValue: EMPTY_OBJECT, transform: pickAttendance, deps: [id, attendanceDate] },
  );

  const loading =
    fullStateLoading ||
    participantsLoading ||
    submissionsLoading ||
    reviewsLoading ||
    attendanceLoading;

  // Every action below re-reads what it changed.
  const reload = useCallback(() => {
    refreshFullState();
    refreshParticipants();
    refreshSubmissions();
    refreshReviews();
    refreshAttendance();
  }, [
    refreshFullState,
    refreshParticipants,
    refreshSubmissions,
    refreshReviews,
    refreshAttendance,
  ]);

  // ── Forms: a derived base, plus what the person changed ───────────────────

  // The week being reviewed defaults to the week the programme is in, and the
  // person can choose another. Recorded as a CHOICE rather than copied, so a
  // background refresh no longer throws the choice away - which it did, by
  // reassigning the computed week on every load.
  const [chosenWeek, setChosenWeek] = useState(null);
  // The clock is snapshotted once, for the reason programWeekOn explains.
  const [today] = useState(() => getLocalToday());
  const reviewWeek = chosenWeek ?? programWeekOn(program, today);

  // The sheet's marks are the saved ones plus the person's, and a mark is
  // recorded WITH the date it was made on. The saved marks are addressed by the
  // date in the request, so a mark that outlived a date change would show on a
  // day it does not belong to.
  const [marks, setMarks] = useState({ date: null, byKey: EMPTY_OBJECT });
  const marksForDate = marks.date === attendanceDate ? marks.byKey : EMPTY_OBJECT;
  const attendance = { ...storedAttendance, ...marksForDate };
  const setMark = (key, value) =>
    setMarks({ date: attendanceDate, byKey: { ...marksForDate, [key]: value } });

  const [review, setReview] = useState({
    overall_rating: "",
    went_well: "",
    struggles: "",
    engagement: "",
    needs_attention_type: "",
    needs_attention_note: "",
    focus_next_week: "",
    additional_notes: "",
  });
  const [savingReview, setSavingReview] = useState(false);
  const [savingAtt, setSavingAtt] = useState(false);


  const notify = (type, message) =>
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message } }),
    );

  const submitReview = async () => {
    if (!review.overall_rating) {
      notify("error", t("pmMisc.facilitators.weeklyReview.ratingRequired"));
      return;
    }
    setSavingReview(true);
    try {
      const response = await fetch("/api/facilitator-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: id, week_number: reviewWeek, ...review }),
      });
      const data = await response.json();
      if (data.success) {
        notify("success", t("pmMisc.facilitators.weeklyReview.submitSuccess"));
        setReview({
          overall_rating: "",
          went_well: "",
          struggles: "",
          engagement: "",
          needs_attention_type: "",
          needs_attention_note: "",
          focus_next_week: "",
          additional_notes: "",
        });
        reload();
      } else {
        notify("error", data.error || t("pmMisc.facilitators.weeklyReview.submitError"));
      }
    } catch {
      notify("error", t("pmMisc.facilitators.weeklyReview.submitError"));
    } finally {
      setSavingReview(false);
    }
  };

  const saveAttendance = async (sessionId) => {
    setSavingAtt(true);
    try {
      // Send only participants that have a real decision (present/absent).
      // Clearing a mark is handled per-participant on select change, so this
      // bulk save can never wipe marks it did not explicitly set — e.g. marks
      // the PM recorded for this team.
      const records = participants
        .map((participant) => ({
          session_id: sessionId,
          program_id: id,
          participant_id: participant.id || participant.user_id,
          status: attendance[`${sessionId}:${participant.id || participant.user_id}`] || "",
          date: attendanceDate,
        }))
        .filter((record) => record.participant_id && record.status);
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      if ((await response.json()).success) {
        notify("success", "Attendance recorded");
      }
    } catch {
      notify("error", "Failed to record attendance");
    } finally {
      setSavingAtt(false);
    }
  };

  const saveAttendanceForParticipant = async (sessionId, participantId, status) => {
    // Always send the record, even with an empty status: empty means the
    // facilitator explicitly cleared this participant's mark for the session.
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            session_id: sessionId,
            program_id: id,
            participant_id: participantId,
            status,
            date: attendanceDate,
          },
        ]),
      });
      const data = await response.json();
      if (!data.success) {
        notify("error", data.error || "Failed to record attendance");
      }
    } catch {
      notify("error", "Failed to record attendance");
    }
  };

  const reviewSubmission = async (subId, status, feedback) => {
    const body = { id: subId, status, feedback: feedback || null };
    if (status === "rejected") {
      body.rejection_reason = feedback || "Rejected";
    }
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify("success", "Submission updated");
        reload();
      } else {
        notify("error", data.error || "Failed to update submission");
      }
    } catch {
      notify("error", "Failed to update submission");
    }
  };

  if (loading && !program) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <ProgramHeader program={program} />

        <ProgramTabs tab={tab} onTabChange={setTab} />

        {tab === "overview" && (
          <OverviewTab
            program={program}
            participantCount={participants.length}
            sessionCount={sessions.length}
          />
        )}

        {tab === "curriculum" && <CurriculumTab sessions={sessions} />}

        {tab === "participants" && <ParticipantsTab participants={participants} />}

        {tab === "attendance" && (
          <AttendanceTab
            sessions={sessions}
            participants={participants}
            attendanceDate={attendanceDate}
            onDateChange={setAttendanceDate}
            attendance={attendance}
            onMark={setMark}
            onSaveSession={saveAttendance}
            onSaveParticipant={saveAttendanceForParticipant}
            savingAtt={savingAtt}
          />
        )}

        {tab === "assignments" && (
          <AssignmentsTab submissions={submissions} onReview={reviewSubmission} />
        )}

        {tab === "review" && (
          <ReviewTab
            review={review}
            onReviewChange={setReview}
            reviewWeek={reviewWeek}
            onWeekChange={setChosenWeek}
            onSubmit={submitReview}
            savingReview={savingReview}
            myReviews={myReviews}
          />
        )}
      </div>
    </>
  );
}
