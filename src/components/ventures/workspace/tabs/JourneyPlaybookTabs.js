"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  stageStatusWord,
  milestoneStatusWord,
  statusWord,
  statusLabel,
  statusChipClass,
  statusDotClass,
} from "@/lib/ventureStatuses";
import {
  minSessionStartInput,
  isValidSessionStart,
  toDateInput,
  toTimeInput,
} from "@/lib/ventureSessionRules";
import { useVenture } from "../VentureContext";
import { useDialogs } from "@/components/ui/DialogProvider";
import { sessionBookingKey } from "@/components/ventures/journey/journeyShapers";
import FounderMilestoneSessions from "@/components/ventures/journey/FounderMilestoneSessions";
import FounderMilestoneTasks from "@/components/ventures/journey/FounderMilestoneTasks";
import { dateOnly } from "@/lib/ventureMilestoneDates";
import AppModal from "@/components/ui/AppModal";
import FounderMilestoneDeliverables from "./JourneyPlaybookTabs/FounderMilestoneDeliverables";

// The kit tag for a status word (the same tones as the Venture Manager view).
const MILESTONE_TAG_TONE = { blocked: "r", in_progress: "b", awaiting_review: "w", changes_requested: "r", completed: "g", approved: "g" };

/* Journey Tab — the Venture journey as its operating workspace.
   Each stage lists the milestones bound to it; each milestone lists its
   tasks. Founders can submit work (document URL + notes) on tasks; staff
   review each submission (approved / changes requested). */
export function JourneyTab() {
  const { t } = useI18n();
  // The booking's own confirmation is a popup: the inline banner at the top of
  // the tab scrolls away long before the person looks up from the form.
  const { alert } = useDialogs();
  const { journeyStages, cardStyle, params, notifyMsg, fetchJourney, journeyDeliverablesUnavailable } = useVenture();
  const [openId, setOpenId] = useState(null);
  // The milestone whose pop-up is open (id only, so it always reads the current row).
  const [openMilestoneId, setOpenMilestoneId] = useState(null);
  const [tasksByMilestone, setTasksByMilestone] = useState({});
  const [subsByTask, setSubsByTask] = useState({});
  const [openTaskId, setOpenTaskId] = useState(null);
  const [drafts, setDrafts] = useState({});
  // Deliverable evidence drafts per deliverable: { url, file }. Submitted by
  // the Venture (upload or link), then reviewed by the Lead Manager / coach.
  const [dvDrafts, setDvDrafts] = useState({});
  // Sessions booked on this Venture, grouped by milestone — the milestone stays
  // the home of its sessions, and each carries the documents it was booked with.
  const [sessionsByMilestone, setSessionsByMilestone] = useState({});
  const [bookFor, setBookFor] = useState(null);
  const [bookForm, setBookForm] = useState({ date: "", time: "", min_time: "", duration: "45", note: "", files: [] });
  const [bookSaving, setBookSaving] = useState(false);
  // The session's ONE note, edited in place (never appended to).
  const [noteEditFor, setNoteEditFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const loadVentureSessions = async () => {
    try {
      const res = await fetch(`/api/ventures/${params.id}/sessions`);
      const payload = await res.json();
      if (!payload.success) return;
      const grouped = {};
      for (const session of payload.sessions || []) {
        if (session.status === "cancelled") continue;
        const key = String(session.milestone_ref || "");
        if (!key) continue;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(session);
      }
      setSessionsByMilestone(grouped);
    } catch (_) {}
  };

  const openBooking = (milestone, activity = null, deliverableId = null) => {
    // One booking slot per ACTIVITY: the control sits in the activity's own
    // block, and the form's title follows it.
    setBookFor(sessionBookingKey(milestone, activity, deliverableId));
    // Same floor as every other booking form: now + 30 minutes, rounded up to a
    // whole minute, so the prefilled slot can never be rejected by the server.
    const min = minSessionStartInput();
    setBookForm({
      date: toDateInput(min), time: toTimeInput(min), min_time: toTimeInput(min), duration: "45",
      title: activity?.title || milestone.title || "",
      activity_id: activity?.id != null ? activity.id : "",
      deliverable_id: deliverableId != null ? String(deliverableId) : "",
      note: "", files: [],
    });
  };

  const bookSession = async (event, stage, milestone) => {
    event.preventDefault();
    if (!bookForm.date || !bookForm.time) return;
    if (!bookForm.note.trim()) {
      notifyMsg(t("venture.manager.memoRequired"));
      return;
    }
    const start = new Date(`${bookForm.date}T${bookForm.time}:00`);
    if (!isValidSessionStart(start)) {
      const next = minSessionStartInput();
      setBookForm((prev) => ({ ...prev, date: toDateInput(next), time: toTimeInput(next), min_time: toTimeInput(next) }));
      notifyMsg(t("venture.manager.sessionTooSoon"));
      return;
    }
    setBookSaving(true);
    try {
      // Attach the documents first: each file goes to the Venture's private
      // session-material store and only its path travels with the booking.
      const materials = [];
      for (const file of bookForm.files || []) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("milestone_id", String(milestone.id));
        const uploadResponse = await fetch(`/api/ventures/${params.id}/sessions/upload`, { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadPayload.success) {
          notifyMsg(uploadPayload.error || t("venture.manager.sessionBookFailed"));
          return;
        }
        materials.push({ path: uploadPayload.path, name: uploadPayload.name, size: uploadPayload.size });
      }
      const minutes = Number(bookForm.duration) || 45;
      const end = new Date(start.getTime() + minutes * 60000);
      const res = await fetch(`/api/ventures/${params.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          title: bookForm.title || milestone.title,
          description: bookForm.note.trim(),
          session_type: "coaching",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          venture_facing: true,
          journey_stage_id: stage.id,
          milestone_ref: String(milestone.id),
          // The session is anchored to an ACTIVITY of the milestone.
          task_id: bookForm.activity_id || null,
          materials,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        await alert({ message: t("venture.manager.sessionBooked") });
        setBookFor(null);
        await loadVentureSessions();
      } else {
        // The server refuses a booking against a milestone that is not the one
        // currently open, and says WHY — show that reason verbatim.
        notifyMsg(payload.error || t("venture.manager.sessionBookFailed"));
      }
    } catch (_) {
      notifyMsg(t("venture.manager.sessionBookFailed"));
    } finally {
      setBookSaving(false);
    }
  };

  const TASK_LABEL_KEYS = { review: "pendingReview", accepted: "approved", revision_requested: "revisionRequested" };
  const label = (statusValue, map) => t(`venture.${map && map[statusValue] ? map[statusValue] : statusValue}`);

  const loadMilestoneTasks = async (milestoneId) => {
    if (tasksByMilestone[milestoneId]) return;
    try {
      const res = await fetch(`/api/ventures/${params.id}/tasks?milestone_id=${encodeURIComponent(milestoneId)}`);
      const payload = await res.json();
      if (payload.success) setTasksByMilestone((prev) => ({ ...prev, [milestoneId]: payload.tasks || [] }));
    } catch (_) {}
  };

  /** Save the session's single note. The server rewrites the SAME record the
   *  session was booked with — it never files a second note. */
  const saveSessionNote = async (sessionId) => {
    const note = noteDraft.trim();
    if (!note) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/ventures/${params.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_session_note", session_id: sessionId, note }),
      });
      const payload = await res.json();
      if (payload.success) {
        notifyMsg(t("venture.manager.memoSaved"));
        setNoteEditFor(null);
        setNoteDraft("");
        await loadVentureSessions();
      } else {
        notifyMsg(payload.error || t("venture.manager.actionFailed"));
      }
    } catch (_) {
      notifyMsg(t("venture.manager.actionFailed"));
    } finally {
      setNoteSaving(false);
    }
  };

  const openStage = async (stage) => {
    const next = openId === stage.id ? null : stage.id;
    setOpenId(next);
    setOpenTaskId(null);
    if (next && stage.status !== "upcoming" && stage.milestones) {
      stage.milestones.forEach((milestone) => loadMilestoneTasks(milestone.id));
      loadVentureSessions();
    }
  };

  const loadTaskSubmission = async (taskId) => {
    if (subsByTask[taskId] !== undefined) return;
    try {
      const res = await fetch(`/api/ventures/${params.id}/tasks/${taskId}/submissions`);
      const payload = await res.json();
      setSubsByTask((prev) => ({ ...prev, [taskId]: payload.success ? (payload.latest || null) : null }));
    } catch (_) {
      setSubsByTask((prev) => ({ ...prev, [taskId]: null }));
    }
  };

  const toggleTask = (taskId) => {
    const next = openTaskId === taskId ? null : taskId;
    setOpenTaskId(next);
    if (next) loadTaskSubmission(taskId);
  };

  const submitTask = async (taskId, milestoneId) => {
    const draft = drafts[taskId] || {};
    const url = (draft.url || "").trim();
    const notes = (draft.notes || "").trim();
    if (!url && !notes) return;
    try {
      const res = await fetch(`/api/ventures/${params.id}/tasks/${taskId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", file_url: url || null, notes: notes || null }),
      });
      const payload = await res.json();
      if (payload.success) {
        notifyMsg(t("venture.submissionSent"));
        setDrafts((prev) => ({ ...prev, [taskId]: { url: "", notes: "" } }));
        setSubsByTask((prev) => ({ ...prev, [taskId]: payload.latest || null }));
        if (milestoneId) loadMilestoneTasks(milestoneId);
      } else {
        notifyMsg(payload.error || t("venture.submitFailed"));
      }
    } catch (_) {
      notifyMsg(t("venture.submitFailed"));
    }
  };

  // Deliverable evidence: the Venture submits a URL; the status chip then
  // reflects the review (submitted / approved / changes requested).
  const submitDeliverable = async (deliverableId) => {
    const draft = dvDrafts[deliverableId] || {};
    const file = draft.file || null;
    const url = (draft.url || "").trim();
    if (!file && !url) return;
    try {
      let evidenceUrl = url;
      let evidenceName = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("deliverable_id", String(deliverableId));
        const uploadResponse = await fetch(`/api/ventures/${params.id}/deliverables/upload`, { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadPayload.success) {
          notifyMsg(uploadPayload.error || t("venture.submitFailed"));
          return;
        }
        evidenceUrl = uploadPayload.path;
        evidenceName = uploadPayload.name || file.name || null;
      }
      const res = await fetch(`/api/ventures/${params.id}/deliverables`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deliverableId, action: "submit", attachment_url: evidenceUrl, attachment_name: evidenceName }),
      });
      const payload = await res.json();
      if (payload.success) {
        notifyMsg(t("venture.manager.deliverableSubmitted"));
        setDvDrafts((prev) => ({ ...prev, [deliverableId]: { url: "", file: null } }));
        fetchJourney(true);
      } else {
        notifyMsg(payload.error || t("venture.submitFailed"));
      }
    } catch (_) {
      notifyMsg(t("venture.submitFailed"));
    }
  };

  const submissionChip = (taskId) => {
    const latest = subsByTask[taskId];
    if (latest === undefined || latest === null) return null;
    // Review outcomes speak the same words as deliverables (Approved /
    // Changes Requested / Awaiting Review) — one vocabulary per idea.
    const normalizedReviewStatus =
      latest.review_decision === "approved"
        ? statusWord("approved")
        : latest.review_decision === "changes_requested"
          ? statusWord("changes_requested")
          : statusWord("awaiting_review");
    return (
      <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusChipClass(normalizedReviewStatus)}`}>
        {statusLabel(normalizedReviewStatus, t)}
      </span>
    );
  };

  // The open milestone, found wherever it sits: its detail lives in a pop-up.
  const openMilestoneStage = journeyStages.find((stage) => (stage.milestones || []).some((milestone) => String(milestone.id) === String(openMilestoneId)));
  const openMilestone = openMilestoneStage ? openMilestoneStage.milestones.find((milestone) => String(milestone.id) === String(openMilestoneId)) : null;

  // STRICTLY the one milestone the Venture may book against: the first unfinished,
  // open milestone of the Journey that is actually current. Upcoming and blocked
  // milestones are already filtered out by the journey API.
  const milestoneIsCurrent = (stage, milestone) => {
    const firstOpenId = (stage.milestones || []).find((candidateMilestone) => candidateMilestone.status !== "completed")?.id;
    return stage.status === "active" && String(milestone.status) !== "completed" && String(firstOpenId) === String(milestone.id);
  };

  const renderMilestoneDetail = (stage, milestone) => {
    const tasks = tasksByMilestone[milestone.id] || [];
    const normalizedMilestoneStatus = milestoneStatusWord(milestone.status);
    const isCurrent = milestoneIsCurrent(stage, milestone);
    // ONE authoritative Owner / Support / Start / Finish: the milestone's own, else
    // its first activity's — the manager's rule, so both views show the same values.
    const primaryActivity = (milestone.deliverables || []).find((deliverable) => deliverable.activity)?.activity || null;
    const milestoneOwner = milestone.owner_name || primaryActivity?.owner_name || null;
    const milestoneSupport = milestone.support_name || primaryActivity?.support_name || null;
    const milestoneStart = milestone.start_date || primaryActivity?.start_date || null;
    const milestoneFinish = milestone.target_date || primaryActivity?.due_date || null;
    return (
      <div className="space-y-4">
        {/* The milestone's metadata, label → value, as in the Venture Manager's
            pop-up: people first, then timing. */}
        <div className="jy-facts in">
          <div><span>{t("venture.manager.milestoneOwner")}</span><b>{milestoneOwner || "—"}</b></div>
          <div><span>{t("venture.manager.supporting")}</span><b>{milestoneSupport || "—"}</b></div>
          <div><span>{t("venture.manager.startDate")}</span><b>{milestoneStart ? new Date(milestoneStart).toLocaleDateString() : "—"}</b></div>
          <div><span>{t("venture.manager.finishDate")}</span><b>{milestoneFinish ? new Date(milestoneFinish).toLocaleDateString() : "—"}</b></div>
        </div>

        <FounderMilestoneDeliverables
          milestone={milestone}
          stage={stage}
          dvDrafts={dvDrafts}
          setDvDrafts={setDvDrafts}
          submitDeliverable={submitDeliverable}
          canBook={isCurrent}
          bookFor={bookFor}
          bookForm={bookForm}
          bookSaving={bookSaving}
          bookSession={bookSession}
          openBooking={openBooking}
          setBookFor={setBookFor}
          setBookForm={setBookForm}
        />

        {/* Sessions already booked on this milestone, with the
            documents they were booked with. */}
        {(sessionsByMilestone[String(milestone.id)] || []).length > 0 && (
          <FounderMilestoneSessions
            milestone={milestone}
            noteDraft={noteDraft}
            noteEditFor={noteEditFor}
            noteSaving={noteSaving}
            saveSessionNote={saveSessionNote}
            sessionsByMilestone={sessionsByMilestone}
            setNoteDraft={setNoteDraft}
            setNoteEditFor={setNoteEditFor}
          />
        )}
        {stage.status === 'upcoming' ? null : tasks.length === 0 && tasksByMilestone[milestone.id] !== undefined ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.noTasksYet')}</p>
        ) : null}
        {stage.status !== 'upcoming' && (tasksByMilestone[milestone.id] === undefined ? (
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.loading') || 'Loading...'}</p>
        ) : tasks.length > 0 ? (
          <FounderMilestoneTasks
            TASK_LABEL_KEYS={TASK_LABEL_KEYS}
            drafts={drafts}
            label={label}
            milestone={milestone}
            openTaskId={openTaskId}
            setDrafts={setDrafts}
            stage={stage}
            submissionChip={submissionChip}
            submitTask={submitTask}
            subsByTask={subsByTask}
            tasks={tasks}
            toggleTask={toggleTask}
          />
        ) : null)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('venture.journeyDesc') || 'Your journey is defined by the team supporting your Venture.'}</p>
      {journeyDeliverablesUnavailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-400">
          {t('venture.evidenceUnavailable')}
        </div>
      )}
      {journeyStages.length === 0 ? (
        <div className="rounded-xl p-8 border text-center" style={cardStyle}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('venture.noJourneyYet') || 'No journey milestones have been defined yet.'}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('venture.noJourneyYetDesc') || 'The team supporting your Venture will publish your journey soon.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {journeyStages.map((stage) => {
            const isOpen = openId === stage.id;
            const milestoneCounts = stage.milestone_counts || { total: 0, completed: 0 };
            const stageWord = stageStatusWord(stage.status);
            const stagePct = milestoneCounts.total > 0 ? Math.round((milestoneCounts.completed / milestoneCounts.total) * 100) : 0;
            const stageDone = stage.status === 'completed';
            return (
              <div key={stage.id} className={`jy-stage ${stage.status === 'active' ? 'is-active' : ''} ${stage.status === 'upcoming' ? 'is-locked' : ''}`}>
                {/* The same header as the Venture Manager's journey: number, fold
                    chevron, title, status and the progress of its milestones. */}
                <button type="button" onClick={() => openStage(stage)} aria-expanded={isOpen} className="jy-sh w-full text-left">
                  <div className="jy-sh-row">
                    <span className={`jy-num ${stageDone ? 'is-done' : stage.status === 'active' ? 'is-active' : ''}`}>
                      {stageDone ? <CheckCircle2 size={17} /> : (stage.stage_order || '')}
                    </span>
                    <div className="jy-sh-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isOpen ? <ChevronDown size={17} className="shrink-0 text-[var(--text-secondary)]" /> : <ChevronRight size={17} className="shrink-0 text-[var(--text-secondary)]" />}
                        <h4 className={`jy-sh-title ${stageDone ? 'is-done' : ''}`}>{stage.name}</h4>
                      </div>
                    </div>
                    <div className="jy-sh-side">
                      <span className={`stf-tag ${MILESTONE_TAG_TONE[stageWord?.tone] || ''}`}>{statusLabel(stageWord, t)}</span>
                    </div>
                  </div>
                  {milestoneCounts.total > 0 && (
                    <div className="jy-prog">
                      <div className="stf-bar-prog"><i style={{ width: `${stagePct}%` }} /></div>
                      <span><b>{stagePct}%</b> · {t('venture.manager.milestoneProgress', { done: milestoneCounts.completed, total: milestoneCounts.total })}</span>
                    </div>
                  )}
                </button>
                {isOpen && (
                  <div className="jy-sec space-y-3">
                    {stage.objective && (
                      <p className="jy-obj"><b>{t('venture.manager.objective')}: </b>{stage.objective}</p>
                    )}
                    {stage.description && <p className="jy-sh-meta">{stage.description}</p>}
                    <div className="jy-hint">
                      {stage.target_date && <span>{t('venture.targetDate') || 'Target Date'}: {new Date(`${dateOnly(stage.target_date)}T00:00:00`).toLocaleDateString()}</span>}
                      {stage.completed_at && <span>✓ {t('venture.completed') || 'Completed'}: {new Date(stage.completed_at).toLocaleDateString()}</span>}
                    </div>

                    {/* Milestones bound to this stage (canonical spine) */}
                    {stage.milestones && stage.milestones.length > 0 && (
                      <div className="jy-ms">
                        {stage.milestones.map((milestone) => {
                          const normalizedMilestoneStatus = milestoneStatusWord(milestone.status);
                          const deliverableCount = (milestone.deliverables || []).length;
                          return (
                            <div key={milestone.id} className="jy-m">
                              <div className="jy-mrow">
                                {/* One line per milestone; its tasks, deliverables and sessions
                                    open in a pop-up, exactly like the Venture Manager's view. */}
                                <button
                                  type="button"
                                  onClick={() => setOpenMilestoneId(milestone.id)}
                                  aria-haspopup="dialog"
                                  className="jy-mtog"
                                >
                                  <span className={`jy-dot ${statusDotClass(normalizedMilestoneStatus)}`} />
                                  <span className={`jy-mt ${String(milestone.status) === "completed" ? "is-done" : ""}`}>{milestone.title}</span>
                                  {deliverableCount > 0 && (
                                    <span className="jy-cnt" title={t("venture.manager.tasksHeading")}>
                                      <Flag size={13} /> {deliverableCount}
                                    </span>
                                  )}
                                  <ChevronRight size={15} className="shrink-0 text-[var(--text-secondary)]" />
                                </button>
                                {milestone.status && (
                                  <span className={`stf-tag ${MILESTONE_TAG_TONE[normalizedMilestoneStatus?.tone] || ""} shrink-0`}>
                                    {statusLabel(normalizedMilestoneStatus, t)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AppModal
        isOpen={Boolean(openMilestone)}
        onClose={() => setOpenMilestoneId(null)}
        title={openMilestone?.title || ""}
        size="xl"
      >
        {openMilestone ? renderMilestoneDetail(openMilestoneStage, openMilestone) : null}
      </AppModal>
    </div>
  );
}

