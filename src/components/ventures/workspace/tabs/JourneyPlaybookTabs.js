"use client";

import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Journey Tab */
export function JourneyTab() {
  const { t } = useI18n();
  const { journeyStages, handleCompleteStage, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.standardJourney') || 'Standard Venture Journey'}</h2>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('venture.journeyDesc') || 'Complete each stage to progress your venture. Stages unlock as the previous one is approved by your mentor.'}</p>
      <div className="space-y-2">
        {journeyStages.map((stage, i) => (
          <div key={stage.id} className={`rounded-xl p-4 border flex items-center gap-4 ${stage.status === 'locked' ? 'opacity-50' : ''}`} style={cardStyle}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              stage.status === 'completed' ? 'bg-green-600 text-white' :
              stage.status === 'active' ? 'bg-blue-600 text-white' :
              'bg-gray-700 text-gray-400'
            }`}>
              {stage.status === 'completed' ? '✓' : stage.stage_order}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${stage.status === 'completed' ? 'line-through' : ''}`} style={{ color: stage.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{stage.name}</p>
              {stage.description && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stage.description}</p>}
              {stage.completed_at && <p className="text-xs mt-1" style={{ color: '#22c55e' }}>✓ {new Date(stage.completed_at).toLocaleDateString()}</p>}
            </div>
            {stage.status === 'active' && (
              <button onClick={() => handleCompleteStage(stage.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700">
                {t('venture.markCompleted') || 'Mark Completed'}
              </button>
            )}
            {stage.status === 'locked' && (
              <span className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.1)' }}>🔒 {t('venture.locked') || 'Locked'}</span>
            )}
          </div>
        ))}
      </div>
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
