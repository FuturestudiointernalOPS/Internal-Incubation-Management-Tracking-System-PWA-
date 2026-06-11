"use client";

import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Search,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Shield,
  BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

/**
 * MY PROJECTS
 *
 * Shows projects assigned to the logged-in user (staff / PM).
 * Fetches via GET /api/projects?user_cid=X
 */
export default function MyProjects() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
    if (u.cid || u.id) {
      fetchProjects(u.cid || u.id);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProjects = async (cid) => {
    try {
      const res = await fetch(`/api/projects?user_cid=${encodeURIComponent(cid)}`);
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.meta?.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const statusBadge = (status) => {
    const map = {
      Active: "text-emerald-500 bg-emerald-500/10",
      Completed: "text-purple-500 bg-purple-500/10",
      Paused: "text-amber-500 bg-amber-500/10",
    };
    return map[status] || "text-slate-500 bg-slate-500/10";
  };

  return (
    <DashboardLayout role={user?.role || "staff"} activeTab="my_projects">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("reports.companyReports")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              My Projects
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Projects assigned to you
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
            />
          </div>
        </header>

        {/* Projects List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <Briefcase className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search ? t("common.noResults") : "No Projects Assigned"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search
                ? t("common.noResults")
                : "Projects assigned to you by a Super Admin will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => {
              const tasksTotal = project.task_summary?.total || 0;
              const tasksDone = project.task_summary?.completed || 0;
              const progress = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/admin/projects/${project.id}`)}
                  className="ios-card !p-0 overflow-hidden group cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all hover:bg-tertiary border-[var(--border-primary)]"
                >
                  <div className="flex flex-col lg:flex-row items-stretch">
                    <div className="p-6 lg:w-72 bg-tertiary border-r border-[var(--border-primary)] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-xl bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/20">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${statusBadge(project.status)}`}
                          >
                            {project.status || "Active"}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight leading-none italic group-hover:text-[var(--brand-orange)] transition-colors">
                          {project.name}
                        </h3>
                        {project.meta?.description && (
                          <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-3 line-clamp-2">
                            {project.meta.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 p-6 flex flex-col justify-between">
                      <div className="grid grid-cols-3 gap-6 mb-4">
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            Members
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)] mt-1">
                            {project.members?.length || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            Tasks
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)] mt-1">
                            {tasksDone}/{tasksTotal}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            Program
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate">
                            {project.program_name || "—"}
                          </p>
                        </div>
                      </div>

                      {tasksTotal > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-end">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                              Progress
                            </span>
                            <span className="text-[10px] font-black text-[var(--brand-orange)]">
                              {progress}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-[#FF9900] rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border-primary)]">
                        <span className="text-[9px] text-slate-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {project.members?.filter((m) => m.role === "lead").length > 0
                            ? "You are lead"
                            : "Member"}
                        </span>
                        <span className="text-[9px] text-slate-500 flex items-center gap-1 ml-auto">
                          <ChevronRight className="w-3 h-3" />
                          View
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
