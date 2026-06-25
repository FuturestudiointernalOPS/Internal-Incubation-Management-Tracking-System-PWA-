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

export default function DeveloperProjects() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("developer");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.user) {
          const userId = sessionData.user.cid;
          const res = await fetch(`/api/projects?user_cid=${userId}`);
          const data = await res.json();
          if (data.success) {
            setProjects(data.projects || []);
          } else {
            // Fallback: try dashboard API
            const dashRes = await fetch(
              `/api/dashboard?user_id=${userId}&role=${sessionData.user.role}`,
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
                Developer Workspace
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              My Projects
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Projects you are working on
            </p>
          </div>
        </header>

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
              No projects
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Projects assigned to you will appear here
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
                  {project.name || "Untitled Project"}
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
