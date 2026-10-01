"use client";

import { useI18n } from "@/lib/i18n";
import { useVenture } from "@/components/ventures/workspace/VentureContext";

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
