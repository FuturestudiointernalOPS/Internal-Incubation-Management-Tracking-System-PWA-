"use client";

import { CheckSquare, ListChecks, ListTodo, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Add Milestone Modal */
function AddMilestoneModal() {
  const { t } = useI18n();
  const { showAddMilestone, setShowAddMilestone, params, milestoneForm, setMilestoneForm, fetchMilestones, inputStyle } = useVenture();
  if (!showAddMilestone) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddMilestone(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addMilestone')}</h2><button onClick={() => setShowAddMilestone(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async e => { e.preventDefault(); await fetch(`/api/ventures/${params.id}/milestones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(milestoneForm) }); setShowAddMilestone(false); setMilestoneForm({}); fetchMilestones(); }} className="space-y-3">
          <input placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={milestoneForm.title || ''} onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })} required />
          <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={milestoneForm.description || ''} onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })} />
          <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={milestoneForm.target_date || ''} onChange={e => setMilestoneForm({ ...milestoneForm, target_date: e.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Add Action Plan Modal */
function AddActionModal() {
  const { t } = useI18n();
  const { showAddAction, setShowAddAction, params, actionForm, setActionForm, milestones, fetchActionPlans, inputStyle } = useVenture();
  if (!showAddAction) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddAction(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addAction')}</h2><button onClick={() => setShowAddAction(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async e => { e.preventDefault(); await fetch(`/api/ventures/${params.id}/action-plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actionForm) }); setShowAddAction(false); setActionForm({}); fetchActionPlans(); }} className="space-y-3">
          <input placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.title || ''} onChange={e => setActionForm({ ...actionForm, title: e.target.value })} required />
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.priority || 'medium'} onChange={e => setActionForm({ ...actionForm, priority: e.target.value })}>
            {['low', 'medium', 'high'].map(p => <option key={p} value={p}>{t(`venture.${p}`)}</option>)}
          </select>
          <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.deadline || ''} onChange={e => setActionForm({ ...actionForm, deadline: e.target.value })} />
          {milestones.length > 0 && <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={actionForm.milestone_id || ''} onChange={e => setActionForm({ ...actionForm, milestone_id: e.target.value || null })}>
            <option value="">{t('venture.unassigned')}</option>
            {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>}
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Add Task Modal */
function AddTaskModal() {
  const { t } = useI18n();
  const { showAddTask, setShowAddTask, params, taskForm, setTaskForm, tasks, fetchTasks, inputStyle } = useVenture();
  if (!showAddTask) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddTask(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addTask')}</h2><button onClick={() => setShowAddTask(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async e => { e.preventDefault(); await fetch(`/api/ventures/${params.id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskForm) }); setShowAddTask(false); setTaskForm({}); fetchTasks(); }} className="space-y-3">
          <input placeholder={t('venture.namePlaceholder')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.title || ''} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required />
          <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={taskForm.description || ''} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.priority || 'medium'} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
            {['low', 'medium', 'high'].map(p => (<option key={p} value={p}>{t(`venture.${p}`)}</option>))}
          </select>
          {tasks.length > 0 && <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.parent_task_id || ''} onChange={e => setTaskForm({ ...taskForm, parent_task_id: e.target.value || null })}>
            <option value="">{t('venture.unassigned')}</option>
            {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.title}</option>)}
          </select>}
          <input placeholder={t('venture.assignedTo')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.assigned_cid || ''} onChange={e => setTaskForm({ ...taskForm, assigned_cid: e.target.value })} />
          <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={taskForm.due_date || ''} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Milestones Tab */
export function MilestonesTab() {
  const { t } = useI18n();
  const { milestones, actionPlans, setShowAddMilestone, params, fetchMilestones, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.milestones')} ({milestones.length})</h2>
          <button onClick={() => setShowAddMilestone(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><CheckSquare size={16} /> {t('venture.addMilestone')}</button>
        </div>
        {milestones.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>No milestones yet</div>) :
          milestones.map(m => {
            const plans = actionPlans.filter(p => p.milestone_id === m.id);
            return <div key={m.id} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-start justify-between">
                <div><h3 className="font-semibold">{m.title}</h3>{m.description && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{m.description}</p>}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'completed' ? 'bg-green-500/20 text-green-400' : m.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'}`}>{t(`venture.${{ not_started: 'notStarted', in_progress: 'inProgress', completed: 'completed' }[m.status] || m.status || 'notStarted'}`)}</span>
              </div>
              {m.target_date && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>🎯 {new Date(m.target_date).toLocaleDateString()}</p>}
              <div className="flex items-center gap-2 mt-2">
                <input type="range" min="0" max="100" value={m.progress || 0} onChange={async e => { const v = parseInt(e.target.value); await fetch(`/api/ventures/${params.id}/milestones?id=${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: v }) }); fetchMilestones(); }} className="flex-1" style={{ accentColor: 'var(--brand-orange)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--brand-orange)', minWidth: '2.5rem', textAlign: 'right' }}>{m.progress || 0}%</span>
              </div>
              {m.status !== 'completed' && (<button onClick={async () => { await fetch(`/api/ventures/${params.id}/milestones?id=${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed', progress: 100 }) }); fetchMilestones(); }} className="mt-2 text-xs px-2 py-1 rounded" style={{ border: '1px solid rgb(255 255 255 / 0.15)', color: 'var(--text-secondary)' }}>✓ Mark Completed</button>)}
              {plans.length > 0 && <div className="mt-2 space-y-1"><p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('venture.actionPlans')}:</p>{plans.map(p => (
                <div key={p.id} className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><span>• {p.title}</span><span className={`px-1.5 py-0.5 rounded ${p.priority === 'high' ? 'bg-red-500/20 text-red-400' : p.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{t(`venture.${p.priority}`)}</span></div>
              ))}</div>}
            </div>;
          })
        }
      </div>
      <AddMilestoneModal />
    </>
  );
}

/* Action Plans Tab */
export function ActionPlansTab() {
  const { t } = useI18n();
  const { actionPlans, setShowAddAction, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.actionPlans')} ({actionPlans.length})</h2>
          <button onClick={() => setShowAddAction(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><ListChecks size={16} /> {t('venture.addAction')}</button>
        </div>
        {actionPlans.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>No actions yet</div>) :
          actionPlans.map((p, i) => (
            <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-start justify-between">
                <div><h3 className="font-semibold">{p.title}</h3>{p.owner_name && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>👤 {p.owner_name}</p>}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'done' ? 'bg-green-500/20 text-green-400' : p.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'}`}>{t(`venture.${p.status || 'open'}`)}</span>
              </div>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded ${p.priority === 'high' ? 'bg-red-500/20 text-red-400' : p.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{t(`venture.${p.priority}`)}</span>
                {p.deadline && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>📅 {new Date(p.deadline).toLocaleDateString()}</span>}
              </div>
            </div>
          ))
        }
      </div>
      <AddActionModal />
    </>
  );
}

/* Tasks Tab */
export function TasksTab() {
  const { t } = useI18n();
  const { tasks, setShowAddTask, handleTaskStatusChange, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.tasks')} ({tasks.length})</h2>
          <button onClick={() => setShowAddTask(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><ListTodo size={16} /> {t('venture.addTask')}</button>
        </div>
        {tasks.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          tasks.map(tk => (
            <div key={tk.id} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{tk.title}</p>
                  {tk.parent_task_id && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>↳ {t('venture.subtaskOf')}: {tasks.find(p => p.id === tk.parent_task_id)?.title || tk.parent_task_id}</p>}
                  {tk.assigned_to && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('venture.assignedTo')}: {tk.assigned_to}</p>}
                  {tk.due_date && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>📅 {new Date(tk.due_date).toLocaleDateString()}</p>}
                </div>
                <select value={tk.status || 'backlog'} onChange={e => handleTaskStatusChange(tk.id, e.target.value)} className={`text-xs px-2 py-0.5 rounded-full outline-none cursor-pointer border-0 ${tk.status === 'done' ? 'bg-green-500/20 text-green-400' : tk.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : tk.status === 'review' ? 'bg-purple-500/20 text-purple-400' : tk.status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-slate-400'}`} style={{ appearance: 'none', WebkitAppearance: 'none' }}>
                  {['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked', 'cancelled'].map(s => <option key={s} value={s}>{t(`venture.${s}`)}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${tk.priority === 'high' ? 'bg-red-500/20 text-red-400' : tk.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{t(`venture.${tk.priority || 'medium'}`)}</span>
              </div>
            </div>
          ))
        }
      </div>
      <AddTaskModal />
    </>
  );
}
