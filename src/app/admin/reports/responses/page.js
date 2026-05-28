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
  Download,
  Eye,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";

// Helper: formats snake_case labels to Title Case
function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper: renders a labeled info block (used in detail view)
function InfoBlock({ label, value }) {
  return (
    <div className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] print:bg-white print:border-gray-200 print:rounded print:p-2.5">
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
  const [reports, setReports] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [viewingReport, setViewingReport] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, progRes] = await Promise.all([
        fetch("/api/teacher/reports"),
        fetch("/api/pm/programs"),
      ]);
      const [repData, progData] = await Promise.all([
        repRes.json(),
        progRes.json(),
      ]);

      if (repData.success) setReports(repData.reports || []);
      if (progData.success) setPrograms(progData.programs || []);
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
    <DashboardLayout role="super_admin" activeTab="reports">
      <div className="space-y-10 pb-20 animate-in text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              Dashboard
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em]">
                  Intelligence Feed
                </span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)] uppercase">
                Report Responses
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl px-8 flex flex-col justify-center shadow-sm">
              <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                Total Signals
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
              placeholder="Search notes or authors..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option>All Programs</option>
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
                No Intelligence Signals Recorded
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredReports.map((report) => {
                const prog = programs.find((p) => p.id === report.program_id);
                return (
                  <div
                    key={report.id}
                    className="card group hover:border-[var(--brand-orange)] transition-all bg-[var(--bg-secondary)]/50 cursor-pointer"
                    onClick={() => setViewingReport(report)}
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] flex flex-col items-center justify-center group-hover:border-[var(--brand-orange)]/50 transition-colors">
                          <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase">
                            Wk
                          </span>
                          <span className="text-xl font-bold text-[var(--text-primary)] leading-none">
                            {report.week_number}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">
                            {prog?.name || "Program Asset"}
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
                            Reception
                          </p>
                          <div className="flex gap-1 justify-center">
                            {[...Array(10)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 h-3 rounded-full ${i < report.reception_score ? "bg-emerald-500" : "bg-[var(--bg-tertiary)] opacity-30"}`}
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
                  Report Detail · Week {viewingReport.week_number}
                </span>
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight mt-1">
                  {programs.find((p) => p.id === viewingReport.program_id)
                    ?.name || "Program"}
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
                  <Download className="w-4 h-4" /> Export PDF
                </button>
                <button
                  onClick={() => setViewingReport(null)}
                  className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Print-Only Header */}
            <div className="hidden print:!block print:mb-6 print:pb-4 print:border-b print:border-gray-300">
              <h1 className="text-2xl font-bold text-black">
                {programs.find((p) => p.id === viewingReport.program_id)
                  ?.name || "Program"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Weekly Report — Week {viewingReport.week_number}
              </p>
            </div>

            {/* Program Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-primary)] print:bg-gray-50 print:border print:border-gray-200 print:rounded print:p-4">
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  Program Manager
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                  {viewingReport.teacher_name}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  Week
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                  {viewingReport.week_number}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  Submitted
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                  {new Date(viewingReport.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest print:text-gray-500">
                  Health Status
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
                    ? "Optimal"
                    : viewingReport.reception_score >= 5
                      ? "Stable"
                      : viewingReport.reception_score >= 3
                        ? "At Risk"
                        : "Critical"}
                </p>
              </div>
            </div>

            {/* ───────── 1. WEEKLY OVERVIEW ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[var(--brand-orange)]/20 pb-2 print:text-orange-600 print:border-orange-200">
                <span className="w-4 h-4 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[7px] print:bg-orange-100 print:text-orange-600">
                  1
                </span>
                Weekly Overview
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoBlock
                  label="Week Status"
                  value={formatLabel(viewingReport.week_status) || "—"}
                />
                <InfoBlock
                  label="Overall Rating"
                  value={formatLabel(viewingReport.week_rating) || "—"}
                />
                <InfoBlock
                  label="Main Topic"
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
                KPI-Linked Assignment Tracking
              </h5>
              {viewingReport.assignment_given ? (
                <div className="space-y-3 p-4 bg-violet-500/5 rounded-xl border border-violet-500/20 print:bg-violet-50 print:border-violet-200 print:rounded print:p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoBlock label="Assignment Given" value="Yes" />
                    <InfoBlock
                      label="Linked KPIs"
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
                    label="Assignment Objective"
                    value={viewingReport.assignment_objective || "—"}
                  />
                  {viewingReport.assignment_outcome && (
                    <InfoBlock
                      label="Expected Outcome"
                      value={viewingReport.assignment_outcome}
                    />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)] print:bg-gray-50 print:border-gray-200 print:rounded print:p-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)] italic print:text-gray-500">
                    No assignment was given this week.
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
                Participation
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label="Attendance Level"
                  value={formatLabel(viewingReport.attendance_level) || "—"}
                />
                <InfoBlock
                  label="Participation Level"
                  value={formatLabel(viewingReport.participation_level) || "—"}
                />
              </div>
              {viewingReport.participants_need_attention ? (
                <InfoBlock
                  label="Participants Needing Attention"
                  value={
                    viewingReport.participants_attention_notes || "Flagged"
                  }
                />
              ) : null}
              {viewingReport.standout_participants ? (
                <InfoBlock
                  label="Standout Participants"
                  value={viewingReport.standout_notes || "Recognized"}
                />
              ) : null}
            </section>

            {/* ───────── 4. DELIVERY FEEDBACK ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-blue-500/20 pb-2 print:text-blue-600 print:border-blue-200">
                <span className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center text-[7px] print:bg-blue-100 print:text-blue-600">
                  3
                </span>
                Delivery Feedback
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label="Delivery Quality"
                  value={formatLabel(viewingReport.delivery_quality) || "—"}
                />
                <InfoBlock
                  label="Participant Understanding"
                  value={
                    formatLabel(viewingReport.participant_understanding) || "—"
                  }
                />
              </div>
              {viewingReport.delivery_challenges ? (
                <InfoBlock
                  label="Delivery Challenges"
                  value={viewingReport.delivery_challenge_note || "Noted"}
                />
              ) : null}
            </section>

            {/* ───────── 5. ISSUES & SUPPORT ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-rose-500/20 pb-2 print:text-rose-600 print:border-rose-200">
                <span className="w-4 h-4 rounded-full bg-rose-500/10 flex items-center justify-center text-[7px] print:bg-rose-100 print:text-rose-600">
                  4
                </span>
                Issues & Support
              </h5>
              {viewingReport.had_issues ? (
                <div className="space-y-3 p-4 bg-rose-500/5 rounded-xl border border-rose-500/20 print:bg-rose-50 print:border-rose-200 print:rounded print:p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoBlock label="Issues Reported" value="Yes" />
                    <InfoBlock
                      label="Requires Admin Attention"
                      value={
                        viewingReport.requires_admin_attention ? "Yes" : "No"
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
                            label="Issue Types"
                            value={types.join(", ")}
                          />
                        ) : null;
                      } catch {
                        return null;
                      }
                    })()}
                  {viewingReport.additional_issue_note && (
                    <InfoBlock
                      label="Additional Note"
                      value={viewingReport.additional_issue_note}
                    />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)] print:bg-gray-50 print:border-gray-200 print:rounded print:p-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)] italic print:text-gray-500">
                    No issues reported.
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
                Next Week Planning
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoBlock
                  label="Program On Track"
                  value={viewingReport.program_on_track ? "Yes" : "No"}
                />
              </div>
              {viewingReport.planned_adjustments && (
                <InfoBlock
                  label="Planned Adjustments"
                  value={viewingReport.planned_adjustments}
                />
              )}
            </section>

            {/* ───────── NOTES (fallback from old system) ───────── */}
            <section className="space-y-3">
              <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-slate-500/20 pb-2 print:text-gray-600 print:border-gray-200">
                Weekly Notes
              </h5>
              <InfoBlock
                label="Progress Notes"
                value={viewingReport.progress_notes || "No notes provided."}
              />
            </section>

            {/* Print Footer */}
            <div className="hidden print:!block print:mt-8 print:pt-4 print:border-t print:border-gray-300 print:text-xs print:text-gray-400">
              <p>Generated from ImpactOS — {new Date().toLocaleDateString()}</p>
            </div>

            {/* Close Button — hidden on print */}
            <button
              onClick={() => setViewingReport(null)}
              className="btn btn-primary w-full py-4 font-bold uppercase tracking-widest print:hidden"
            >
              Close Report
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
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
