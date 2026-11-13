"use client";

import { Rocket } from "lucide-react";

/**
 * MY PROJECTS — the compact rows, each with its status and the person's role on
 * the project (owner or collaborator).
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function MyProjectsCard({ t, projects, onOpenProject }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Rocket className="w-4 h-4 text-[var(--brand-orange)]" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("dashboard.myProjects", "Mes Projets")}
        </span>
        <span className="text-[10px] font-bold text-[var(--text-secondary)] ml-auto">
          {projects?.length || 0}
        </span>
      </div>
      <div className="space-y-2">
        {projects?.slice(0, 5).map((project) => (
          <div
            key={project.id}
            onClick={() => onOpenProject(project)}
            className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-tertiary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)]"
          >
            <div className="w-7 h-7 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center shrink-0">
              <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                {project.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                  {project.status || "Active"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                  {project.role === "owner"
                    ? t("roles.owner", "Propriétaire")
                    : t("roles.collaborator", "Collaborateur")}
                </span>
              </div>
            </div>
          </div>
        ))}
        {(!projects || projects.length === 0) && (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
            {t("dashboard.noProjects", "Aucun projet assigné")}
          </p>
        )}
      </div>
    </div>
  );
}
