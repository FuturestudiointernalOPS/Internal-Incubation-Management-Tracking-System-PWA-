import { Activity, Clock, FileText, ListTodo, MessageSquare, Shield, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function DetailTabs({ activeTab,
  onSelectTab,
  tasks,
  blockers,
  members,
  discussions,
  approvalRequests, }) {
  const { t } = useI18n();
  return (
    <div className="relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="flex items-center gap-1 border-b border-[var(--border-primary)] min-w-max px-2">
          {[
            {
              id: "overview",
              label: t("adminMisc.projectDetail.tabOverview"),
              icon: Activity,
            },
            {
              id: "tasks",
              label: t("adminMisc.projectDetail.tabTasks", {
                count: tasks.length,
              }),
              icon: ListTodo,
            },
            {
              id: "blockers",
              label: t("adminMisc.projectDetail.tabBlockers", {
                count: blockers.length,
              }),
              icon: Shield,
            },
            {
              id: "team",
              label: t("adminMisc.projectDetail.tabTeam", {
                count: members.length,
              }),
              icon: Users,
            },
            {
              id: "updates",
              label: t("adminMisc.projectDetail.tabUpdates"),
              icon: FileText,
            },
            {
              id: "discussions",
              label: t("adminMisc.projectDetail.tabDiscussions", {
                count: discussions.length,
              }),
              icon: MessageSquare,
            },
            {
              id: "approvals",
              label:
                t("adminMisc.projectDetail.tabApprovals") +
                (approvalRequests.filter((request) => request.status === "pending")
                  .length > 0
                  ? ` (${approvalRequests.filter((request) => request.status === "pending").length})`
                  : ""),
              icon: UserPlus,
            },
            {
              id: "timeline",
              label: t("adminMisc.projectDetail.tabTimeline"),
              icon: Clock,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-[1px] shrink-0 whitespace-nowrap ${
                  isActive
                    ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                    : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
                }`}
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
