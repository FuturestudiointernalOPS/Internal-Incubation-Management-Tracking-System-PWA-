"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  stageStatusWord,
  milestoneStatusWord,
  deliverableStatusWord,
  statusWord,
  statusLabel,
  statusChipClass,
} from "@/lib/ventureStatuses";
import {
  minSessionStartInput,
  isValidSessionStart,
  toDateInput,
  toTimeInput,
} from "@/lib/ventureSessionRules";
import { useVenture } from "../VentureContext";
import FounderMilestoneSessions from "@/components/ventures/journey/FounderMilestoneSessions";
import FounderMilestoneTasks from "@/components/ventures/journey/FounderMilestoneTasks";
import FounderSessionBooking from "@/components/ventures/journey/FounderSessionBooking";

/* Journey Tab — the Venture journey as its operating workspace.
   Each stage lists the milestones bound to it; each milestone lists its
   tasks. Founders can submit work (document URL + notes) on tasks; staff
   review each submission (approved / changes requested). */
export function JourneyTab() {
  const { t } = useI18n();
  const { journeyStages, cardStyle, params, notifyMsg, fetchJourney, journeyDeliverablesUnavailable } = useVenture();
  const [openId, setOpenId] = useState(null);
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

  const openBooking = (milestone) => {
    setBookFor(milestone.id);
    // Same floor as every other booking form: now + 30 minutes, rounded up to a
    // whole minute, so the prefilled slot can never be rejected by the server.
    const min = minSessionStartInput();
    setBookForm({ date: toDateInput(min), time: toTimeInput(min), min_time: toTimeInput(min), duration: "45", note: "", files: [] });
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
          title: milestone.title,
          description: bookForm.note.trim(),
          session_type: "coaching",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          venture_facing: true,
          journey_stage_id: stage.id,
          milestone_ref: String(milestone.id),
          materials,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        notifyMsg(t("venture.manager.sessionBooked"));
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
            return (
              <div key={stage.id} className={`rounded-xl border overflow-hidden ${stage.status === 'upcoming' ? 'opacity-75' : ''}`} style={cardStyle}>
                <button type="button" onClick={() => openStage(stage)} className="w-full flex items-center gap-4 p-4 text-left">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    stage.status === 'completed' ? 'bg-green-600 text-white' :
                    stage.status === 'active' ? 'bg-blue-600 text-white' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {stage.status === 'completed' ? '✓' : String(stage.stage_order).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium ${stage.status === 'completed' ? 'line-through' : ''}`} style={{ color: stage.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{stage.name}</p>
                      <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusChipClass(stageStatusWord(stage.status))}`}>{statusLabel(stageStatusWord(stage.status), t)}</span>
                      {milestoneCounts.total > 0 && (
                        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-slate-400">{milestoneCounts.completed}/{milestoneCounts.total} {t('venture.milestones')}</span>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={18} className="shrink-0" style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-3 border-t space-y-3" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}>
                    {stage.objective && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-secondary)' }}>{t('venture.objective') || 'Objective'}</p>
                        <p className="text-sm">{stage.objective}</p>
                      </div>
                    )}
                    {stage.description && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-secondary)' }}>{t('venture.description') || 'Description'}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{stage.description}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
                      {stage.target_date && <span style={{ color: 'var(--text-secondary)' }}>{t('venture.targetDate') || 'Target Date'}: {new Date(`${stage.target_date}T00:00:00`).toLocaleDateString()}</span>}
                      {stage.completed_at && <span style={{ color: '#22c55e' }}>✓ {t('venture.completed') || 'Completed'}: {new Date(stage.completed_at).toLocaleDateString()}</span>}
                    </div>

                    {/* Milestones bound to this stage (canonical spine) */}
                    {stage.milestones && stage.milestones.length > 0 && (
                      <div className="pt-2 space-y-3">
                        {stage.milestones.map((milestone) => {
                          const tasks = tasksByMilestone[milestone.id] || [];
                          const normalizedMilestoneStatus = milestoneStatusWord(milestone.status);
                          // STRICTLY the one milestone the Venture may book against:
                          // the first unfinished, open milestone of the Journey that
                          // is actually current. Upcoming and blocked milestones are
                          // already filtered out by the journey API, so this is the
                          // only open one.
                          const firstOpenId = (stage.milestones || []).find((candidateMilestone) => candidateMilestone.status !== "completed")?.id;
                          const isCurrent =
                            stage.status === "active" &&
                            String(milestone.status) !== "completed" &&
                            String(firstOpenId) === String(milestone.id);
                          return (
                            <div key={milestone.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'rgb(255 255 255 / 0.1)' }}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-bold">{milestone.title}</p>
                                <div className="flex items-center gap-2">
                                  {milestone.status && <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${statusChipClass(normalizedMilestoneStatus)}`}>{statusLabel(normalizedMilestoneStatus, t)}</span>}
                                  {milestone.progress > 0 && <span className="text-[10px] font-bold" style={{ color: 'var(--brand-orange)' }}>{milestone.progress}%</span>}
                                  {/* The WORK under the outcome, shown beside it: the badge
                                      says what the milestone is, this says how much of it is
                                      done. Deliberately separate from the % — that stays
                                      evidence-driven, so nothing downstream changes meaning. */}
                                  {milestone.task_counts?.total > 0 && (
                                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                      {t('venture.manager.tasksDone', { done: milestone.task_counts.done, total: milestone.task_counts.total })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {milestone.target_date && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.targetDate') || 'Target Date'}: {new Date(`${milestone.target_date}T00:00:00`).toLocaleDateString()}</p>}

                              {/* Deliverables: evidence the Venture must submit for review */}
                              {(milestone.deliverables || []).length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                    {t('venture.manager.deliverables')}
                                  </p>
                                  {(milestone.deliverables || []).map((deliverable) => {
                                    // ONE vocabulary, shared with the Venture Manager
                                    // and Super Admin views (lib/ventureStatuses).
                                    const deliverableStatus = deliverableStatusWord(deliverable);
                                    const canSubmit = stage.status === 'active' && deliverableStatus.id !== 'approved';
                                    return (
                                      <div key={deliverable.id} className="rounded-lg border p-2.5 space-y-1.5" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="flex-1 min-w-0 text-xs font-medium truncate">{deliverable.title}</span>
                                          {deliverable.due_date && <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{new Date(deliverable.due_date).toLocaleDateString()}</span>}
                                          <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${statusChipClass(deliverableStatus)}`}>
                                            {statusLabel(deliverableStatus, t)}
                                          </span>
                                        </div>
                                        {deliverable.description && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{deliverable.description}</p>}
                                        {deliverable.attachment_url && (
                                          <a href={deliverable.evidence_download_url || deliverable.attachment_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold" style={{ color: 'var(--brand-orange)' }}>
                                            {deliverable.attachment_name || t('venture.manager.viewEvidence')}
                                          </a>
                                        )}
                                        {deliverable.approval_status === 'rejected' && deliverable.rejection_reason && (
                                          <p className="text-[10px] text-rose-400">{t('venture.manager.changesRequestedReason', { reason: deliverable.rejection_reason })}</p>
                                        )}
                                        {canSubmit && (
                                          <div className="space-y-1.5">
                                            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                              {t('venture.manager.attachFile')}
                                            </p>
                                            <input
                                              type="file"
                                              onChange={(event) => setDvDrafts((prev) => ({ ...prev, [deliverable.id]: { ...(prev[deliverable.id] || {}), file: event.target.files?.[0] || null } }))}
                                              className="w-full text-[10px]"
                                              style={{ color: 'var(--text-secondary)' }}
                                            />
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <input
                                                value={(dvDrafts[deliverable.id] || {}).url || ''}
                                                onChange={(event) => setDvDrafts((prev) => ({ ...prev, [deliverable.id]: { ...(prev[deliverable.id] || {}), url: event.target.value } }))}
                                                placeholder={t('venture.urlPlaceholder')}
                                                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                              />
                                              <button type="button" onClick={() => submitDeliverable(deliverable.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-black" style={{ backgroundColor: 'var(--brand-orange)' }}>
                                                {t('venture.submitForReview')}
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {/* The Venture books its own sessions — strictly against
                                  the milestone that is currently open. */}
                              {isCurrent && (
                                <FounderSessionBooking
                                  bookFor={bookFor}
                                  bookForm={bookForm}
                                  bookSaving={bookSaving}
                                  bookSession={bookSession}
                                  milestone={milestone}
                                  openBooking={openBooking}
                                  setBookFor={setBookFor}
                                  setBookForm={setBookForm}
                                  stage={stage}
                                />
                              )}

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
    </div>
  );
}

// The Business Model tab lives in its own file; re-exported here so the
// participant venture page keeps importing both tabs from this module.
export { BusinessModelTab } from "@/components/ventures/journey/BusinessModelTab";
