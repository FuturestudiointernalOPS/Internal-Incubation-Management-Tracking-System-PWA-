"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  RefreshCw,
  Users,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function DeveloperProjects() {
  const router = useRouter();
  const { t } = useI18n();
  const [userRole, setUserRole] = useState("developer");
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

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
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: data.error || t("developerMisc.projects.failedToRespond") } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t("developerMisc.projects.networkError") } }));
    } finally {
      setResponding(null);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.user) {
          const u = sessionData.user;
          setUser(u);
          const userId = u.cid;
          setUserRole(u.role || "developer");
          fetchInvitations(userId);

          const res = await fetch(`/api/projects?user_cid=${userId}`);
          const data = await res.json();
          if (data.success) {
            setProjects(data.projects || []);
          } else {
            const dashRes = await fetch(
              `/api/dashboard?user_id=${userId}&role=${u.role}`,
            );
            const dashData = await dashRes.json();
            if (dashData.success && dashData.quickAccess?.projects) {
              setProjects(dashData.quickAccess.projects);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch projects", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <DashboardLayout role={userRole} activeTab="projects">
      <div className="space-y-8 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("developerMisc.projects.eyebrow")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("developerMisc.projects.title")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("developerMisc.projects.subtitle")}
            </p>
          </div>
        </header>

        {/* Pending Project Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              {t("developerMisc.projects.invitations", { count: invitations.length })}
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
                        {inv.project_name || t("developerMisc.projects.defaultProject")}
                      </h3>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {t("developerMisc.projects.invitedYou")}
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
                        {t("developerMisc.projects.decline")}
                      </button>
                      <button
                        onClick={() =>
                          handleInvitationResponse(inv.id, "accept")
                        }
                        disabled={responding === inv.id}
                        className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40"
                      >
                        {t("developerMisc.projects.accept")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <Briefcase className="w-16 h-16 text-slate-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {t("developerMisc.projects.noProjects")}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {t("developerMisc.projects.noProjectsHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="ios-card !p-6 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight mb-1">
                  {project.name || t("developerMisc.projects.untitledProject")}
                </h3>
                <p className="text-[10px] font-bold text-slate-500">
                  {project.status || "active"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
