"use client";

import { MessageCircle, RotateCcw, AlertTriangle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Add Standup Modal */
function AddStandupModal() {
  const { t } = useI18n();
  const { showAddStandup, setShowAddStandup, params, standupForm, setStandupForm, fetchStandups, notifyMsg, inputStyle } = useVenture();
  if (!showAddStandup) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddStandup(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addStandup')}</h2><button onClick={() => setShowAddStandup(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        {(() => { const now = new Date(); const startOfYear = new Date(now.getFullYear(), 0, 1); const week = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7); return (<form onSubmit={async e => { e.preventDefault(); const y = now.getFullYear(); const res = await fetch(`/api/ventures/${params.id}/standups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week_number: week, year: y, top_priorities: standupForm.top_priorities, expected_deliverables: standupForm.expected_deliverables, weekly_priorities: standupForm.weekly_priorities }) }); const d = await res.json(); if (!d.success) { notifyMsg(t(d.error || "") || d.error); if (d.error?.includes('already exists')) return; } setShowAddStandup(false); setStandupForm({}); fetchStandups(); }} className="space-y-3">
          <div className="text-sm text-center py-1 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'rgb(255 255 255 / 0.05)' }}>Week {week}, {now.getFullYear()}</div>
          <textarea placeholder={t('venture.topPriorities')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={standupForm.top_priorities || ''} onChange={e => setStandupForm({ ...standupForm, top_priorities: e.target.value })} />
          <textarea placeholder={t('venture.expectedDeliverables')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={standupForm.expected_deliverables || ''} onChange={e => setStandupForm({ ...standupForm, expected_deliverables: e.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>); })()}
      </div>
    </div>
  );
}

/* Add Retro Modal */
function AddRetroModal() {
  const { t } = useI18n();
  const { showAddRetro, setShowAddRetro, params, retroForm, setRetroForm, fetchRetros, notifyMsg, inputStyle } = useVenture();
  if (!showAddRetro) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddRetro(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addRetro')}</h2><button onClick={() => setShowAddRetro(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        {(() => { const now = new Date(); const startOfYear = new Date(now.getFullYear(), 0, 1); const week = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7); return (<form onSubmit={async e => { e.preventDefault(); const y = now.getFullYear(); const res = await fetch(`/api/ventures/${params.id}/retros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week_number: week, year: y, completed_tasks: retroForm.completed_tasks, outstanding_tasks: retroForm.outstanding_tasks, carry_forward_notes: retroForm.carry_forward_notes }) }); const d = await res.json(); if (!d.success) { notifyMsg(t(d.error || "") || d.error); if (d.error?.includes('already exists')) return; } setShowAddRetro(false); setRetroForm({}); fetchRetros(); }} className="space-y-3">
          <div className="text-sm text-center py-1 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'rgb(255 255 255 / 0.05)' }}>Week {week}, {now.getFullYear()}</div>
          <textarea placeholder={t('venture.completedTasks')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={retroForm.completed_tasks || ''} onChange={e => setRetroForm({ ...retroForm, completed_tasks: e.target.value })} />
          <textarea placeholder={t('venture.outstandingTasks')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={retroForm.outstanding_tasks || ''} onChange={e => setRetroForm({ ...retroForm, outstanding_tasks: e.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>); })()}
      </div>
    </div>
  );
}

/* Add Blocker Modal */
function AddBlockerModal() {
  const { t } = useI18n();
  const { showAddBlocker, setShowAddBlocker, params, blockerForm, setBlockerForm, retros, tasks, fetchBlockers, notifyMsg, inputStyle } = useVenture();
  if (!showAddBlocker) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddBlocker(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addBlocker')}</h2><button onClick={() => setShowAddBlocker(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async e => { e.preventDefault(); const res = await fetch(`/api/ventures/${params.id}/blockers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(blockerForm) }); const d = await res.json(); if (!d.success) notifyMsg(t(d.error || "") || d.error); setShowAddBlocker(false); setBlockerForm({}); fetchBlockers(); }} className="space-y-3">
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.venture_retro_id || ''} onChange={e => setBlockerForm({ ...blockerForm, venture_retro_id: e.target.value })} required>
            <option value="">{t('venture.selectRetro')}</option>
            {retros.map(r => <option key={r.id} value={r.id}>{t('venture.week')} {r.week_number}/{r.year}</option>)}
          </select>
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.task_id || ''} onChange={e => setBlockerForm({ ...blockerForm, task_id: e.target.value })} required>
            <option value="">{t('venture.tasks')}</option>
            {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.title}</option>)}
          </select>
          <input placeholder={t('venture.namePlaceholder')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.title || ''} onChange={e => setBlockerForm({ ...blockerForm, title: e.target.value })} required />
          <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={blockerForm.description || ''} onChange={e => setBlockerForm({ ...blockerForm, description: e.target.value })} />
          <input placeholder="Supporting URL (optional)" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={blockerForm.supporting_url || ''} onChange={e => setBlockerForm({ ...blockerForm, supporting_url: e.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Standups Tab */
export function StandupsTab() {
  const { t } = useI18n();
  const { standups, setShowAddStandup, currentWeekStandup, params, currentWeekNum, currentWeekYear, tasks, fetchStandups, notifyMsg, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.standups')} ({standups.length})</h2>
          <button onClick={() => setShowAddStandup(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><MessageCircle size={16} /> {t('venture.addStandup')}</button>
        </div>
        {!currentWeekStandup && (
          <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/10" style={cardStyle}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-400">{t('venture.missingStandup') || 'Weekly Standup Not Submitted'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('venture.standupReminderDesc') || 'Submit your standup for this week (Monday: Weekly Focus, Planned Activities, Expected Deliverables).'}</p>
              </div>
              <button onClick={async () => { await fetch(`/api/ventures/${params.id}/standups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week_number: currentWeekNum || 1, year: currentWeekYear || 2026, top_priorities: '', expected_deliverables: '', weekly_priorities: '' }) }).then(r => { if (r.status === 409) notifyMsg('Already exists'); }); fetchStandups(); }} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('venture.submitNow') || 'Submit Now'}</button>
            </div>
          </div>
        )}
        {!currentWeekStandup && standups.length > 0 && (
          <div className="rounded-xl p-3 border border-red-500/20 bg-red-500/5" style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.missedReportNotify') || 'No standup for this week. Notify your mentor about the delay.'}</p>
              <button onClick={async () => { await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venture_id: params.id, type: 'missed_standup', week: currentWeekNum, year: currentWeekYear }) }); notifyMsg('Mentor notified!'); }} className="text-xs px-2 py-1 rounded bg-red-600/30 text-red-400 hover:bg-red-600/50">{t('venture.notifyMentor') || 'Notify Mentor'}</button>
            </div>
          </div>
        )}
        {standups.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          standups.map(s => { const now = new Date(s.year, 0, 1); const linkedTasks = tasks.filter(tk => { if (!tk.created_at) return false; const d = new Date(tk.created_at); const soy = new Date(d.getFullYear(), 0, 1); const w = Math.ceil((((d - soy) / 86400000) + soy.getDay() + 1) / 7); return w === s.week_number && d.getFullYear() === s.year; }); return (<div key={s.id} className="rounded-xl p-4 border" style={cardStyle}>
            <p className="font-semibold">Week {s.week_number}, {s.year}</p>
            {s.top_priorities && <div className="mt-2"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.topPriorities')}:</span><p className="text-sm">{s.top_priorities}</p></div>}
            {s.expected_deliverables && <div className="mt-2"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.expectedDeliverables')}:</span><p className="text-sm">{s.expected_deliverables}</p></div>}
            {linkedTasks.length > 0 && <div className="mt-3 pt-2 border-t" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.tasks')} ({linkedTasks.length}):</span>{linkedTasks.map(tk => <div key={tk.id} className="text-sm mt-1 flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${tk.status === 'done' ? 'bg-green-400' : tk.status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-400'}`} />{tk.title}</div>)}</div>}
          </div>); })
        }
      </div>
      <AddStandupModal />
    </>
  );
}

/* Retros Tab */
export function RetrosTab() {
  const { t } = useI18n();
  const { retros, setShowAddRetro, currentWeekRetro, params, currentWeekNum, currentWeekYear, tasks, fetchRetros, notifyMsg, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.retros')} ({retros.length})</h2>
          <button onClick={() => setShowAddRetro(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><RotateCcw size={16} /> {t('venture.addRetro')}</button>
        </div>
        {!currentWeekRetro && (
          <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/10" style={cardStyle}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-400">{t('venture.missingRetro') || 'Weekly Retro Not Submitted'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('venture.retroReminderDesc') || 'Submit your retro for this week (Friday: Progress Summary, Completed Activities, Current Challenges, Support Required, Next Week Focus).'}</p>
              </div>
              <button onClick={async () => { await fetch(`/api/ventures/${params.id}/retros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week_number: currentWeekNum || 1, year: currentWeekYear || 2026 }) }).then(r => { if (r.status === 409) notifyMsg('Already exists'); }); fetchRetros(); }} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('venture.submitNow') || 'Submit Now'}</button>
            </div>
          </div>
        )}
        {!currentWeekRetro && retros.length > 0 && (
          <div className="rounded-xl p-3 border border-red-500/20 bg-red-500/5" style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.missedReportNotify') || 'No retro for this week. Notify your mentor about the delay.'}</p>
              <button onClick={async () => { await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venture_id: params.id, type: 'missed_retro', week: currentWeekNum, year: currentWeekYear }) }); notifyMsg('Mentor notified!'); }} className="text-xs px-2 py-1 rounded bg-red-600/30 text-red-400 hover:bg-red-600/50">{t('venture.notifyMentor') || 'Notify Mentor'}</button>
            </div>
          </div>
        )}
        {retros.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          retros.map(r => { const linkedTasks = tasks.filter(tk => tk.status === 'done' && tk.created_at && (() => { const d = new Date(tk.created_at); const soy = new Date(d.getFullYear(), 0, 1); const w = Math.ceil((((d - soy) / 86400000) + soy.getDay() + 1) / 7); return w === r.week_number && d.getFullYear() === r.year; })()); return (<div key={r.id} className="rounded-xl p-4 border" style={cardStyle}>
            <p className="font-semibold">Week {r.week_number}, {r.year}</p>
            {r.completed_tasks && <div className="mt-2"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.completedTasks')}:</span><p className="text-sm">{r.completed_tasks}</p></div>}
            {r.outstanding_tasks && <div className="mt-2"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.outstandingTasks')}:</span><p className="text-sm">{r.outstanding_tasks}</p></div>}
            {r.carry_forward_notes && <div className="mt-2"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.carryForwardNotes')}:</span><p className="text-sm">{r.carry_forward_notes}</p></div>}
            {linkedTasks.length > 0 && <div className="mt-3 pt-2 border-t" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.linkedCompletedTasks')} ({linkedTasks.length}):</span>{linkedTasks.map(tk => <div key={tk.id} className="text-sm mt-1 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{tk.title}</div>)}</div>}
          </div>); })
        }
      </div>
      <AddRetroModal />
    </>
  );
}

/* Blockers Tab */
export function BlockersTab() {
  const { t } = useI18n();
  const { blockers, setShowAddBlocker, handleResolveBlocker, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.blockers')} ({blockers.length})</h2>
          <button onClick={() => setShowAddBlocker(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><AlertTriangle size={16} /> {t('venture.addBlocker')}</button>
        </div>
        {blockers.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          blockers.map(b => (
            <div key={b.id} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{b.title}</p>
                  {b.description && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{b.description}</p>}
                  {b.supporting_url && <a href={b.supporting_url} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-block text-blue-400 hover:underline break-all">{b.supporting_url}</a>}
                </div>
                {b.status === 'resolved' ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1 shrink-0 ml-2"><span>✓</span> {t('venture.resolved')}</span>
                ) : (
                  <button onClick={() => handleResolveBlocker(b.id)} className="text-xs px-3 py-1 rounded-lg shrink-0 ml-2" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}>{t('venture.resolve')}</button>
                )}
              </div>
            </div>
          ))
        }
      </div>
      <AddBlockerModal />
    </>
  );
}
