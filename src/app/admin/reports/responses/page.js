"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Calendar,
  User,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

// Helper: formats snake_case labels to Title Case
function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper: renders a labeled info block (used in detail view)
function InfoBlock({ label, value }) {
  return (
    <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] print:bg-white print:border-gray-200 print:rounded print:p-2.5">
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 print:text-gray-500">
        {label}
      </p>
      <p className="text-xs font-bold text-[var(--text-primary)] leading-snug print:text-black">
        {value || "—"}
      </p>
    </div>
  );
}

/**
 * IMPACTOS REPORT RESPONSES HUB
 * Centralized intelligence feed for weekly program reports.
 */

export default function ReportResponses() {
  const router = useRouter();
  const { t } = useI18n();
  const [reports, setReports] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [viewingReport, setViewingReport] = useState(null);
  const [kpis, setKpis] = useState([]);

  const fetchData = useCallback(async (bypassCache = false) => {
    const urls = ["/api/teacher/reports", "/api/pm/programs"];
    const apply = (repData, progData) => {
      if (repData?.success) setReports(repData.reports || []);
      if (progData?.success) setPrograms(progData.programs || []);
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to the page renders instantly from fresh
      // snapshots; mutation flows pass bypassCache=true so the feed always
      // reflects the latest server state.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1]);
          setLoading(false);
        }
      }
      const responses = await Promise.all(
        urls.map((u) =>
          fetch(u)
            .then((r) => r.json())
            .catch(() => ({ success: false })),
        ),
      );
      urls.forEach((u, i) => {
        if (responses[i]?.success) cacheSet(u, responses[i]);
      });
      apply(responses[0], responses[1]);

      // Fetch KPIs for each program to resolve KPI names
      const allKpis = [];
      for (const prog of (responses[1]?.programs || [])) {
        try {
          const kpiRes = await fetch(`/api/kpi-progress?program_id=${prog.id}`);
          const kpiData = await kpiRes.json();
          if (kpiData.success && kpiData.kpiProgress) {
            allKpis.push(...kpiData.kpiProgress.map(k => ({ id: k.kpi_id, title: k.kpi_name })));
          }
        } catch (_) {}
      }
      setKpis(allKpis);
    } catch (e) {
      console.error("Sync Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.teacher_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.progress_notes?.toLowerCase().includes(search.toLowerCase());
    const programName =
      programs.find((p) => p.id === r.program_id)?.name || "Unknown Program";
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
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
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
              <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminMisc.reportsResponses.searchPlaceholder")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="All Programs">
                {t("adminMisc.reportsResponses.allPrograms")}
              </option>
              {programs.map((p) => (
                <option key={p.id}>{p.name}</option>
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
                const prog = programs.find((p) => p.id === report.program_id);
                return (
                  <div
                    key={report.id}
                    className="card group hover:border-[var(--brand-orange)] transition-all bg-secondary/50 cursor-pointer"
                    onClick={() => setViewingReport(report)}
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-tertiary border border-[var(--border-secondary)] flex flex-col items-center justify-center group-hover:border-[var(--brand-orange)]/50 transition-colors">
                          <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase">
                            {t("adminMisc.reportsResponses.weekAbbrev")}
                          </span>
                          <span className="text-xl font-bold text-[var(--text-primary)] leading-none">
                            {report.week_number}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">
                            {prog?.name || t("adminMisc.reportsResponses.programAsset")}
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
                          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-1">
                            {t("adminMisc.reportsResponses.reception")}
                          </p>
                          <div className="flex gap-1 justify-center">
                            {[...Array(10)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 h-3 rounded-full ${i < report.reception_score ? "bg-emerald-500" : "bg-tertiary opacity-30"}`}
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
                      <p className="text-xs font-medium text-[var(--text-secondary)] line-clamp-2 italic leading-relaxed">
                        "{report.progress_notes}"
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
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm print:bg-white print:!fixed print:!inset-0 print:!z-[9999] print:!overflow-auto"
          onClick={() => {
            if (!window.printing) setViewingReport(null);
          }}
        >
          <div className="card w-full max-w-2xl space-y-6 border-[var(--brand-orange)]/30 animate-in text-left overflow-y-auto max-h-[90vh] print:!max-h-none print:!shadow-none print:!border-none print:!p-0 print:!bg-white print:!text-black print:!w-full print:!max-w-full print:!m-0">
            {/* Header — hidden on print */}
            <div className="flex justify-between items-start print:hidden">
              <div>
                <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                  {t("adminMisc.reportsResponses.reportDetailWeek", {
                    week: viewingReport.week_number,
                  })}
                </span>
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight mt-1">
                  {programs.find((p) => p.id === viewingReport.program_id)
                    ?.name || t("adminMisc.reportsResponses.program")}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.printing = true;
                    window.print();
                    setTimeout(() => {
                      window.printing = false;
                    }, 1000);
                  }}
                  className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <Download className="w-4 h-4" />{" "}
                  {t("adminMisc.reportsResponses.exportPdf")}
                </button>
                <button
                  onClick={() => setViewingReport(null)}
                  className="p-2 hover:bg-primary rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Print-Only Header */}
            <div className="hidden print:!block print:mb-6 print:pb-4 print:border-b print:border-gray-300">
              <h1 className="text-2xl font-bold text-black">
                {programs.find((p) => p.id === viewingReport.program_id)
                  ?.name || t("adminMisc.reportsResponses.program")}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t("adminMisc.reportsResponses.weeklyReportWeek", {
                  week: viewingReport.week_number,
                })}
              </p>
            </div>

            {/* Program Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-tertiary rounded-2xl border border-[var(--border-primary)] print:bg-gray-50 print:border print:border-gray-200 print:rounded print:p-4">
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  {t("adminMisc.reportsResponses.programManager")}
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                  {viewingReport.teacher_name}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  {t("adminMisc.reportsResponses.week")}
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                  {viewingReport.week_number}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  {t("adminMisc.reportsResponses.submitted")}
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                  {new Date(viewingReport.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  {t("adminMisc.reportsResponses.healthStatus")}
                </p>
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${
                    viewingReport.reception_score >= 8
                      ? "text-emerald-500"
                      : viewingReport.reception_score >= 5
                        ? "text-amber-500"
                        : "text-rose-500"
                  } print:text-black`}
                >
                  {viewingReport.reception_score >= 8
                    ? t("adminMisc.reportsResponses.optimal")
                    : viewingReport.reception_score >= 5
                      ? t("adminMisc.reportsResponses.stable")
                      : viewingReport.reception_score >= 3
                        ? t("adminMisc.reportsResponses.atRisk")
                        : t("adminMisc.reportsResponses.critical")}
                </p>
              </div>
            </div>

            {/* ───────── 1. WEEKLY OVERVIEW ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[var(--brand-orange)]/20 pb-2 print:text-orange-600 print:border-orange-200">
                <span className="w-4 h-4 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[7px] print:bg-orange-100 print:text-orange-600">
                  1
                </span>
                {t("adminMisc.reportsResponses.weeklyOverview")}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoBlock
                  label={t("adminMisc.reportsResponses.weekStatus")}
                  value={formatLabel(viewingReport.week_status) || "—"}
                />
                <InfoBlock
                  label={t("adminMisc.reportsResponses.overallRating")}
                  value={formatLabel(viewingReport.week_rating) || "—"}
                />
                <InfoBlock
                  label={t("adminMisc.reportsResponses.mainTopic")}
                  value={viewingReport.main_topic || "—"}
                />
              </div>
            </section>

            {/* ───────── 2. ASSIGNMENT TRACKING ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-violet-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-violet-500/20 pb-2 print:text-violet-600 print:border-violet-200">
                <span className="w-4 h-4 rounded-full bg-violet-500/10 flex items-center justify-center text-[7px] print:bg-violet-100 print:text-violet-600">
                  +
                </span>
                {t("adminMisc.reportsResponses.kpiAssignmentTracking")}
              </h5>
              {viewingReport.assignment_given ? (
                <div className="space-y-3 p-4 bg-violet-500/5 rounded-xl border border-violet-500/20 print:bg-violet-50 print:border-violet-200 print:rounded print:p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoBlock label={t("adminMisc.reportsResponses.assignmentGiven")} value={t("adminMisc.reportsResponses.yes")} />
                    <InfoBlock
                      label={t("adminMisc.reportsResponses.linkedKpis")}
                      value={(() => {
                        try {
                          const ids =
                            typeof viewingReport.assignment_kpi_ids === "string"
                              ? JSON.parse(viewingReport.assignment_kpi_ids)
                              : viewingReport.assignment_kpi_ids || [];
                          if (ids.length === 0) return "—";
                          return (
                            kpis
                              .filter((k) => ids.includes(k.id))
                              .map((k) => k.title)
                              .join(", ") || ids.join(", ")
                          );
                        } catch {
                          return viewingReport.assignment_kpi_ids || "—";
                        }
                      })()}
                    />
                  </div>
                  <InfoBlock
                    label={t("adminMisc.reportsResponses.assignmentObjective")}
                    value={viewingReport.assignment_objective || "—"}
                  />
                  {viewingReport.assignment_outcome && (
                    <InfoBlock
                      label={t("adminMisc.reportsResponses.expectedOutcome")}
                      value={viewingReport.assignment_outcome}
                    />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)] print:bg-gray-50 print:border-gray-200 print:rounded print:p-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)] italic print:text-gray-500">
                    {t("adminMisc.reportsResponses.noAssignmentThisWeek")}
                  </p>
                </div>
              )}
            </section>

            {/* ───────── 3. PARTICIPATION ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-indigo-500/20 pb-2 print:text-indigo-600 print:border-indigo-200">
                <span className="w-4 h-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-[7px] print:bg-indigo-100 print:text-indigo-600">
                  2
                </span>
                {t("adminMisc.reportsResponses.participation")}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label={t("adminMisc.reportsResponses.attendanceLevel")}
                  value={formatLabel(viewingReport.attendance_level) || "—"}
                />
                <InfoBlock
                  label={t("adminMisc.reportsResponses.participationLevel")}
                  value={formatLabel(viewingReport.participation_level) || "—"}
                />
              </div>
              {viewingReport.participants_need_attention ? (
                <InfoBlock
                  label={t("adminMisc.reportsResponses.participantsNeedingAttention")}
                  value={
                    viewingReport.participants_attention_notes || t("adminMisc.reportsResponses.flagged")
                  }
                />
              ) : null}
              {viewingReport.standout_participants ? (
                <InfoBlock
                  label={t("adminMisc.reportsResponses.standoutParticipants")}
                  value={viewingReport.standout_notes || t("adminMisc.reportsResponses.recognized")}
                />
              ) : null}
            </section>

            {/* ───────── 4. DELIVERY FEEDBACK ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-blue-500/20 pb-2 print:text-blue-600 print:border-blue-200">
                <span className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center text-[7px] print:bg-blue-100 print:text-blue-600">
                  3
                </span>
                {t("adminMisc.reportsResponses.deliveryFeedback")}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label={t("adminMisc.reportsResponses.deliveryQuality")}
                  value={formatLabel(viewingReport.delivery_quality) || "—"}
                />
                <InfoBlock
                  label={t("adminMisc.reportsResponses.participantUnderstanding")}
                  value={
                    formatLabel(viewingReport.participant_understanding) || "—"
                  }
                />
              </div>
              {viewingReport.delivery_challenges ? (
                <InfoBlock
                  label={t("adminMisc.reportsResponses.deliveryChallenges")}
                  value={viewingReport.delivery_challenge_note || t("adminMisc.reportsResponses.noted")}
                />
              ) : null}
            </section>

            {/* ───────── 5. ISSUES & SUPPORT ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-rose-500/20 pb-2 print:text-rose-600 print:border-rose-200">
                <span className="w-4 h-4 rounded-full bg-rose-500/10 flex items-center justify-center text-[7px] print:bg-rose-100 print:text-rose-600">
                  4
                </span>
                {t("adminMisc.reportsResponses.issuesAndSupport")}
              </h5>
              {viewingReport.had_issues ? (
                <div className="space-y-3 p-4 bg-rose-500/5 rounded-xl border border-rose-500/20 print:bg-rose-50 print:border-rose-200 print:rounded print:p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoBlock label={t("adminMisc.reportsResponses.issuesReported")} value={t("adminMisc.reportsResponses.yes")} />
                    <InfoBlock
                      label={t("adminMisc.reportsResponses.requiresAdminAttention")}
                      value={
                        viewingReport.requires_admin_attention ? t("adminMisc.reportsResponses.yes") : t("adminMisc.reportsResponses.no")
                      }
                    />
                  </div>
                  {viewingReport.issue_types &&
                    (() => {
                      try {
                        const types =
                          typeof viewingReport.issue_types === "string"
                            ? JSON.parse(viewingReport.issue_types)
                            : Array.isArray(viewingReport.issue_types)
                              ? viewingReport.issue_types
                              : [];
                        return types.length > 0 ? (
                          <InfoBlock
                            label={t("adminMisc.reportsResponses.issueTypes")}
                            value={types.join(", ")}
                          />
                        ) : null;
                      } catch {
                        return null;
                      }
                    })()}
                  {viewingReport.additional_issue_note && (
                    <InfoBlock
                      label={t("adminMisc.reportsResponses.additionalNote")}
                      value={viewingReport.additional_issue_note}
                    />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)] print:bg-gray-50 print:border-gray-200 print:rounded print:p-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)] italic print:text-gray-500">
                    {t("adminMisc.reportsResponses.noIssuesReported")}
                  </p>
                </div>
              )}
            </section>

            {/* ───────── 6. NEXT WEEK ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-emerald-500/20 pb-2 print:text-emerald-600 print:border-emerald-200">
                <span className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center text-[7px] print:bg-emerald-100 print:text-emerald-600">
                  5
                </span>
                {t("adminMisc.reportsResponses.nextWeekPlanning")}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label={t("adminMisc.reportsResponses.programOnTrack")}
                  value={viewingReport.program_on_track ? t("adminMisc.reportsResponses.yes") : t("adminMisc.reportsResponses.no")}
                />
              </div>
              {viewingReport.planned_adjustments && (
                <InfoBlock
                  label={t("adminMisc.reportsResponses.plannedAdjustments")}
                  value={viewingReport.planned_adjustments}
                />
              )}
            </section>

            {/* ───────── NOTES (fallback from old system) ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-slate-500/20 pb-2 print:text-gray-600 print:border-gray-200">
                {t("adminMisc.reportsResponses.notesAndReception")}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label={t("adminMisc.reportsResponses.studentReception")}
                  value={viewingReport.student_reception || "—"}
                />
                <InfoBlock
                  label={t("adminMisc.reportsResponses.actionTaken")}
                  value={viewingReport.action_taken || "—"}
                />
              </div>
              <InfoBlock
                label={t("adminMisc.reportsResponses.progressNotes")}
                value={viewingReport.progress_notes || t("adminMisc.reportsResponses.noNotesProvided")}
              />
            </section>

            {/* Print Footer */}
            <div className="hidden print:!block print:mt-8 print:pt-4 print:border-t print:border-gray-300 print:text-xs print:text-gray-400">
              <p>
                {t("adminMisc.reportsResponses.generatedFromImpactOs", {
                  date: new Date().toLocaleDateString(),
                })}
              </p>
            </div>

            {/* Close Button — hidden on print */}
            <button
              onClick={() => setViewingReport(null)}
              className="btn btn-primary w-full py-4 font-bold uppercase tracking-widest print:hidden"
            >
              {t("adminMisc.reportsResponses.closeReport")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Minimal missing icons
function X({ className }) {
  return <XCircle className={className} />;
}
function Activity({ className }) {
  return <ShieldCheck className={className} />;
}
function Zap({ className }) {
  return <ArrowRight className={className} />;
}
function TrendingUp({ className }) {
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
function XCircle({ className }) {
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
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
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
