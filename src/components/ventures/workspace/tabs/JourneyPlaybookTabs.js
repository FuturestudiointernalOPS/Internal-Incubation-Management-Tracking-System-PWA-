"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarPlus, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  milestoneStatusWord,
  deliverableStatusWord,
  statusWord,
  statusLabel,
  statusChipClass,
} from "@/lib/ventureStatuses";
import {
  minSessionStartInput,
  isValidSessionStart,
  SESSION_MATERIALS_MAX,
  toDateInput,
  toTimeInput,
} from "@/lib/ventureSessionRules";
import { useVenture } from "../VentureContext";

/* Journey Tab — the Venture journey as its operating workspace.
   Each stage lists the milestones bound to it; each milestone lists its
   tasks. Founders can submit work (document URL + notes) on tasks; staff
   review each submission (approved / changes requested). */
export function JourneyTab() {
  const { t, lang } = useI18n();
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
    if (next && stage.status !== "locked" && stage.milestones) {
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
              <div key={stage.id} className={`rounded-xl border overflow-hidden ${stage.status === 'locked' ? 'opacity-75' : ''}`} style={cardStyle}>
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
                      {stage.status === 'active' && <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">{t('venture.statuses.active')}</span>}
                      {stage.status === 'completed' && <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-green-500/15 text-green-400">{t('venture.completed')}</span>}
                      {stage.status === 'locked' && <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">🔒 {t('venture.locked') || 'Locked'}</span>}
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
                          // the first unfinished milestone of the Journey that is
                          // actually current. Locked milestones are already filtered
                          // out by the journey API, so this is the only open one.
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
                                <div className="space-y-1.5 pt-1">
                                  {bookFor === milestone.id ? (
                                    <form onSubmit={(event) => bookSession(event, stage, milestone)} className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}>
                                      <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--brand-orange)' }}>
                                        <CalendarPlus size={13} /> {t('venture.manager.bookSession')}
                                      </p>
                                      <textarea
                                        value={bookForm.note}
                                        onChange={(event) => setBookForm({ ...bookForm, note: event.target.value })}
                                        rows={3}
                                        required
                                        placeholder={t('venture.manager.memoPlaceholder')}
                                        className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                                      />
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input type="date" required min={toDateInput(new Date())} value={bookForm.date} onChange={(event) => setBookForm({ ...bookForm, date: event.target.value })} className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
                                        <input type="time" required min={bookForm.min_time || undefined} value={bookForm.time} onChange={(event) => setBookForm({ ...bookForm, time: event.target.value })} className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
                                        <select value={bookForm.duration} onChange={(event) => setBookForm({ ...bookForm, duration: event.target.value })} className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]">
                                          {["30", "45", "60", "90"].map((durationOption) => (
                                            <option key={durationOption} value={durationOption}>{t('venture.manager.minutes', { n: durationOption })}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.sessionMaterials')}</p>
                                        <input
                                          type="file"
                                          multiple
                                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                          onChange={(event) => setBookForm({ ...bookForm, files: Array.from(event.target.files || []).slice(0, SESSION_MATERIALS_MAX) })}
                                          className="w-full text-[10px]"
                                          style={{ color: 'var(--text-secondary)' }}
                                        />
                                        {(bookForm.files || []).length > 0 && (
                                          <ul className="space-y-0.5">
                                            {bookForm.files.map((file, index) => (
                                              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="truncate">{file.name}</span>
                                                <button type="button" aria-label={t('venture.manager.sessionMaterialsRemove')} onClick={() => setBookForm({ ...bookForm, files: bookForm.files.filter((_, fileIndex) => fileIndex !== index) })} className="shrink-0">
                                                  <X size={12} />
                                                </button>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.sessionMaterialsHint')}</p>
                                      </div>
                                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.sessionLeadHint')}</p>
                                      <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setBookFor(null)} className="px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest" style={{ borderColor: 'rgb(255 255 255 / 0.15)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
                                        <button type="submit" disabled={bookSaving} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: 'var(--brand-orange)' }}>
                                          {bookSaving ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />} {t('venture.manager.bookSession')}
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <button type="button" onClick={() => openBooking(milestone)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--brand-orange)' }}>
                                      <CalendarPlus size={12} /> {t('venture.manager.bookSession')}
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Sessions already booked on this milestone, with the
                                  documents they were booked with. */}
                              {(sessionsByMilestone[String(milestone.id)] || []).length > 0 && (
                                <div className="space-y-1 pt-1">
                                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.milestoneSessions', { n: (sessionsByMilestone[String(milestone.id)] || []).length })}</p>
                                  {(sessionsByMilestone[String(milestone.id)] || []).map((session) => (
                                    <div key={session.id} className="space-y-0.5">
                                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{new Date(session.start_time).toLocaleString(lang || undefined)}</span>
                                        {' · '}{session.title}
                                        {session.coach_name ? ` · ${session.coach_name}` : ''}
                                        {(session.materials || []).map((material, index) =>
                                          material.url ? (
                                            <a key={`${material.name}-${index}`} href={material.url} target="_blank" rel="noreferrer" className="ml-2 font-bold" style={{ color: 'var(--brand-orange)' }}>{material.name}</a>
                                          ) : (
                                            <span key={`${material.name}-${index}`} className="ml-2">{material.name}</span>
                                          ),
                                        )}
                                      </div>
                                      {/* The session's ONE note — shown here and edited in
                                          place, never appended to. */}
                                      {noteEditFor === session.id ? (
                                        <div className="space-y-1">
                                          <textarea
                                            value={noteDraft}
                                            onChange={(event) => setNoteDraft(event.target.value)}
                                            rows={2}
                                            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[11px] text-[var(--text-primary)]"
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => { setNoteEditFor(null); setNoteDraft(""); }} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border" style={{ borderColor: 'rgb(255 255 255 / 0.15)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
                                            <button type="button" disabled={noteSaving || !noteDraft.trim()} onClick={() => saveSessionNote(session.id)} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg text-black disabled:opacity-50" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('common.save')}</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-2">
                                          {session.description && (
                                            <p className="flex-1 min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                              <span className="font-black uppercase tracking-widest mr-1.5">{t('venture.manager.memoLabel')}</span>
                                              <span className="whitespace-pre-wrap">{session.description}</span>
                                            </p>
                                          )}
                                          <button type="button" onClick={() => { setNoteEditFor(session.id); setNoteDraft(session.description || ""); }} className="shrink-0 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--brand-orange)' }}>
                                            {t('venture.manager.editMemo')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {stage.status === 'locked' ? null : tasks.length === 0 && tasksByMilestone[milestone.id] !== undefined ? (
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.noTasksYet')}</p>
                              ) : null}
                              {stage.status !== 'locked' && (tasksByMilestone[milestone.id] === undefined ? (
                                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.loading') || 'Loading...'}</p>
                              ) : tasks.length > 0 ? (
                                <div className="space-y-1.5">
                                  {tasks.map((task) => {
                                    const isTaskOpen = openTaskId === task.id;
                                    const canSubmit = stage.status === 'active' && !['done', 'completed', 'accepted', 'cancelled'].includes(task.status);
                                    return (
                                      <div key={task.id} className="rounded-lg border p-2.5" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}>
                                        <button type="button" onClick={() => toggleTask(task.id)} className="w-full flex items-center gap-2 text-left">
                                          <span className={`w-2 h-2 rounded-full shrink-0 ${['done', 'completed', 'accepted'].includes(task.status) ? 'bg-green-500' : task.status === 'in_progress' || task.status === 'review' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                                          <span className="flex-1 min-w-0">
                                            <span className="block text-xs font-medium truncate">{task.title}</span>
                                            {task.due_date && <span className="block text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.deadline') || 'Deadline'}: {new Date(task.due_date).toLocaleDateString()}</span>}
                                          </span>
                                          <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-slate-400">{label(task.status, TASK_LABEL_KEYS)}</span>
                                          {submissionChip(task.id)}
                                          {isTaskOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                                        </button>
                                        {isTaskOpen && (
                                          <div className="mt-2 pt-2 border-t space-y-2" style={{ borderColor: 'rgb(255 255 255 / 0.06)' }}>
                                            {task.description && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>}
                                            {subsByTask[task.id] && subsByTask[task.id] !== null && (
                                              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.latestSubmission')}: v{subsByTask[task.id].version} {submissionChip(task.id)}</p>
                                            )}
                                            {canSubmit ? (
                                              <div className="space-y-1.5">
                                                <input value={(drafts[task.id] || {}).url || ''} onChange={(event) => setDrafts((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] || {}), url: event.target.value } }))} placeholder={t('venture.urlPlaceholder')} className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
                                                <textarea value={(drafts[task.id] || {}).notes || ''} onChange={(event) => setDrafts((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] || {}), notes: event.target.value } }))} rows={2} placeholder={t('venture.notesOptional')} className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
                                                <button type="button" onClick={() => submitTask(task.id, milestone.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-black" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.submitForReview')}</button>
                                              </div>
                                            ) : (
                                              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.taskLocked') || 'This task is closed.'}</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
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

/* Business Model Tab */
export function BusinessModelTab() {
  const { t } = useI18n();
  const { bmData, setBmData, params, notifyMsg, fetchBm, inputStyle, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      <form onSubmit={async (event) => { event.preventDefault(); await fetch(`/api/ventures/${params.id}/business-model`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bmData || {}) }); notifyMsg('Saved'); fetchBm(); }} className="space-y-4">
        <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['keyPartners', 'keyActivities', 'keyResources', 'valuePropositions', 'customerRelationships', 'channels', 'customerSegments', 'costStructure', 'revenueStreams'].map(field => (
              <div key={field}>
                <label className="block text-sm font-medium mb-1">{t(`venture.${field}`)}</label>
                <textarea className="w-full px-3 py-2 rounded-lg outline-none border text-sm" style={inputStyle} rows={3}
                  value={bmData?.business_model_canvas?.[field] || ''}
                  onChange={(event) => {
                    const canvas = { ...(bmData?.business_model_canvas || {}), [field]: event.target.value };
                    setBmData({ ...bmData, business_model_canvas: canvas, venture_id: params.id });
                  }} />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'rgb(255 255 255 / 0.1)' }}>
            <button type="submit" className="px-6 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
