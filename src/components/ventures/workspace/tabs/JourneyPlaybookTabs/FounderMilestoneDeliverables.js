"use client";

import { useI18n } from "@/lib/i18n";
import { deliverableStatusWord, statusChipClass, statusLabel } from "@/lib/ventureStatuses";

/**
 * The deliverables under one milestone: evidence the Venture must submit for
 * review. Every value comes from the parent (`JourneyTab`), which owns the
 * drafts and the submit action; this component only renders.
 *
 * ONE vocabulary, shared with the Venture Manager and Super Admin views
 * (`lib/ventureStatuses`) — the status chip is resolved through the same words.
 */
export default function FounderMilestoneDeliverables({ milestone, stage, dvDrafts, setDvDrafts, submitDeliverable }) {
  const { t } = useI18n();

  return (
    <>
      {(milestone.deliverables || []).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            {t('venture.manager.deliverables')}
          </p>
          {(milestone.deliverables || []).map((deliverable) => {
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
    </>
  );
}
