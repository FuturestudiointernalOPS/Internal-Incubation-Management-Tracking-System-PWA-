"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, Loader2, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";
import ProjectsWorkItemsView from "@/components/ventures/projects/ProjectsWorkItemsView";
import VentureRemindersPanel from "@/components/ventures/projects/VentureRemindersPanel";

const REPORT_FILTERS = [
  { id: "all", labelKey: "vadmin.journeyReports.filterAll", status: null },
  { id: "submitted", labelKey: "vadmin.journeyReports.filterSubmitted", status: "submitted" },
  { id: "draft", labelKey: "vadmin.journeyReports.filterDraft", status: "draft" },
  { id: "reviewed", labelKey: "vadmin.journeyReports.filterReviewed", status: "reviewed" },
];

const STATUS_CHIP = {
  draft: "bg-white/10 text-slate-400",
  submitted: "bg-amber-500/15 text-amber-400",
  reviewed: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-white/10 text-slate-500",
};

/**
 * Admin → Ventures → [Venture] → Journey
 * Combines: journey manager, venture project work items, reminders, and
 * the journey reports portfolio (formerly a separate page).
 */
export default function VentureJourneyPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, lang } = useI18n();
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);

  // Journey Reports state
  const [reportFilter, setReportFilter] = useState("all");
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [missing, setMissing] = useState([]);
  const [reportsError, setReportsError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/ventures/${id}`);
        const payload = await response.json();
        if (payload.success) setVenture(payload.venture);
      } catch (error) {
        console.error("Failed to load venture:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loadReports = useCallback(
    async (filterId) => {
      const status = REPORT_FILTERS.find((f) => f.id === filterId)?.status || null;
      setReportsLoading(true);
      setReportsError(null);
      try {
        const response = await fetch(`/api/journey-reports${status ? `?status=${status}` : ""}`);
        const payload = await response.json();
        if (!payload.success) {
          setReportsError(payload.error || t("vadmin.journeyReports.loadFailed"));
          return;
        }
        setReports(payload.reports || []);
        setMissing(payload.journeys_missing_report || []);
      } catch (_) {
        setReportsError(t("vadmin.journeyReports.loadFailed"));
      } finally {
        setReportsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    Promise.resolve().then(() => loadReports(reportFilter));
  }, [reportFilter, loadReports]);

  const openJourney = (ventureCode) => {
    if (!ventureCode) return;
    router.push(`/admin/ventures/${encodeURIComponent(ventureCode)}/journey`);
  };

  const statusLabel = (status) =>
    t(`vadmin.journeyReports.statuses.${["draft", "submitted", "reviewed", "archived"].includes(status) ? status : "draft"}`);

  const kindLabel = (kind) =>
    kind === "closing" ? t("vadmin.journeyReports.closingReport") : t("vadmin.journeyReports.interimReport");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("vadmin.journey.backToVenture", { name: venture?.company_name || t("vadmin.dashboard.venture") })}
      </button>

      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
            <Route className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">{t("vadmin.journey.title")}</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {t("vadmin.journey.subtitle", { company: venture?.company_name, code: venture?.venture_id })}
            </p>
          </div>
        </div>
      </div>

      <JourneyManagerPanel ventureId={id} />

      <ProjectsWorkItemsView ventureId={id} />

      <VentureRemindersPanel ventureId={id} />

      {/* Journey Reports — formerly a separate page, now embedded here */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--brand-orange)]" /> {t("vadmin.journeyReports.title")}
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {t("vadmin.journeyReports.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {REPORT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setReportFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                reportFilter === f.id
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {reportsError && (
          <AppCard padding="md">
            <p className="text-xs text-rose-400">{reportsError}</p>
          </AppCard>
        )}

        {missing.length > 0 && (
          <AppCard padding="md">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" /> {t("vadmin.journeyReports.missingTitle", { n: missing.length })}
            </p>
            <div className="space-y-1.5">
              {missing.map((journey) => (
                <div key={journey.journey_id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[var(--text-primary)]">{journey.venture_name || journey.venture_code}</span>
                  <span style={{ color: "var(--text-secondary)" }}>· {journey.journey_name}</span>
                  {journey.completed_at && (
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {t("vadmin.journeyReports.closedOn", { date: new Date(journey.completed_at).toLocaleDateString(lang) })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openJourney(journey.venture_code)}
                    className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
                  >
                    {t("vadmin.journeyReports.openJourney")}
                  </button>
                </div>
              ))}
            </div>
          </AppCard>
        )}

        <AppCard padding="md">
          {reportsLoading ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}
            </div>
          ) : reports.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("vadmin.journeyReports.noReports")}</p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="flex flex-wrap items-center gap-2 text-xs border-b border-[var(--border-primary)] last:border-0 pb-2 last:pb-0">
                  <span className="font-bold text-[var(--text-primary)]">{report.venture_name || report.venture_code}</span>
                  <span style={{ color: "var(--text-secondary)" }}>· {report.journey_name || t("vadmin.journeyReports.noJourney")}</span>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-slate-400">{kindLabel(report.report_kind)}</span>
                  <span className="flex-1 min-w-[140px] truncate text-[var(--text-primary)]">{report.title}</span>
                  {report.reporting_period && (
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{report.reporting_period}</span>
                  )}
                  <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_CHIP[report.status] || STATUS_CHIP.draft}`}>
                    {statusLabel(report.status)}
                  </span>
                  {report.submitted_at && (
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {t("vadmin.journeyReports.submittedOn", { date: new Date(report.submitted_at).toLocaleDateString(lang) })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openJourney(report.venture_code)}
                    className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
                  >
                    {t("vadmin.journeyReports.openJourney")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      </div>
    </div>
  );
}
