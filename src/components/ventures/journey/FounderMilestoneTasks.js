"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * The tasks of a milestone, as the Venture sees them: status, latest
 * submission, and the submit-for-review form.
 *
 * Moved verbatim out of JourneyPlaybookTabs: every prop carries the tab
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The tab keeps all state and all writes.
 */
export default function FounderMilestoneTasks({
  TASK_LABEL_KEYS,
  drafts,
  label,
  milestone,
  openTaskId,
  setDrafts,
  stage,
  submissionChip,
  submitTask,
  subsByTask,
  tasks,
  toggleTask,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      {tasks.map((task) => {
        const isTaskOpen = openTaskId === task.id;
        const canSubmit = stage.status === 'active' && !task.dependency_blocked && !['done', 'completed', 'accepted', 'cancelled'].includes(task.status);
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
                {task.dependency_blocked && (
                  <p className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400">
                    {t('status.blocked')}: {(task.blocked_by_titles || []).join(', ')}
                  </p>
                )}
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
  );
}
