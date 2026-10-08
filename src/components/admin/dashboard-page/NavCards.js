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
 */
export function BlockerRateCard({ opStats, onOpen }) {
  const { t } = useI18n();
  const total = opStats.standups + opStats.retros;
  const rate = total > 0 ? Math.round((opStats.blockers / total) * 100) : 0;
  return (
    <button type="button" className="stf-st r" onClick={onOpen} style={{ textAlign: "left", cursor: "pointer", width: "100%" }}>
      <AlertTriangle size={18} />
      <div>
        <div className="stf-k">{t("admin.blockerRate")}</div>
        <div className="stf-num">{rate}%</div>
        <div className="stf-small">{t("admin.ofAllReports")}</div>
      </div>
    </button>
  );
}

const LINK = ({ icon: Icon, tone, label, text, onClick }) => (
  <button type="button" className={`stf-lk ${tone}`} onClick={onClick}>
    <div className="t">
      <Icon size={15} />
      {label}
    </div>
    <p>{text}</p>
  </button>
);

/** The four navigation cards of section B: work hub, tasks, blockers, projects. */
export function InternalOpsNavCards({ onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="stf-grid c4">
      <LINK icon={LayoutGrid} tone="" label={t("admin.workManagement")} text={t("admin.descriptions.workHub")} onClick={() => onNavigate("/admin/work")} />
      <LINK icon={ListTodo} tone="b" label={t("reports.tasks")} text={t("admin.descriptions.trackTasks")} onClick={() => onNavigate("/admin/tasks")} />
      <LINK icon={Shield} tone="" label={t("reports.blockers")} text={t("admin.descriptions.monitorBlockers")} onClick={() => onNavigate("/admin/blockers")} />
      <LINK icon={Briefcase} tone="g" label={t("reports.companyReports")} text={t("admin.descriptions.viewProjects")} onClick={() => onNavigate("/admin/projects")} />
    </div>
  );
}

/** The three archive navigation cards of section E. */
export function ArchiveNavCards({ onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="stf-grid g3">
      <LINK icon={Calendar} tone="b" label={t("admin.reportArchive")} text={t("admin.descriptions.browseArchive")} onClick={() => onNavigate("/admin/op-reports")} />
      <LINK icon={BarChart3} tone="b" label={t("admin.reportsHub")} text={t("admin.descriptions.historicalReports")} onClick={() => onNavigate("/admin/reports")} />
      <LINK icon={FileText} tone="b" label={t("admin.reportResponses")} text={t("admin.descriptions.pmReportResponses")} onClick={() => onNavigate("/admin/reports/responses")} />
    </div>
  );
}
