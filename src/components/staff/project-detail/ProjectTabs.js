"use client";

import {
  Activity,
  Clock,
  FileText,
  ListTodo,
  MessageSquare,
  Shield,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The horizontal tab bar: one button per project section.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function ProjectTabs({
  activeTab,
  onTabChange,
  taskCount,
  blockerCount,
  memberCount,
  discussionCount,
}) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="flex items-center gap-1 border-b border-[var(--border-primary)] min-w-max px-2">
          {[
            {
              id: "overview",
              label: t("staffMisc.projectDetail.tabOverview"),
              icon: Activity,
            },
            {
              id: "tasks",
              label: t("staffMisc.projectDetail.tabTasks", {
                count: taskCount,
              }),
              icon: ListTodo,
            },
            {
              id: "blockers",
              label: t("staffMisc.projectDetail.tabBlockers", {
                count: blockerCount,
              }),
              icon: Shield,
            },
            {
              id: "team",
              label: t("staffMisc.projectDetail.tabTeam", {
                count: memberCount,
              }),
              icon: Users,
            },
            {
              id: "updates",
              label: t("staffMisc.projectDetail.tabUpdates"),
              icon: FileText,
            },
            {
              id: "discussions",
              label: t("staffMisc.projectDetail.tabDiscussions", {
                count: discussionCount,
              }),
              icon: MessageSquare,
            },
            {
              id: "timeline",
              label: t("staffMisc.projectDetail.tabTimeline"),
              icon: Clock,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[10px] font-bold uppercase tracking-wide transition-all border-b-2 -mb-[1px] shrink-0 whitespace-nowrap ${isActive ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                <TabIcon className="w-3 h-3 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
