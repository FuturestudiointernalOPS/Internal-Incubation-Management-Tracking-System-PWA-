"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

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
