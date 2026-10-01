import {
  Search,
  Users,
  Filter,
  Calendar,
  Briefcase,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MONTHS } from "./constants";

export default function ReportsFilters({
  search,
  setSearch,
  users,
  filterUser,
  setFilterUser,
  filterType,
  setFilterType,
  filterMonth,
  setFilterMonth,
  filterProject,
  setFilterProject,
  allProjects,
  filterStatus,
  setFilterStatus,
  filterBlocker,
  setFilterBlocker,
  filterCarryOver,
  setFilterCarryOver,
  filterWorkspace,
  setFilterWorkspace,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common.search")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-sm font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
        <div className="relative">
          <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={filterUser}
            onChange={(event) => setFilterUser(event.target.value)}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="All Users">{t("common.allUsers")}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">{t("reports.filter.allTypes")}</option>
            <option value="standup">{t("reports.mondayStandup")}</option>
            <option value="retro">{t("reports.fridayRetro")}</option>
          </select>
        </div>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={filterMonth}
            onChange={(event) => setFilterMonth(event.target.value)}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">{t("reports.filter.allMonths")}</option>
            {MONTHS.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={filterProject}
            onChange={(event) => setFilterProject(event.target.value)}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">{t("reports.filter.allProjects")}</option>
            {allProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
        >
          <option value="all">{t("reports.filter.allStatuses")}</option>
          <option value="completed">{t("status.completed")}</option>
          <option value="in_progress">{t("status.inProgress")}</option>
          <option value="blocked">{t("status.blocked")}</option>
          <option value="carried_over">{t("reports.carriedOver")}</option>
          <option value="pending">{t("status.pending")}</option>
        </select>
        <select
          value={filterBlocker}
          onChange={(event) => setFilterBlocker(event.target.value)}
          className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
        >
          <option value="all">{t("reports.filter.allBlockers")}</option>
          <option value="has_blockers">
            {t("reports.filter.hasBlockers")}
          </option>
          <option value="no_blockers">
            {t("reports.filter.noBlockers")}
          </option>
        </select>
        <select
          value={filterCarryOver}
          onChange={(event) => setFilterCarryOver(event.target.value)}
          className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
        >
          <option value="all">{t("reports.filter.allCarryOvers")}</option>
          <option value="carried">{t("reports.carriedOver")}</option>
          <option value="multi_week">
            {t("reports.filter.multiWeek")}
          </option>
          <option value="first_time">
            {t("reports.filter.firstTime")}
          </option>
        </select>
        <select
          value={filterWorkspace}
          onChange={(event) => setFilterWorkspace(event.target.value)}
          className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
        >
          <option value="main">
            {t("adminMisc.opReports.mainWorkspace")}
          </option>
          <option value="interns">
            {t("adminMisc.opReports.interns")}
          </option>
        </select>
      </div>
    </div>
  );
}
