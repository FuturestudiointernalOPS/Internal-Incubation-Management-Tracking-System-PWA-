"use client";

import React from "react";
import { Search, Filter, Users, Clock, ListTodo } from "lucide-react";

/**
 * What the dashboard is narrowed by: the free-text search, the owner / status /
 * project filters, and the sort the read is keyed on.
 *
 * The two "All …" options and "Independent" are sentinels rather than values —
 * `derive.filterTasks` is what reads them.
 */
export default function TaskFilters({
  search,
  setSearch,
  users,
  filterUser,
  setFilterUser,
  filterStatus,
  setFilterStatus,
  filterProject,
  setFilterProject,
  projects,
  sortBy,
  setSortBy,
  sortOptions,
  t,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <option value="All Users">{t("adminMisc.tasks.allUsers")}</option>
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
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
        >
          <option value="all">{t("adminMisc.tasks.allStatuses")}</option>
          <option value="pending">{t("status.pending")}</option>
          <option value="in_progress">{t("status.inProgress")}</option>
          <option value="blocked">{t("status.blocked")}</option>
          <option value="completed">{t("status.completed")}</option>
          <option value="carried_over">{t("status.carriedOver")}</option>
        </select>
      </div>

      <div className="relative">
        <ListTodo className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <select
          value={filterProject}
          onChange={(event) => setFilterProject(event.target.value)}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
        >
          <option value="All Projects">{t("adminMisc.tasks.allProjects")}</option>
          <option value="Independent">{t("adminMisc.tasks.independentTasks")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name || project.title}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
        >
          {sortOptions.map((sortOption) => (
            <option key={sortOption.id} value={sortOption.id}>
              {sortOption.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}