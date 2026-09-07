"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Journey Tab — the Venture journey as its operating workspace.
   Each stage lists the milestones bound to it; each milestone lists its
   tasks. Founders can submit work (document URL + notes) on tasks; staff
   review each submission (approved / changes requested). */
export function JourneyTab() {
  const { t } = useI18n();
  const { journeyStages, cardStyle, params, notifyMsg } = useVenture();
  const [openId, setOpenId] = useState(null);
  const [tasksByMilestone, setTasksByMilestone] = useState({});
  const [subsByTask, setSubsByTask] = useState({});
  const [openTaskId, setOpenTaskId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const TASK_LABEL_KEYS = { review: "pendingReview", accepted: "approved", revision_requested: "revisionRequested" };
  const MILESTONE_LABEL_KEYS = { not_started: "notStarted", in_progress: "inProgress", under_review: "pendingReview", changes_requested: "revisionRequested" };
  const label = (s, map) => t(`venture.${map && map[s] ? map[s] : s}`);

  const loadMilestoneTasks = async (mid) => {
    if (tasksByMilestone[mid]) return;
    try {
      const res = await fetch(`/api/ventures/${params.id}/tasks?milestone_id=${encodeURIComponent(mid)}`);
      const d = await res.json();
      if (d.success) setTasksByMilestone((p) => ({ ...p, [mid]: d.tasks || [] }));
    } catch (_) {}
  };

  const openStage = async (stage) => {
    const next = openId === stage.id ? null : stage.id;
    setOpenId(next);
    setOpenTaskId(null);
    if (next && stage.status !== "locked" && stage.milestones) {
      stage.milestones.forEach((m) => loadMilestoneTasks(m.id));
    }
  };

  const loadTaskSubmission = async (taskId) => {
    if (subsByTask[taskId] !== undefined) return;
    try {
      const res = await fetch(`/api/ventures/${params.id}/tasks/${taskId}/submissions`);
      const d = await res.json();
      setSubsByTask((p) => ({ ...p, [taskId]: d.success ? (d.latest || null) : null }));
    } catch (_) {
      setSubsByTask((p) => ({ ...p, [taskId]: null }));
    }
  };

  const toggleTask = (taskId) => {
    const next = openTaskId === taskId ? null : taskId;
    setOpenTaskId(next);
    if (next) loadTaskSubmission(taskId);
  };

  const submitTask = async (taskId, mid) => {
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
      const d = await res.json();
      if (d.success) {
        notifyMsg(t("venture.submissionSent"));
        setDrafts((p) => ({ ...p, [taskId]: { url: "", notes: "" } }));
        setSubsByTask((p) => ({ ...p, [taskId]: d.latest || null }));
        if (mid) loadMilestoneTasks(mid);
      } else {
        notifyMsg(d.error || t("venture.submitFailed"));
      }
    } catch (_) {
      notifyMsg(t("venture.submitFailed"));
    }
  };

  const submissionChip = (taskId) => {
    const latest = subsByTask[taskId];
    if (latest === undefined || latest === null) return null;
    if (latest.review_decision === "approved") {
      return <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-green-500/15 text-green-400">{t("venture.approved")}</span>;
    }
    if (latest.review_decision === "changes_requested") {
      return <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">{t("venture.revisionRequested")}</span>;
    }
    return <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">{t("venture.awaitingReview")}</span>;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('venture.journeyDesc') || 'Your journey is defined by the team supporting your Venture.'}</p>
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
                        {stage.milestones.map((m) => {
                          const tasks = tasksByMilestone[m.id] || [];
                          return (
                            <div key={m.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'rgb(255 255 255 / 0.1)' }}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-bold">{m.title}</p>
                                <div className="flex items-center gap-2">
                                  {m.status && <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${m.status === 'completed' ? 'bg-green-500/15 text-green-400' : m.status === 'in_progress' ? 'bg-blue-500/15 text-blue-400' : 'bg-white/10 text-slate-400'}`}>{label(m.status, MILESTONE_LABEL_KEYS)}</span>}
                                  {m.progress > 0 && <span className="text-[10px] font-bold" style={{ color: 'var(--brand-orange)' }}>{m.progress}%</span>}
                                </div>
                              </div>
                              {m.target_date && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.targetDate') || 'Target Date'}: {new Date(`${m.target_date}T00:00:00`).toLocaleDateString()}</p>}
                              {stage.status === 'locked' ? null : tasks.length === 0 && tasksByMilestone[m.id] !== undefined ? (
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.noTasksYet')}</p>
                              ) : null}
                              {stage.status !== 'locked' && (tasksByMilestone[m.id] === undefined ? (
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
                                                <input value={(drafts[task.id] || {}).url || ''} onChange={(e) => setDrafts((p) => ({ ...p, [task.id]: { ...(p[task.id] || {}), url: e.target.value } }))} placeholder={t('venture.urlPlaceholder')} className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
                                                <textarea value={(drafts[task.id] || {}).notes || ''} onChange={(e) => setDrafts((p) => ({ ...p, [task.id]: { ...(p[task.id] || {}), notes: e.target.value } }))} rows={2} placeholder={t('venture.notesOptional')} className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
                                                <button type="button" onClick={() => submitTask(task.id, m.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-black" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.submitForReview')}</button>
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

/* Playbook Tab */
export function PlaybookTab() {
  const { t } = useI18n();
  const { playbookEntries, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.facilitatorPlaybook') || 'Facilitator Playbook'}</h2>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('venture.playbookDesc') || 'Standard review guide for each incubation stage.'}</p>
      <div className="space-y-3">
        {playbookEntries.map(entry => (
          <details key={entry.id} className="rounded-xl p-4 border" style={cardStyle}>
            <summary className="font-medium cursor-pointer">{entry.stage_order}. {entry.stage_name}</summary>
            <div className="mt-3 space-y-2 text-sm">
              <div><strong>{t('venture.objective') || 'Objective'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.objective}</span></div>
              <div><strong>{t('venture.expectedOutcome') || 'Expected Outcome'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.expected_outcome}</span></div>
              <div><strong>{t('venture.questions') || 'Questions to Ask'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.questions}</span></div>
              <div><strong>{t('venture.evidence') || 'Evidence Required'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.evidence}</span></div>
              <div><strong>{t('venture.requiredDocuments') || 'Required Documents'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.documents}</span></div>
              <div><strong>{t('venture.commonMistakes') || 'Common Mistakes'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.mistakes}</span></div>
              <div><strong>{t('venture.approvalCriteria') || 'Approval Criteria'}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{entry.approval_criteria}</span></div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/* Business Model Tab */
export function BusinessModelTab() {
  const { t } = useI18n();
  const { bmData, setBmData, params, notifyMsg, fetchBm, inputStyle, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      <form onSubmit={async (e) => { e.preventDefault(); await fetch(`/api/ventures/${params.id}/business-model`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bmData || {}) }); notifyMsg('Saved'); fetchBm(); }} className="space-y-4">
        <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['keyPartners', 'keyActivities', 'keyResources', 'valuePropositions', 'customerRelationships', 'channels', 'customerSegments', 'costStructure', 'revenueStreams'].map(f => (
              <div key={f}>
                <label className="block text-sm font-medium mb-1">{t(`venture.${f}`)}</label>
                <textarea className="w-full px-3 py-2 rounded-lg outline-none border text-sm" style={inputStyle} rows={3}
                  value={bmData?.business_model_canvas?.[f] || ''}
                  onChange={(e) => {
                    const c = { ...(bmData?.business_model_canvas || {}), [f]: e.target.value };
                    setBmData({ ...bmData, business_model_canvas: c, venture_id: params.id });
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
