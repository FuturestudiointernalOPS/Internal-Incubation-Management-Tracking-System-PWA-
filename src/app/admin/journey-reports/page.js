"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";

/**
 * Admin → Journey Reports — the PORTFOLIO view.
 *
 * The Super Admin's inbox: every journey report across every Venture, and every
 * journey that closed WITHOUT its closing report. Reports are written inside the
 * journey they belong to; this page exists so they can be found and read without
 * opening each Venture in turn.
 *
 * Nothing here writes. Reading a report's content stays where the journey is —
 * this page points you into it.
 */
const FILTERS = [
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

export default function JourneyReportsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [missing, setMissing] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (filterId) => {
      const status = FILTERS.find((f) => f.id === filterId)?.status || null;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/journey-reports${status ? `?status=${status}` : ""}`);
        const d = await res.json();
        if (!d.success) {
          setError(d.error || t("vadmin.journeyReports.loadFailed"));
          return;
        }
        setReports(d.reports || []);
        setMissing(d.journeys_missing_report || []);
      } catch (_) {
        setError(t("vadmin.journeyReports.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Microtask deferral: the fetch is started off the effect body (repo pattern).
  useEffect(() => {
    Promise.resolve().then(() => load(filter));
  }, [filter, load]);

  const openJourney = (ventureCode) => {
    if (!ventureCode) return;
    router.push(`/admin/ventures/${encodeURIComponent(ventureCode)}/journey`);
  };

  const statusLabel = (status) =>
    t(`vadmin.journeyReports.statuses.${["draft", "submitted", "reviewed", "archived"].includes(status) ? status : "draft"}`);

  const kindLabel = (kind) =>
    kind === "closing" ? t("vadmin.journeyReports.closingReport") : t("vadmin.journeyReports.interimReport");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
          <FileText className="w-4.5 h-4.5 text-[var(--brand-orange)]" /> {t("vadmin.journeyReports.title")}
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {t("vadmin.journeyReports.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
              filter === f.id
                ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {error && (
        <AppCard padding="md">
          <p className="text-xs text-rose-400">{error}</p>
        </AppCard>
      )}

      {/* The gap: journeys that closed without their closing report. */}
      {missing.length > 0 && (
        <AppCard padding="md">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {t("vadmin.journeyReports.missingTitle", { n: missing.length })}
          </p>
          <div className="space-y-1.5">
            {missing.map((j) => (
              <div key={j.journey_id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-[var(--text-primary)]">{j.venture_name || j.venture_code}</span>
                <span style={{ color: "var(--text-secondary)" }}>· {j.journey_name}</span>
                {j.completed_at && (
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {t("vadmin.journeyReports.closedOn", { date: new Date(j.completed_at).toLocaleDateString(lang) })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openJourney(j.venture_code)}
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
        {loading ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}
          </div>
        ) : reports.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("vadmin.journeyReports.noReports")}</p>
        ) : (
          <div className="space-y-2">
            {reports.map((rep) => (
              <div key={rep.id} className="flex flex-wrap items-center gap-2 text-xs border-b border-[var(--border-primary)] last:border-0 pb-2 last:pb-0">
                <span className="font-bold text-[var(--text-primary)]">{rep.venture_name || rep.venture_code}</span>
                <span style={{ color: "var(--text-secondary)" }}>· {rep.journey_name || t("vadmin.journeyReports.noJourney")}</span>
                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-slate-400">{kindLabel(rep.report_kind)}</span>
                <span className="flex-1 min-w-[140px] truncate text-[var(--text-primary)]">{rep.title}</span>
                {rep.reporting_period && (
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{rep.reporting_period}</span>
                )}
                <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_CHIP[rep.status] || STATUS_CHIP.draft}`}>
                  {statusLabel(rep.status)}
                </span>
                {rep.submitted_at && (
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {t("vadmin.journeyReports.submittedOn", { date: new Date(rep.submitted_at).toLocaleDateString(lang) })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openJourney(rep.venture_code)}
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
  );
}
