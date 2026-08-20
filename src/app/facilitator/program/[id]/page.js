"use client";

import React, { useState, useEffect, use } from "react";
import {
  ChevronLeft,
  Users,
  CalendarCheck,
  ClipboardList,
  Send,
  CheckCircle2,
  Loader2,
  LayoutDashboard,
  BookOpen,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { getLocalToday } from "@/lib/constants";

export const dynamic = "force-dynamic";

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
  const [program, setProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [attendanceDate, setAttendanceDate] = useState(() => getLocalToday());
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState({
    participant_progress: "",
    attendance_concerns: "",
    assignment_performance: "",
    challenges: "",
    participants_needing_intervention: "",
    completed_work: "",
    needs_attention: "",
    recommendations: "",
  });
  const [savingReview, setSavingReview] = useState(false);
  const [savingAtt, setSavingAtt] = useState(false);
  const [myReviews, setMyReviews] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const progRes = await fetch(`/api/pm/full-state?id=${id}&t=${Date.now()}`);
      const progData = await progRes.json();
      if (progData.success) {
        setProgram(progData.program);
        setSessions(progData.sessions || []);
      }

      const parRes = await fetch(`/api/participants?program_id=${id}`);
      const parData = await parRes.json();
      if (parData.success) setParticipants(parData.participants || []);

      const subRes = await fetch(
        `/api/submissions?program_id=${id}`,
      );
      const subData = await subRes.json();
      if (subData.success) setSubmissions(subData.submissions || []);

      const revRes = await fetch(`/api/facilitator-reviews?program_id=${id}`);
      const revData = await revRes.json();
      if (revData.success) setMyReviews(revData.reviews || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const notify = (type, message) =>
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message } }),
    );

  const submitReview = async () => {
    setSavingReview(true);
    try {
      const res = await fetch("/api/facilitator-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: id, ...review }),
      });
      const data = await res.json();
      if (data.success) {
        notify("success", "Review submitted to Program Manager");
        setReview({
          participant_progress: "",
          attendance_concerns: "",
          assignment_performance: "",
          challenges: "",
          participants_needing_intervention: "",
          completed_work: "",
          needs_attention: "",
          recommendations: "",
        });
        load();
      } else {
        notify("error", data.error || "Failed to submit");
      }
    } catch (e) {
      notify("error", "Failed to submit");
    } finally {
      setSavingReview(false);
    }
  };

  const saveAttendance = async (sessionId) => {
    setSavingAtt(true);
    try {
      const records = participants
        .map((p) => ({
          session_id: sessionId,
          program_id: id,
          participant_id: p.id || p.user_id,
          status: attendance[`${sessionId}:${p.id || p.user_id}`] || "",
          date: attendanceDate,
        }))
        .filter((r) => r.participant_id);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      if ((await res.json()).success) {
        notify("success", "Attendance recorded");
      }
    } catch (e) {
      notify("error", "Failed to record attendance");
    } finally {
      setSavingAtt(false);
    }
  };

  const saveAttendanceForParticipant = async (sessionId, participantId, status) => {
    if (!status) return;
    try {
      const res = await fetch("/api/attendance", {
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
      if (!(await res.json()).success) {
        notify("error", "Failed to record attendance");
      }
    } catch (e) {
      notify("error", "Failed to record attendance");
    }
  };

  const reviewSubmission = async (subId, status, feedback) => {
    const body = { id: subId, status, feedback: feedback || null };
    if (status === "rejected") {
      body.rejection_reason = feedback || "Rejected";
    }
    try {
      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify("success", "Submission updated");
        load();
      } else {
        notify("error", data.error || "Failed to update submission");
      }
    } catch (e) {
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

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "curriculum", label: "Curriculum", icon: BookOpen },
    { key: "participants", label: "Participants", icon: Users },
    { key: "attendance", label: "Attendance", icon: CalendarCheck },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
    { key: "review", label: "My Review", icon: Send },
  ];

  return (
    <DashboardLayout role="facilitator" activeTab="dashboard">
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <header>
          <a
            href="/facilitator"
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> My programs
          </a>
          <h1 className="text-xl font-black uppercase tracking-tight">
            {program?.name || "Program"}
          </h1>
          <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1">
            You only see data within your assigned scope.
          </p>
        </header>

        <div className="flex gap-2 flex-wrap">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                tab === tb.key
                  ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
              }`}
            >
              <tb.icon className="w-3.5 h-3.5" />
              {tb.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW (read-only) */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4">
                <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">
                  Participants
                </p>
                <p className="text-2xl font-black">{participants.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4">
                <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">
                  Sessions
                </p>
                <p className="text-2xl font-black">{sessions.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4">
                <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">
                  Duration
                </p>
                <p className="text-2xl font-black">
                  {program?.duration_weeks || "\u2014"} wks
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5 space-y-3">
              <div>
                <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">
                  Description
                </p>
                <p className="text-sm">{program?.description || "\u2014"}</p>
              </div>
              {program?.outcomes && (
                <div>
                  <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">
                    Outcomes
                  </p>
                  <p className="text-sm">{program.outcomes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CURRICULUM (read-only) */}
        {tab === "curriculum" && (
          <div className="space-y-3">
            {sessions.length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-8 text-center">
                No sessions scheduled yet.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border-primary)] bg-secondary"
              >
                <div>
                  <p className="text-[11px] font-black uppercase">{s.title}</p>
                  <p className="text-[9px] text-[var(--text-secondary)]">
                    Week {s.week_number} \u00b7 {s.type}
                  </p>
                </div>
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                  {s.status || "scheduled"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* PARTICIPANTS */}
        {tab === "participants" && (
          <div className="space-y-3">
            {participants.length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-8 text-center">
                No participants in your assigned scope.
              </p>
            )}
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border-primary)] bg-secondary"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase truncate">
                    {p.name}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] truncate">
                    {p.email}
                  </p>
                </div>
                <span
                  className={`text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                    p.status === "active"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {p.status || "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ATTENDANCE */}
        {tab === "attendance" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-primary p-3">
              <CalendarCheck className="w-4 h-4 text-[var(--text-secondary)]" />
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Date
                </p>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  max={getLocalToday()}
                  min={getLocalToday()}
                  className="w-full bg-transparent text-sm font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
            </div>
            {sessions.length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-8 text-center">
                No sessions scheduled yet.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black uppercase">
                      {s.title}
                    </p>
                    <p className="text-[9px] text-[var(--text-secondary)]">
                      Week {s.week_number} · {s.type}
                    </p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {participants.map((p) => {
                    const key = `${s.id}:${p.id || p.user_id}`;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[var(--border-primary)] bg-primary"
                      >
                        <span className="text-[9px] font-bold uppercase truncate">
                          {p.name}
                        </span>
                        <select
                          value={attendance[key] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAttendance({ ...attendance, [key]: v });
                            saveAttendanceForParticipant(s.id, p.id || p.user_id, v);
                          }}
                          className="bg-secondary border border-[var(--border-primary)] rounded px-1.5 py-1 text-[8px] font-bold uppercase outline-none cursor-pointer"
                        >
                          <option value="">{t("pmMisc.workspace.attendanceSelect")}</option>
                          <option value="present">{t("pmMisc.workspace.attendancePresent")}</option>
                          <option value="absent">{t("pmMisc.workspace.attendanceAbsent")}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
                <button
                  disabled={savingAtt}
                  onClick={() => saveAttendance(s.id)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Save attendance
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ASSIGNMENTS */}
        {tab === "assignments" && (
          <div className="space-y-3">
            {submissions.length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-8 text-center">
                No submissions in your scope yet.
              </p>
            )}
            {submissions.map((s) => (
              <SubmissionRow key={s.id} sub={s} onReview={reviewSubmission} />
            ))}
          </div>
        )}

        {/* REVIEW */}
        {tab === "review" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5 space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                Submit Facilitator Review — goes to your Program Manager
              </h2>
              <ReviewField
                label="Participant progress"
                value={review.participant_progress}
                onChange={(v) =>
                  setReview({ ...review, participant_progress: v })
                }
              />
              <ReviewField
                label="Attendance concerns"
                value={review.attendance_concerns}
                onChange={(v) =>
                  setReview({ ...review, attendance_concerns: v })
                }
              />
              <ReviewField
                label="Assignment performance"
                value={review.assignment_performance}
                onChange={(v) =>
                  setReview({ ...review, assignment_performance: v })
                }
              />
              <ReviewField
                label="Challenges"
                value={review.challenges}
                onChange={(v) => setReview({ ...review, challenges: v })}
              />
              <ReviewField
                label="Participants requiring intervention"
                value={review.participants_needing_intervention}
                onChange={(v) =>
                  setReview({
                    ...review,
                    participants_needing_intervention: v,
                  })
                }
              />
              <ReviewField
                label="What was completed"
                value={review.completed_work}
                onChange={(v) => setReview({ ...review, completed_work: v })}
              />
              <ReviewField
                label="What needs attention"
                value={review.needs_attention}
                onChange={(v) => setReview({ ...review, needs_attention: v })}
              />
              <ReviewField
                label="Recommendations"
                value={review.recommendations}
                onChange={(v) =>
                  setReview({ ...review, recommendations: v })
                }
              />
              <button
                disabled={savingReview}
                onClick={submitReview}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {savingReview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Submit Review
              </button>
            </div>

            {myReviews.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  My Previous Reviews
                </h2>
                {myReviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-[var(--text-secondary)]">
                        Submitted {new Date(r.created_at).toLocaleDateString()}
                      </span>
                      <span
                        className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                          r.status === "decided"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.participant_progress && (
                      <p className="text-[9px] text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-primary)]">
                          Progress:
                        </strong>{" "}
                        {r.participant_progress}
                      </p>
                    )}
                    {r.pm_decision && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">
                          PM Decision
                        </p>
                        <p className="text-[9px] text-[var(--text-primary)]">
                          {r.pm_decision}
                        </p>
                        {r.pm_decision_note && (
                          <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                            {r.pm_decision_note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ReviewField({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Optional…"
        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
      />
    </div>
  );
}

function SubmissionRow({ sub, onReview }) {
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase truncate">
            {sub.participant_name || "Participant"}
          </p>
          <p className="text-[9px] text-[var(--text-secondary)] truncate">
            {sub.deliverable_title || "Deliverable"}
          </p>
        </div>
        <span
          className={`text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${
            sub.status === "approved"
              ? "bg-emerald-500/15 text-emerald-400"
              : sub.status === "revision_requested"
                ? "bg-amber-500/15 text-amber-400"
                : sub.status === "rejected"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-slate-500/15 text-[var(--text-secondary)]"
          }`}
        >
          {sub.status}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 pt-2">
          {sub.file_url && (
            <a
              href={sub.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] font-black uppercase text-blue-400 hover:underline"
            >
              View submission ↗
            </a>
          )}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Feedback…"
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onReview(sub.id, "approved", feedback)}
              className="text-[8px] font-black uppercase px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            >
              Approve
            </button>
            <button
              onClick={() => onReview(sub.id, "revision_requested", feedback)}
              className="text-[8px] font-black uppercase px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
            >
              Request revision
            </button>
            <button
              onClick={() => onReview(sub.id, "rejected", feedback)}
              className="text-[8px] font-black uppercase px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
