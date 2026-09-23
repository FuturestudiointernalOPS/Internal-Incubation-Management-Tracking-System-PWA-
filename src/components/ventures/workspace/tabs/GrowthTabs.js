"use client";

import { GraduationCap, Award, Gauge, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { useDialogs } from "@/components/ui/DialogProvider";

/* Add Advisor Modal */
function AddAdvisorModal() {
  const { t } = useI18n();
  const { showAddAdvisor, setShowAddAdvisor, params, advisorForm, setAdvisorForm, fetchAdvisors, notifyMsg, inputStyle } = useVenture();
  if (!showAddAdvisor) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddAdvisor(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addAdvisor')}</h2><button onClick={() => setShowAddAdvisor(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); const res = await fetch(`/api/ventures/${params.id}/advisors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(advisorForm) }); const payload = await res.json(); if (!payload.success) notifyMsg(t(payload.error || "") || payload.error); setShowAddAdvisor(false); setAdvisorForm({}); fetchAdvisors(); }} className="space-y-3">
          <input placeholder="Advisor contact ID (cid)" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={advisorForm.advisor_contact_id || ''} onChange={event => setAdvisorForm({ ...advisorForm, advisor_contact_id: event.target.value })} required />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Add Coaching Session Modal */
function AddCoachingModal() {
  const { t } = useI18n();
  const { showAddCoaching, setShowAddCoaching, params, coachingForm, setCoachingForm, advisors, fetchCoaching, inputStyle } = useVenture();
  if (!showAddCoaching) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddCoaching(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addSession')}</h2><button onClick={() => setShowAddCoaching(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); await fetch(`/api/ventures/${params.id}/coaching`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coachingForm) }); setShowAddCoaching(false); setCoachingForm({}); fetchCoaching(); }} className="space-y-3">
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.advisor_contact_id || ''} onChange={event => setCoachingForm({ ...coachingForm, advisor_contact_id: event.target.value })}>
            <option value="">{t('venture.advisors')}</option>
            {advisors.map(advisor => <option key={advisor.id} value={advisor.advisor_contact_id}>{advisor.advisor_name || advisor.advisor_contact_id}</option>)}
          </select>
          <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.session_date || ''} onChange={event => setCoachingForm({ ...coachingForm, session_date: event.target.value })} />
          <input type="time" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.start_time || ''} onChange={event => setCoachingForm({ ...coachingForm, start_time: event.target.value })} placeholder="HH:MM" />
          <input type="text" placeholder="Location" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.location || ''} onChange={event => setCoachingForm({ ...coachingForm, location: event.target.value })} />
          <input type="url" placeholder="Meeting Link" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.meeting_link || ''} onChange={event => setCoachingForm({ ...coachingForm, meeting_link: event.target.value })} />
          <div><label className="block text-sm mb-1">{t('venture.followUpDate') || 'Follow-up Date'}</label><input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.follow_up_date || ''} onChange={event => setCoachingForm({ ...coachingForm, follow_up_date: event.target.value })} /></div>
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Edit Coaching Session Modal */
function EditCoachingModal() {
  const { t } = useI18n();
  const { showEditCoaching, editingCoaching, setShowEditCoaching, setEditingCoaching, coachingForm, setCoachingForm, params, fetchCoaching, inputStyle } = useVenture();
  if (!showEditCoaching || !editingCoaching) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => { setShowEditCoaching(false); setEditingCoaching(null); }}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.edit')} Session</h2><button onClick={() => { setShowEditCoaching(false); setEditingCoaching(null); }} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); const body = { ...coachingForm, session_date: coachingForm.session_date || editingCoaching.session_date, start_time: coachingForm.start_time || editingCoaching.start_time, location: coachingForm.location || editingCoaching.location, meeting_link: coachingForm.meeting_link || editingCoaching.meeting_link, follow_up_date: coachingForm.follow_up_date || editingCoaching.follow_up_date }; await fetch(`/api/ventures/${params.id}/coaching?id=${editingCoaching.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setShowEditCoaching(false); setEditingCoaching(null); setCoachingForm({}); fetchCoaching(); }} className="space-y-3">
          <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.session_date || editingCoaching.session_date || ''} onChange={event => setCoachingForm({ ...coachingForm, session_date: event.target.value })} />
          <input type="time" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.start_time || editingCoaching.start_time || ''} onChange={event => setCoachingForm({ ...coachingForm, start_time: event.target.value })} />
          <input type="text" placeholder="Location" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.location || editingCoaching.location || ''} onChange={event => setCoachingForm({ ...coachingForm, location: event.target.value })} />
          <input type="url" placeholder="Meeting Link" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.meeting_link || editingCoaching.meeting_link || ''} onChange={event => setCoachingForm({ ...coachingForm, meeting_link: event.target.value })} />
          <div><label className="block text-sm mb-1">{t('venture.followUpDate') || 'Follow-up Date'}</label><input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={coachingForm.follow_up_date || editingCoaching.follow_up_date || ''} onChange={event => setCoachingForm({ ...coachingForm, follow_up_date: event.target.value })} /></div>
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Create KPI Definition Modal */
function CreateKpiDefinitionModal() {
  const { t } = useI18n();
  const { showAddKpiDefinition, setShowAddKpiDefinition, editingKpiDef, setEditingKpiDef, kpiDefForm, setKpiDefForm, fetchKpiDefinitions, fetchKpis, inputStyle } = useVenture();
  if (!showAddKpiDefinition) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddKpiDefinition(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{editingKpiDef ? t('venture.edit') : t('venture.create')} KPI</h2><button onClick={() => { setShowAddKpiDefinition(false); setEditingKpiDef(null); setKpiDefForm({}); }} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); const method = editingKpiDef ? 'PATCH' : 'POST'; const url = editingKpiDef ? '/api/venture-kpi-definitions' : '/api/venture-kpi-definitions'; const body = editingKpiDef ? { ...kpiDefForm, id: editingKpiDef.id } : kpiDefForm; await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setShowAddKpiDefinition(false); setEditingKpiDef(null); setKpiDefForm({}); fetchKpiDefinitions(); fetchKpis(); }} className="space-y-3">
          <input placeholder="KPI Name" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiDefForm.name || ''} onChange={event => setKpiDefForm({ ...kpiDefForm, name: event.target.value })} required />
          <textarea placeholder={t('venture.description')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={kpiDefForm.description || ''} onChange={event => setKpiDefForm({ ...kpiDefForm, description: event.target.value })} />
          <input placeholder={t('venture.unit')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiDefForm.unit || ''} onChange={event => setKpiDefForm({ ...kpiDefForm, unit: event.target.value })} />
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiDefForm.auto_calc_source || ''} onChange={event => setKpiDefForm({ ...kpiDefForm, auto_calc_source: event.target.value })}>
            <option value="">{t('venture.manualEntry')}</option>
            <option value="customer_interviews">{t('venture.autoCalculated')} — Customer Interviews</option>
            <option value="milestones">{t('venture.autoCalculated')} — Milestones</option>
            <option value="tasks">{t('venture.autoCalculated')} — Tasks</option>
          </select>
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Assign KPI Modal */
function AssignKpiModal() {
  const { t } = useI18n();
  const { showAddKpi, setShowAddKpi, params, kpiForm, setKpiForm, kpiDefinitions, fetchKpis, notifyMsg, inputStyle } = useVenture();
  if (!showAddKpi) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddKpi(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.assignKpi')}</h2><button onClick={() => setShowAddKpi(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); const res = await fetch(`/api/ventures/${params.id}/kpis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kpiForm) }); const payload = await res.json(); if (!payload.success) notifyMsg(t(payload.error || "") || payload.error); setShowAddKpi(false); setKpiForm({}); fetchKpis(); }} className="space-y-3">
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiForm.kpi_definition_id || ''} onChange={event => setKpiForm({ ...kpiForm, kpi_definition_id: event.target.value })} required>
            <option value="">{t('venture.kpis')}</option>
            {kpiDefinitions.map(definition => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
          </select>
          <input type="number" placeholder={t('venture.target')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={kpiForm.target_value || ''} onChange={event => setKpiForm({ ...kpiForm, target_value: event.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Advisors Tab */
export function AdvisorsTab() {
  const { t } = useI18n();
  const { advisors, setShowAddAdvisor, handleMakePrimaryAdvisor, handleRemoveAdvisor, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.advisors')} ({advisors.length})</h2>
          <button onClick={() => setShowAddAdvisor(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><GraduationCap size={16} /> {t('venture.addAdvisor')}</button>
        </div>
        {advisors.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          advisors.map(advisor => (
            <div key={advisor.id} className="rounded-xl p-4 border flex items-center justify-between" style={cardStyle}>
              <div><p className="font-medium">{advisor.advisor_name || advisor.advisor_contact_id}</p></div>
              <div className="flex items-center gap-2">
                {advisor.is_primary ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{t('venture.primary')}</span>
                ) : (
                  <button onClick={() => handleMakePrimaryAdvisor(advisor.id)} className="text-xs px-3 py-1 rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}>{t('venture.makePrimary')}</button>
                )}
                <button onClick={() => handleRemoveAdvisor(advisor.id)} className="text-xs px-3 py-1 rounded-lg" style={{ color: '#ef4444', border: '1px solid rgb(239 68 68 / 0.3)' }}>{t('venture.remove')}</button>
              </div>
            </div>
          ))
        }
      </div>
      <AddAdvisorModal />
    </>
  );
}

/* Coaching Tab — founder-facing (scheduling only). Sessions show who, when,
   where and the follow-up date so founders know what is next. Facilitator
   notes/observations/recommendations and staff review actions are
   intentionally not rendered for founders. */
export function CoachingTab() {
  const { t } = useI18n();
  const { coachingSessions, setShowAddCoaching, setEditingCoaching, setShowEditCoaching, setCoachingForm, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.coaching')} ({coachingSessions.length})</h2>
          <button onClick={() => setShowAddCoaching(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><Award size={16} /> {t('venture.addSession')}</button>
        </div>
        {coachingSessions.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          coachingSessions.map(session => (
            <div key={session.id} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{session.advisor_name || session.advisor_contact_id} {session.session_date && `• ${new Date(session.session_date).toLocaleDateString()}`}{session.start_time && ` at ${session.start_time}`}</p>
                <button onClick={() => { setEditingCoaching(session); setShowEditCoaching(true); setCoachingForm({}); }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--brand-orange)', border: '1px solid var(--brand-orange)' }}>{t('venture.edit')}</button>
              </div>
              {session.location && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>📍 {session.location}</p>}
              {session.meeting_link && <p className="text-xs mt-1"><a href={session.meeting_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">🔗 {session.meeting_link}</a></p>}
              {session.follow_up_date && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>📅 {t('venture.followUpDate') || 'Follow-up Date'}: {new Date(session.follow_up_date).toLocaleDateString()}</p>}
            </div>
          ))
        }
      </div>
      <AddCoachingModal />
      <EditCoachingModal />
    </>
  );
}

/* KPIs Tab */
export function KpisTab() {
  const { t } = useI18n();
  const { prompt } = useDialogs();
  const { kpis, kpiDefinitions, setShowAddKpiDefinition, setShowAddKpi, setKpiDefForm, setEditingKpiDef, handleUpdateKpi, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.kpis')} ({kpis.length})</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddKpiDefinition(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}><Gauge size={16} /> {t('venture.create')}</button>
            <button onClick={() => setShowAddKpi(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><Gauge size={16} /> {t('venture.assignKpi')}</button>
          </div>
        </div>
        {kpis.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          kpis.map(kpi => (
            <div key={kpi.id} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{kpi.name}</p>
                  <button onClick={() => { const kpiDefinition = kpiDefinitions.find(entry => entry.id === kpi.kpi_definition_id); if (kpiDefinition) { setKpiDefForm(kpiDefinition); setEditingKpiDef(kpiDefinition); setShowAddKpiDefinition(true); } }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--brand-orange)', border: '1px solid var(--brand-orange)' }}>{t('venture.edit')}</button>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{kpi.auto_calc_source ? t('venture.autoCalculated') : t('venture.manualEntry')}</span>
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('venture.current')}: {kpi.current_value ?? 0}{kpi.target_value && ` / ${t('venture.target')}: ${kpi.target_value}`} {kpi.unit}</p>
              {!kpi.auto_calc_source && (
                <button onClick={async () => { const newValue = await prompt({ message: t('venture.updateValue'), defaultValue: kpi.current_value || 0, required: false }); if (newValue !== null) handleUpdateKpi(kpi.id, parseFloat(newValue) || 0); }}
                  className="text-xs px-3 py-1 mt-2 rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}>{t('venture.updateValue')}</button>
              )}
            </div>
          ))
        }
      </div>
      <CreateKpiDefinitionModal />
      <AssignKpiModal />
    </>
  );
}

/* Investment Readiness Tab */
export function InvestmentTab() {
  const { t } = useI18n();
  const { investmentReadiness, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      {/* Roadmap-derived readiness (Phase 2): what the Venture is evaluated on */}
      <RoadmapReadinessCard />
      <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.investmentReadiness') || 'Investment Readiness'}</h2>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('venture.investmentDesc') || 'Documents required before a venture can be introduced to investors.'}</p>
      {investmentReadiness ? (
        <>
          <div className={`rounded-xl p-6 border ${investmentReadiness.is_investment_ready ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}`} style={cardStyle}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold" style={{ color: investmentReadiness.is_investment_ready ? '#22c55e' : '#f59e0b' }}>
                  {investmentReadiness.is_investment_ready ? (t('venture.investmentReady') || '✅ Investment Ready') : (t('venture.notReady') || '⏳ Not Yet Ready')}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {investmentReadiness.approved_count}/{investmentReadiness.total_required} {t('venture.documentsApproved') || 'documents approved'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: investmentReadiness.is_investment_ready ? '#22c55e' : 'var(--brand-orange)' }}>
                  {investmentReadiness.readiness_percent}%
                </p>
              </div>
            </div>
            <div className="mt-3 w-full bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{
                width: `${investmentReadiness.readiness_percent}%`,
                backgroundColor: investmentReadiness.is_investment_ready ? '#22c55e' : 'var(--brand-orange)'
              }} />
            </div>
          </div>
          <div className="space-y-2">
            {investmentReadiness.checklist.map(item => (
              <div key={item.key} className={`rounded-xl p-4 border flex items-center gap-4 ${item.status === 'approved' ? 'border-green-500/20 bg-green-500/5' : item.status === 'submitted' ? 'border-amber-500/20 bg-amber-500/5' : 'opacity-60'}`} style={cardStyle}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${item.status === 'approved' ? 'bg-green-600/30' : item.status === 'submitted' ? 'bg-amber-600/30' : 'bg-gray-700'}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.status === 'approved' ? '✅ Approved' : item.status === 'submitted' ? (item.documents?.length ? `📄 ${item.documents.length} document(s) awaiting approval` : '📝 Submitted') : '❌ Missing'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${item.status === 'approved' ? 'bg-green-500/20 text-green-400' : item.status === 'submitted' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                  {item.status === 'approved' ? '✓' : item.status === 'submitted' ? '⏳' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: 'var(--text-secondary)' }} size={24} /></div>
      )}
    </div>
  );
}

/* Roadmap readiness — what the Founder is being evaluated on (Phase 2). */
export function RoadmapReadinessCard() {
  const { t } = useI18n();
  const { investmentReadiness, cardStyle } = useVenture();
  const roadmapReadiness = investmentReadiness?.roadmap_readiness;
  if (!roadmapReadiness) return null;
  const rows = [
    { key: 'journeys', label: t('venture.manager.irJourneys'), pct: roadmapReadiness.components.journeys },
    { key: 'milestones', label: t('venture.manager.irMilestones'), pct: roadmapReadiness.components.milestones },
    { key: 'tasks', label: t('venture.manager.irTasks'), pct: roadmapReadiness.components.tasks },
    { key: 'deliverables', label: t('venture.manager.irDeliverables'), pct: roadmapReadiness.components.deliverables },
  ];
  return (
    <div className="rounded-xl p-5 border" style={cardStyle}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">{t('venture.manager.irTracked')}</h3>
        <span className="text-2xl font-black" style={{ color: 'var(--brand-orange)' }}>{roadmapReadiness.overall_percent}%</span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.irTrackedDesc')}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span>{row.label}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{row.pct === null ? '—' : `${row.pct}%`}</span>
            </div>
            {row.pct !== null && (
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgb(255 255 255 / 0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: 'var(--brand-orange)' }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {roadmapReadiness.counts && (
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div><span className="font-bold">{roadmapReadiness.counts.milestones.completed}/{roadmapReadiness.counts.milestones.total}</span> {t('venture.manager.irMilestonesDone')}</div>
          <div><span className="font-bold">{roadmapReadiness.counts.tasks.completed}/{roadmapReadiness.counts.tasks.total}</span> {t('venture.manager.irTasksDone')}</div>
        </div>
      )}
    </div>
  );
}
