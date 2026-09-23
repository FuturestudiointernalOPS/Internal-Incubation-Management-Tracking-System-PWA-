"use client";

import { Lightbulb, Target, TrendingUp, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Add Interview Modal */
function AddInterviewModal() {
  const { t } = useI18n();
  const { showAddInterview, setShowAddInterview, params, user, interviewForm, setInterviewForm, fetchInterviews, inputStyle } = useVenture();
  if (!showAddInterview) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddInterview(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addInterview')}</h2><button onClick={() => setShowAddInterview(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); await fetch(`/api/ventures/${params.id}/interviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...interviewForm, created_by: user.cid }) }); setShowAddInterview(false); setInterviewForm({}); fetchInterviews(); }} className="space-y-3">
          <input placeholder={t('venture.interviewee')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={interviewForm.interviewee_name || ''} onChange={event => setInterviewForm({ ...interviewForm, interviewee_name: event.target.value })} />
          <input placeholder={t('venture.segment')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={interviewForm.customer_segment || ''} onChange={event => setInterviewForm({ ...interviewForm, customer_segment: event.target.value })} />
          <input type="date" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={interviewForm.interview_date || ''} onChange={event => setInterviewForm({ ...interviewForm, interview_date: event.target.value })} />
          <textarea placeholder={t('venture.notes')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={interviewForm.notes || ''} onChange={event => setInterviewForm({ ...interviewForm, notes: event.target.value })} />
          <textarea placeholder={t('venture.insights')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={interviewForm.insights || ''} onChange={event => setInterviewForm({ ...interviewForm, insights: event.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Add Validation Modal */
function AddValidationModal() {
  const { t } = useI18n();
  const { showAddValidation, setShowAddValidation, params, validationForm, setValidationForm, fetchValidations, inputStyle } = useVenture();
  if (!showAddValidation) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddValidation(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addEntry')}</h2><button onClick={() => setShowAddValidation(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); await fetch(`/api/ventures/${params.id}/validations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validation_type: validationForm.type, notes: validationForm.notes, status: validationForm.status }) }); setShowAddValidation(false); setValidationForm({ type: 'problem' }); fetchValidations(); }} className="space-y-3">
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={validationForm.type} onChange={event => setValidationForm({ ...validationForm, type: event.target.value })}>
            {['problem', 'solution', 'product'].map(validationType => <option key={validationType} value={validationType}>{t(`venture.${validationType}`)}</option>)}
          </select>
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={validationForm.status || 'in_progress'} onChange={event => setValidationForm({ ...validationForm, status: event.target.value })}>
            {['not_started', 'in_progress', 'validated', 'invalidated'].map(status => { const translationKey = { not_started: 'notStarted', in_progress: 'inProgress' }[status] || status; return <option key={status} value={status}>{t(`venture.${translationKey}`)}</option>; })}
          </select>
          <textarea placeholder={t('venture.notes')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} value={validationForm.notes || ''} onChange={event => setValidationForm({ ...validationForm, notes: event.target.value })} />
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Add PMF Modal */
function AddPmfModal() {
  const { t } = useI18n();
  const { showAddPmf, setShowAddPmf, params, pmfForm, setPmfForm, fetchPmf, inputStyle } = useVenture();
  if (!showAddPmf) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddPmf(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.addAssessment')}</h2><button onClick={() => setShowAddPmf(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); await fetch(`/api/ventures/${params.id}/pmf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pmfForm) }); setShowAddPmf(false); setPmfForm({}); fetchPmf(); }} className="space-y-3">
          <textarea placeholder={t('venture.feedback')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={pmfForm.customer_feedback || ''} onChange={event => setPmfForm({ ...pmfForm, customer_feedback: event.target.value })} />
          <textarea placeholder={t('venture.improvements')} className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} value={pmfForm.improvements || ''} onChange={event => setPmfForm({ ...pmfForm, improvements: event.target.value })} />
          <div><label className="block text-sm mb-1">{t('venture.progress')}: {pmfForm.pmf_progress || 0}%</label><input type="range" min="0" max="100" className="w-full" value={pmfForm.pmf_progress || 0} onChange={event => setPmfForm({ ...pmfForm, pmf_progress: parseInt(event.target.value) })} /></div>
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Discovery Tab */
export function DiscoveryTab() {
  const { t } = useI18n();
  const { interviews, setShowAddInterview, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.discovery')} ({interviews.length})</h2>
          <button onClick={() => setShowAddInterview(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><Lightbulb size={16} /> {t('venture.addInterview')}</button>
        </div>
        {interviews.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>No interviews yet</div>) :
          interviews.map((interview, index) => (
            <div key={index} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex justify-between">
                <div><p className="font-medium">{interview.interviewee_name || 'Unknown'}</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{interview.customer_segment} {interview.interview_date && `• ${new Date(interview.interview_date).toLocaleDateString()}`}</p></div>
              </div>
              {interview.notes && <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{interview.notes}</p>}
              {interview.insights && <p className="text-sm mt-1" style={{ color: 'var(--brand-orange)' }}>💡 {interview.insights}</p>}
            </div>
          ))
        }
      </div>
      <AddInterviewModal />
    </>
  );
}

/* Validation Tab */
export function ValidationTab() {
  const { t } = useI18n();
  const { validations, setShowAddValidation, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.validation')} ({validations.length})</h2>
          <button onClick={() => setShowAddValidation(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><Target size={16} /> {t('venture.addEntry')}</button>
        </div>
        {['problem', 'solution', 'product'].map(type => {
          const items = validations.filter(validation => validation.validation_type === type);
          return <div key={type} className="rounded-xl p-4 border" style={cardStyle}>
            <h3 className="font-semibold capitalize mb-2">{t(`venture.${type}`)}</h3>
            {items.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No entries</p>}
            {items.map(validation => (
              <div key={validation.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'rgb(255 255 255 / 0.05)' }}>
                <div><p className="text-sm">{validation.notes || '—'}</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(validation.created_at).toLocaleDateString()}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${validation.status === 'validated' ? 'bg-green-500/20 text-green-400' : validation.status === 'invalidated' ? 'bg-red-500/20 text-red-400' : validation.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'}`}>
                  {t(`venture.${({ not_started: 'notStarted', in_progress: 'inProgress', validated: 'validated', invalidated: 'invalidated' })[validation.status] || validation.status || 'notStarted'}`)}
                </span>
              </div>
            ))}
          </div>;
        })}
      </div>
      <AddValidationModal />
    </>
  );
}

/* PMF Tab */
export function PmfTab() {
  const { t } = useI18n();
  const { assessments, setShowAddPmf, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.pmf')} ({assessments.length})</h2>
          <button onClick={() => setShowAddPmf(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><TrendingUp size={16} /> {t('venture.addAssessment')}</button>
        </div>
        {assessments.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>No assessments yet</div>) :
          assessments.map((assessment, index) => (
            <div key={index} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(assessment.created_at).toLocaleDateString()}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--brand-orange)' }}>{assessment.pmf_progress || 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 mb-2"><div className="h-full rounded-full transition-all" style={{ width: `${assessment.pmf_progress || 0}%`, backgroundColor: 'var(--brand-orange)' }} /></div>
              {assessment.customer_feedback && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>📝 {assessment.customer_feedback}</p>}
              {assessment.improvements && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>🔧 {assessment.improvements}</p>}
            </div>
          ))
        }
      </div>
      <AddPmfModal />
    </>
  );
}
