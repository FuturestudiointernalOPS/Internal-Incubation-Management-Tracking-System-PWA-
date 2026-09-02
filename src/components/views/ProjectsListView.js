"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Search, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import AppCard from "@/components/ui/AppCard";
import AppBadge from "@/components/ui/AppBadge";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";

const STATUS_VARIANT = {
  Active: "success",
  Completed: "info",
  Paused: "warning",
};

/**
 * ProjectsListView — Shared project list for staff & developer roles.
 *
 * Fetches from GET /api/projects/assignments?user_cid=X
 * and renders a searchable, clickable card list.
 *
 * @param {{ role: "staff" | "developer" }} props
 */
export default function ProjectsListView({ role: propRole }) {
  const router = useRouter();
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detectedRole, setDetectedRole] = useState(null);

  // Resolve role: session-detected role > prop > fallback
  const role = detectedRole || propRole || "developer";

  useEffect(() => {
    async function init() {
      try {
        // 1. Try session API first
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated && data.user) {
          // Auto-detect role from session so the same page works for staff & developer
          if (data.user.role) {
            setDetectedRole(data.user.role);
          }
          fetchProjects(data.user.cid || data.user.id);
          return;
        }
      } catch (_) {
        // Fallback to localStorage
      }

      // 2. Fallback: localStorage
      try {
        const saved = localStorage.getItem("user");
        if (saved) {
          const u = JSON.parse(saved);
          if (u.role) {
            setDetectedRole(u.role);
          }
          if (u.cid || u.id) {
            fetchProjects(u.cid || u.id);
            return;
          }
        }
      } catch (_) {
        // ignore
      }

      setLoading(false);
    }
    init();
  }, []);

  const fetchProjects = async (cid) => {
    try {
      const res = await fetch(
        `/api/projects/assignments?user_cid=${encodeURIComponent(cid)}`,
      );
      const data = await res.json();
      if (data.success) {
        setProjects(data.myProjects || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.status || "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleProjectClick = (projectId) => {
    router.push(`/admin/projects/${projectId}`);
  };

  // ── Role-specific header labels ──
  const headerLabel =
    role === "staff" ? t("reports.companyReports") : "Developer Workspace";
  const subtitle =
    role === "staff"
      ? "Projects assigned to you"
      : "Projects you are working on";

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {headerLabel}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              My Projects
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {subtitle}
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

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <AppEmptyState
            title={search ? t("common.noResults") : "No Projects"}
            description={
              search
                ? t("common.noResults")
                : "Projects assigned to you will appear here."
            }
            icon={Briefcase}
            size="lg"
          />
        )}

        {/* ── Project Cards ── */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((project) => (
              <AppCard
                key={project.id}
                hover
                border
                padding="md"
                onClick={() => handleProjectClick(project.id)}
                className="!p-0 overflow-hidden group cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all border-[var(--border-primary)]"
              >
                <div className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2.5 rounded-xl bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/20 flex-shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight leading-none truncate group-hover:text-[var(--brand-orange)] transition-colors">
                        {project.name || t("common.untitled")}
                      </h3>
                      {project.member_role && (
                        <p className="text-[10px] font-bold text-[var(--text-secondary)]/60 mt-1 capitalize">
                          {project.member_role}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <AppBadge
                      variant={STATUS_VARIANT[project.status] || "default"}
                    >
                      {project.status || "Active"}
                    </AppBadge>
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--brand-orange)] transition-colors" />
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
