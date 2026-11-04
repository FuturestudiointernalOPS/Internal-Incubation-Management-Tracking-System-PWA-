"use client";

import { AlertTriangle, Briefcase, LayoutGrid, ListTodo, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LinkCard from "@/components/ui/LinkCard";
import StatusCard from "@/components/ui/StatusCard";

/**
 * The share of the last four weeks' submitted stand-ups that flagged a blocker,
 * as a single insight card (`accountabilityModel`).
 */
export function BlockerRateCard({ accountability, onOpen }) {
  const { t } = useI18n();
  return <StatusCard tone="r" icon={AlertTriangle} label={t("admin.blockerRate")} value={`${accountability.blockerRate}%`} hint={t("admin.accountability.ofStandups")} onClick={onOpen} />;
}

const LINK = ({ icon, tone, label, text, onClick }) => <LinkCard icon={icon} tone={tone} title={label} text={text} onClick={onClick} />;

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
