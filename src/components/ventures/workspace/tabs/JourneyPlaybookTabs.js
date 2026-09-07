"use client";

import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Journey Tab */
export function JourneyTab() {
  const { t } = useI18n();
  const { journeyStages, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.journey') || 'Journey'}</h2>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('venture.journeyDesc') || 'Your journey is defined by the team supporting your Venture.'}</p>
      {journeyStages.length === 0 ? (
        <div className="rounded-xl p-8 border text-center" style={cardStyle}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('venture.noJourneyYet') || 'No journey stages have been defined yet.'}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('venture.noJourneyYetDesc') || 'The team supporting your Venture will publish your journey soon.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {journeyStages.map((stage) => (
            <div key={stage.id} className={`rounded-xl p-4 border flex items-start gap-4 ${stage.status === 'locked' ? 'opacity-60' : ''}`} style={cardStyle}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                stage.status === 'completed' ? 'bg-green-600 text-white' :
                stage.status === 'active' ? 'bg-blue-600 text-white' :
                'bg-gray-700 text-gray-400'
              }`}>
                {stage.status === 'completed' ? '✓' : stage.stage_order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium ${stage.status === 'completed' ? 'line-through' : ''}`} style={{ color: stage.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{stage.name}</p>
                  {stage.status === 'active' && (
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">{t('venture.statuses.active')}</span>
                  )}
                  {stage.status === 'completed' && (
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-green-500/15 text-green-400">{t('venture.completed')}</span>
                  )}
                </div>
                {stage.description && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stage.description}</p>}
                {stage.objective && <p className="text-xs italic mt-1" style={{ color: 'var(--text-secondary)' }}>{stage.objective}</p>}
                <div className="flex items-center gap-3 mt-1 text-[11px]">
                  {stage.target_date && (
                    <span style={{ color: 'var(--text-secondary)' }}>{t('venture.targetDate')}: {new Date(`${stage.target_date}T00:00:00`).toLocaleDateString()}</span>
                  )}
                  {stage.completed_at && <span style={{ color: '#22c55e' }}>✓ {new Date(stage.completed_at).toLocaleDateString()}</span>}
                  {stage.status === 'locked' && (
                    <span style={{ color: 'var(--text-secondary)' }}>🔒 {t('venture.locked') || 'Locked'}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
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
