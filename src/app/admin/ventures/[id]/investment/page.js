"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, TrendingUp, Rocket, Shield } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickVenture = (payload) => (payload?.success ? payload.venture : null);
const pickVerification = (payload) => (payload?.success ? payload : null);
const pickRoadmapReadiness = (payload) =>
  payload?.success && payload.roadmap_readiness ? payload.roadmap_readiness : null;
const pickDocumentTypes = (payload) =>
  payload?.success ? payload.document_types || [] : null;

const ITEM_STATUS_CONFIG = {
  pending: { label: "vadmin.verification.itemStatusPending", color: "text-slate-400 bg-slate-500/10" },
  under_review: { label: "vadmin.verification.itemStatusUnderReview", color: "text-amber-400 bg-amber-500/10" },
  verified: { label: "vadmin.verification.statusVerified", color: "text-emerald-400 bg-emerald-500/10" },
  rejected: { label: "vadmin.verification.statusRejected", color: "text-rose-400 bg-rose-500/10" },
  not_applicable: { label: "vadmin.verification.itemStatusNotApplicable", color: "text-slate-500 bg-slate-500/5" },
};

export default function VentureInvestmentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [openingDataBank, setOpeningDataBank] = useState(false);

  const { data: venture, loading: ventureLoading } = useApi(
    `/api/ventures/${id}`,
    { transform: pickVenture, deps: [id] },
  );
  const { data: verificationData, loading: verificationLoading } = useApi(
    `/api/ventures/${id}/verification`,
    { transform: pickVerification, deps: [id] },
  );
  const { data: configuredDocumentTypes } = useApi(
    `/api/ventures/${id}/document-types`,
    { transform: pickDocumentTypes, deps: [id], defaultValue: null },
  );
  const { data: roadmap, loading: roadmapLoading } = useApi(`/api/ventures/${id}/investment-readiness`, {
    transform: pickRoadmapReadiness,
    deps: [id],
  });

  const loading = ventureLoading || verificationLoading;

  const documentTypes = Array.isArray(configuredDocumentTypes)
    ? configuredDocumentTypes
    : DEFAULT_VENTURE_DOCUMENT_TYPES;

  const progressBar = (pct, color) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color || "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(pct || 0, 100)}%` }} />
    </div>
  );

  // Same mapping as the founder-facing RoadmapReadinessCard (GrowthTabs.js):
  // live components/counts straight from the readiness engine.
  const rrComponents = roadmap?.components || {};
  const rrCounts = roadmap?.counts || {};
  const roadmapComponentRows = [
    { key: "journeys", label: t("venture.manager.irJourneys"), pct: rrComponents.journeys },
    { key: "milestones", label: t("venture.manager.irMilestones"), pct: rrComponents.milestones },
    { key: "tasks", label: t("venture.manager.irTasks"), pct: rrComponents.tasks },
    { key: "deliverables", label: t("venture.manager.irDeliverables"), pct: rrComponents.deliverables },
  ];
  const roadmapCountRows = [
    { key: "journeys", label: t("venture.manager.irJourneys"), completed: rrCounts.journeys?.completed ?? 0, total: rrCounts.journeys?.total ?? 0 },
    { key: "milestones", label: t("venture.manager.irMilestones"), completed: rrCounts.milestones?.completed ?? 0, total: rrCounts.milestones?.total ?? 0 },
    { key: "tasks", label: t("venture.manager.irTasks"), completed: rrCounts.tasks?.completed ?? 0, total: rrCounts.tasks?.total ?? 0 },
    { key: "deliverables", label: t("venture.manager.irDeliverables"), completed: rrCounts.deliverables?.approved ?? 0, total: rrCounts.deliverables?.reviewed ?? 0 },
  ];

  const readiness = verificationData?.readiness;
  const items = verificationData?.items || [];
  const itemByCategory = new Map(items.map((item) => [item.category, item]));

  const readinessState = () => {
    if (!readiness) return null;
    if (readiness.is_ready) return { label: t("vadmin.verification.ready"), cls: "text-emerald-400 bg-emerald-500/10" };
    if (readiness.readiness_percent != null) {
      return {
        label: `${t("vadmin.verification.notReady")} · ${readiness.readiness_percent}%`,
        cls: "text-rose-400 bg-rose-500/10",
      };
    }
    return { label: t("vadmin.verification.readinessUndefined"), cls: "text-slate-400 bg-slate-500/10" };
  };

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.investment.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.investment.investmentReadiness")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <button onClick={() => { setOpeningDataBank(true); router.push(`/admin/ventures/${id}/verification`); }}
            disabled={openingDataBank}
            className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> {t("vadmin.investment.openDataBank")}
          </button>
        </div>

        {/* Document readiness (decision Q4): the acceptance % computed live from
            the Venture's Data bank documents, replacing the old 10-category
            recorded assessment. */}
        <div className="card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.investment.documentReadiness")}
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("vadmin.investment.documentReadinessDesc")}</p>
            </div>
            {(() => { const state = readinessState(); return state ? (
              <span className={`inline-flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded ${state.cls}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {state.label}
              </span>
            ) : null; })()}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-[140px]">
              <p className="text-5xl font-black tracking-tighter text-[var(--brand-orange)]">
                {readiness?.readiness_percent != null ? readiness.readiness_percent : "—"}
                {readiness?.readiness_percent != null && <span className="text-lg font-bold text-[var(--text-tertiary)]">%</span>}
              </p>
              <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t("vadmin.verification.ventureReadiness")}</p>
            </div>
            <div className="flex-1 min-w-[200px]">
              {progressBar(readiness?.readiness_percent ?? 0, readiness?.is_ready ? "bg-emerald-500" : "bg-[var(--brand-orange)]")}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">✓ {readiness?.verified_count ?? 0}</span>
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded">✕ {readiness?.rejected_count ?? 0}</span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">◷ {readiness?.pending_count ?? 0}</span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-500/10 px-2 py-1 rounded">… {readiness?.missing_count ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Per-document status detail */}
          <div className="space-y-2 mt-5">
            {documentTypes.map((documentType) => {
              const item = itemByCategory.get(documentType.code);
              const itemStatusConfig = ITEM_STATUS_CONFIG[item?.status] || ITEM_STATUS_CONFIG.pending;
              return (
                <div key={documentType.code} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{documentType.label_en}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${itemStatusConfig.color}`}>
                    {t(itemStatusConfig.label)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Roadmap readiness (derived) — the live pipeline numbers, kept from
            the previous screen because it does not belong to the retired
            10-category engine. */}
        {roadmap ? (
          <div className="card">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                  <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.investment.roadmapReadiness")}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("venture.manager.irTrackedDesc")}</p>
              </div>
              <span className="text-3xl font-black text-[var(--brand-orange)] shrink-0">{roadmap.overall_percent}%</span>
            </div>
            {progressBar(roadmap.overall_percent)}
            <div className="space-y-3 mt-4">
              {roadmapComponentRows.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">{row.label}</span>
                    <span className="text-[10px] font-black text-[var(--text-primary)]">{row.pct == null ? "—" : `${row.pct}%`}</span>
                  </div>
                  {row.pct != null && progressBar(row.pct)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {roadmapCountRows.map((row) => (
                <div key={row.key} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{row.label}</p>
                  <p className="text-sm font-black text-[var(--text-primary)] mt-0.5">
                    {row.completed}<span className="text-[var(--text-secondary)]">/{row.total}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : roadmapLoading ? (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.investment.roadmapReadiness")}
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}