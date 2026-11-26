"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Manager attention block (Vinance 3 Phase 2, doc §5) — what needs attention right now. */
export default function AttentionWidget({ id }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${id}/journey-report`);
        const payload = await res.json();
        if (payload.success) setData(payload.journey_report);
        else setError(payload.error || "failed");
      } catch (_) {
        setError("failed");
      }
    })();
  }, [id]);

  const overdue = (data?.overdue || []).length;
  const awaitingReview = (data?.tasks_by_status || {}).review || 0;
  const awaitingDeliverables = data?.deliverables_awaiting_review || 0;
  const upcomingSessions = data?.sessions?.upcoming || 0;
  const awaitingApproval = (data?.milestones_by_status || {}).under_review || 0;
  const stageTotal = data?.journey_progression?.total || 0;
  const stagePct = data?.journey_progression?.progress_pct || 0;
  const currentJourney = (data?.stages || []).find((stage) => stage.status === "active")?.name || (data?.stages || [])[0]?.name || null;

  const items = [
    { n: overdue, label: t("venture.attention.overdue") },
    { n: awaitingReview, label: t("venture.attention.awaitingReview") },
    ...(awaitingDeliverables > 0
      ? [{ n: awaitingDeliverables, label: t("venture.attention.awaitingDeliverables", { n: awaitingDeliverables }) }]
      : []),
    { n: upcomingSessions, label: t("venture.attention.upcomingSessions") },
    { n: awaitingApproval, label: t("venture.attention.awaitingApproval") },
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{t("venture.attention.title")}</h3>
        {stageTotal > 0 && (
          <span className="text-[9px] font-bold text-slate-500">{t("venture.attention.journeyProgress")}: {stagePct}%</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-rose-400">{t("venture.attention.failed")}</p>
      ) : !data ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" /></div>
      ) : (
        <>
          {currentJourney && (
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              {t("venture.attention.currentJourney")}: <span className="font-bold text-[var(--text-primary)]">{currentJourney}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className={`text-xl font-black ${item.n > 0 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>{item.n}</p>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{item.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
