"use client";

import React, { useState } from "react";
import {
  BarChart3,
  User,
  FileText,
  Search,
  Filter,
  Clock,
  ArrowLeft,
  ArrowRight,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import ReportDetailModal from "@/components/admin/reports/responses/ReportDetailModal";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickReports = (payload) => {
  if (!payload?.success) return EMPTY_REPORTS;
  const kpiNames = {};
  for (const kpi of payload.kpis || []) kpiNames[String(kpi.id)] = kpi.title;
  return { reports: payload.reports || [], kpiNames };
};

const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);

const EMPTY_OBJECT = {};
const EMPTY_REPORTS = { reports: [], kpiNames: EMPTY_OBJECT };

/**
 * IMPACTOS REPORT RESPONSES HUB
 * Centralized intelligence feed for weekly program reports.
 */

export default function ReportResponses() {
  const router = useRouter();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [viewingReport, setViewingReport] = useState(null);

  // One read of the reports feed, through the shared hook: it owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the page keeps no
  // copy of its own and reads its data during render.
  //
  // The answer carries the names of the KPIs the reports cite, which the page used
  // to collect by asking once per program in a loop - one round trip per program,
  // each of which could also make the server recalculate.
  const { data: feed, loading } = useApi("/api/pm/reports", {
    defaultValue: EMPTY_REPORTS,
    transform: pickReports,
  });
  const reports = feed.reports;
  const kpiNames = feed.kpiNames;

  const { data: programs } = useApi("/api/pm/programs", {
    defaultValue: EMPTY_LIST,
    transform: pickPrograms,
  });

  // The report list is looked up by KPI id; the ids are shown as they are when a
  // name is not among them.
  const kpiTitle = (id) => kpiNames[String(id)];

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.teacher_name?.toLowerCase().includes(search.toLowerCase()) ||
      report.progress_notes?.toLowerCase().includes(search.toLowerCase());
    const programName =
      programs.find((program) => program.id === report.program_id)?.name || "Unknown Program";
    const matchesProgram =
      selectedProgram === "All Programs" || programName === selectedProgram;
    return matchesSearch && matchesProgram;
  });

  return (
    <>
      <div className="space-y-10 pb-20 animate-in text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              {t("adminMisc.reportsResponses.dashboard")}
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em]">
                  {t("adminMisc.reportsResponses.intelligenceFeed")}
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] uppercase">
                {t("adminMisc.reportsResponses.reportResponses")}
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="p-4 bg-secondary border border-[var(--border-primary)] rounded-2xl px-8 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("adminMisc.reportsResponses.totalSignals")}
              </span>
              <span className="text-[var(--text-primary)] font-black text-2xl leading-none tracking-tighter">
                {filteredReports.length}
              </span>
            </div>
          </div>
        </header>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("adminMisc.reportsResponses.searchPlaceholder")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-sm font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={selectedProgram}
              onChange={(event) => setSelectedProgram(event.target.value)}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="All Programs">
                {t("adminMisc.reportsResponses.allPrograms")}
              </option>
              {programs.map((program) => (
                <option key={program.id}>{program.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* REPORTS FEED */}
        <div className="space-y-4">
          {loading ? (
            <TableSkeleton rows={8} />
          ) : filteredReports.length === 0 ? (
            <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                {t("adminMisc.reportsResponses.noSignalsRecorded")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredReports.map((report) => {
                const program = programs.find((program) => program.id === report.program_id);
                return (
                  <div
                    key={report.id}
                    className="card group hover:border-[var(--brand-orange)] transition-all bg-secondary/50 cursor-pointer"
                    onClick={() => setViewingReport(report)}
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-tertiary border border-[var(--border-secondary)] flex flex-col items-center justify-center group-hover:border-brand-orange/50 transition-colors">
                          <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase">
                            {t("adminMisc.reportsResponses.weekAbbrev")}
                          </span>
                          <span className="text-xl font-bold text-[var(--text-primary)] leading-none">
                            {report.week_number}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">
                            {program?.name || t("adminMisc.reportsResponses.programAsset")}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                            <User className="w-3 h-3" /> {report.teacher_name}
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <Clock className="w-3 h-3" />{" "}
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">
                            {t("adminMisc.reportsResponses.reception")}
                          </p>
                          <div className="flex gap-1 justify-center">
                            {[...Array(10)].map((_, receptionIndex) => (
                              <div
                                key={receptionIndex}
                                className={`w-1 h-3 rounded-full ${receptionIndex < report.reception_score ? "bg-emerald-500" : "bg-tertiary opacity-30"}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button className="btn btn-secondary !p-3 rounded-xl border-[var(--border-primary)] group-hover:border-[var(--brand-orange)]">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-[var(--border-secondary)]">
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                        &quot;{report.progress_notes}&quot;
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL — Structured Report Viewer + PDF Export */}
      {viewingReport && (
        <ReportDetailModal
          viewingReport={viewingReport}
          programs={programs}
          kpiTitle={kpiTitle}
          setViewingReport={setViewingReport}
          t={t}
        />
      )}
    </>
  );
}

// Minimal missing icons
function _Activity({ className }) {
  return <ShieldCheck className={className} />;
}
function _Zap({ className }) {
  return <ArrowRight className={className} />;
}
function _TrendingUp({ className }) {
  return <TrendingUpIcon className={className} />;
}
function TrendingUpIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  );
}
function ShieldCheck({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <path d="m9 12 2 2 4-4"></path>
    </svg>
  );
}
