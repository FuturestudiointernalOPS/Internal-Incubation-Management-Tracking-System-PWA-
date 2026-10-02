"use client";

import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Calendar,
  FileText,
  LayoutGrid,
  ListTodo,
  Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The rate at which reports raise a blocker, as a single insight card.
 * Extracted verbatim from app/admin/page.js.
 */
export function BlockerRateCard({ opStats, onOpen }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
      <div
        className="card flex items-center gap-4 p-5 cursor-pointer hover:border-[var(--brand-orange)] transition-all"
        onClick={onOpen}
      >
        <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("admin.blockerRate")}
          </p>
          <p className="text-2xl font-black tracking-tight">
            {opStats.standups + opStats.retros > 0
              ? Math.round(
                  (opStats.blockers /
                    (opStats.standups + opStats.retros)) *
                    100,
                )
              : 0}
            %
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {t("admin.ofAllReports")}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The four navigation cards of section B: work hub, tasks, blockers, projects.
 * Extracted verbatim from app/admin/page.js.
 */
export function InternalOpsNavCards({ onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <button
        onClick={() => onNavigate("/admin/work")}
        className="card hover:border-brand-orange/30 transition-all text-left ring-1 ring-brand-orange/20"
      >
        <div className="flex items-center gap-3 mb-3">
          <LayoutGrid className="w-5 h-5 text-[var(--brand-orange)]" />
          <span className="text-[11px] font-bold text-[var(--brand-orange)] uppercase tracking-wide">
            {t("admin.workManagement")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.workHub")}
        </p>
      </button>
      <button
        onClick={() => onNavigate("/admin/tasks")}
        className="card hover:border-brand-orange/30 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <ListTodo className="w-5 h-5 text-blue-500" />
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
            {t("reports.tasks")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.trackTasks")}
        </p>
      </button>
      <button
        onClick={() => onNavigate("/admin/blockers")}
        className="card hover:border-brand-orange/30 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-5 h-5 text-rose-500" />
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wide">
            {t("reports.blockers")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.monitorBlockers")}
        </p>
      </button>
      <button
        onClick={() => onNavigate("/admin/projects")}
        className="card hover:border-brand-orange/30 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <Briefcase className="w-5 h-5 text-emerald-500" />
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wide">
            {t("reports.companyReports")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.viewProjects")}
        </p>
      </button>
    </div>
  );
}

/**
 * The three archive navigation cards of section E: report archive, reports hub
 * and report responses.
 * Extracted verbatim from app/admin/page.js.
 */
export function ArchiveNavCards({ onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        onClick={() => onNavigate("/admin/op-reports")}
        className="card hover:border-blue-500/30 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5 text-blue-500" />
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
            {t("admin.reportArchive")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.browseArchive")}
        </p>
      </button>
      <button
        onClick={() => onNavigate("/admin/reports")}
        className="card hover:border-blue-500/30 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
            {t("admin.reportsHub")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.historicalReports")}
        </p>
      </button>
      <button
        onClick={() => onNavigate("/admin/reports/responses")}
        className="card hover:border-blue-500/30 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-5 h-5 text-blue-500" />
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
            {t("admin.reportResponses")}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("admin.descriptions.pmReportResponses")}
        </p>
      </button>
    </div>
  );
}