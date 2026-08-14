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
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function init() {
      try {
        // First try session API (reliable — waits for auth to resolve)
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated && data.user) {
          const u = data.user;
          setUser(u);
          fetchProjects(u.cid || u.id);
          fetchInvitations(u.cid || u.id);
          return;
        }
      } catch (_) {}

      // Fallback: read from localStorage
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      if (u.cid || u.id) {
        setUser(u);
        fetchProjects(u.cid || u.id);
        fetchInvitations(u.cid || u.id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  const fetchProjects = async (cid) => {
    try {
      const res = await fetch(
        `/api/projects?user_cid=${encodeURIComponent(cid)}`,
      );
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

  const fetchInvitations = async (cid) => {
    try {
      const res = await fetch(
        `/api/projects/invitations?invitee_id=${encodeURIComponent(cid)}&status=pending`,
      );
      const data = await res.json();
      if (data.success) setInvitations(data.invitations || []);
    } catch (e) {
      console.error("Failed to fetch invitations", e);
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    setResponding(invitationId);
    try {
      const res = await fetch("/api/projects/invitations/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t((data.error || t("staffMisc.projects.failedToRespond")) || "") || (data.error || t("staffMisc.projects.failedToRespond")) } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t("staffMisc.projects.networkError") } }));
    } finally {
      setResponding(null);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.meta?.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const STATUS_LABELS = {
    Active: "staffMisc.projects.statusActive",
    Completed: "staffMisc.projects.statusCompleted",
    Paused: "staffMisc.projects.statusPaused",
  };

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
              {t("staffMisc.projects.title")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("staffMisc.projects.subtitle")}
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

        {/* Pending Project Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              {t("staffMisc.projects.invitations", { count: invitations.length })}
            </h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="card p-4 border-amber-500/20 bg-amber-500/[0.03]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {inv.project_name || t("staffMisc.projects.defaultProject")}
                      </h3>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {t("staffMisc.projects.invitedYou")}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() =>
                          handleInvitationResponse(inv.id, "decline")
                        }
                        disabled={responding === inv.id}
                        className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
                      >
                        {t("staffMisc.projects.decline")}
                      </button>
                      <button
                        onClick={() =>
                          handleInvitationResponse(inv.id, "accept")
                        }
                        disabled={responding === inv.id}
                        className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40"
                      >
                        {t("staffMisc.projects.accept")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <Briefcase className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search ? t("common.noResults") : t("staffMisc.projects.noProjectsAssigned")}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search
                ? t("common.noResults")
                : t("staffMisc.projects.noProjectsHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => {
              const tasksTotal = project.task_summary?.total || 0;
              const tasksDone = project.task_summary?.completed || 0;
              const progress =
                tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

              return (
                <div
                  key={project.id}
                  onClick={() => {
                    router.push(`/staff/projects/${project.id}`);
                  }}
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
                            {project.status
                              ? t(STATUS_LABELS[project.status] || project.status)
                              : t("staffMisc.projects.statusActive")}
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-4">
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            {t("staffMisc.projects.members")}
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)] mt-1">
                            {project.members?.length || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            {t("staffMisc.projects.tasks")}
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)] mt-1">
                            {tasksDone}/{tasksTotal}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            {t("staffMisc.projects.timeline")}
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)] mt-1">
                            {project.start_date
                              ? new Date(project.start_date).toLocaleDateString(
                                  "en",
                                  { month: "short", day: "numeric" },
                                )
                              : "—"}{" "}
                            →{" "}
                            {project.end_date
                              ? new Date(project.end_date).toLocaleDateString(
                                  "en",
                                  { month: "short", day: "numeric" },
                                )
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            {t("staffMisc.projects.program")}
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
                              {t("staffMisc.projects.progress")}
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
                          {project.members?.some(
                            (m) =>
                              m.user_cid === (user?.cid || user?.id) &&
                              m.role === "lead",
                          )
                            ? t("staffMisc.projects.youAreLead")
                            : t("staffMisc.projects.member")}
                        </span>
                        <span className="text-[9px] text-slate-500 flex items-center gap-1 ml-auto">
                          <ChevronRight className="w-3 h-3" />
                          {t("staffMisc.projects.view")}
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
