"use client";

import {
  ArrowLeft,
  Briefcase,
  Calendar,
  RefreshCw,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PROJECT_STATUS_LABELS, STATUS_BG, STATUS_COLORS } from "./constants";

/**
 * The project's page header: the back link, the project name with its status
 * badge, the owner and start/end dates, and the refresh button.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function ProjectHeader({ project, onBack, onRefresh }) {
  const { t } = useI18n();
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
          {t("staffMisc.projectDetail.allProjects")}
        </button>
        <div className="flex items-center gap-3 mt-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl lg:text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                {project.name}
              </h1>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded ${STATUS_BG[project.status] || "bg-slate-500/10"} ${STATUS_COLORS[project.status] || "text-slate-400"}`}
              >
                {project.status &&
                  t(PROJECT_STATUS_LABELS[project.status] || project.status)}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              {project.owner_name && (
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                  <User className="w-3 h-3" />
                  <span className="font-bold">{project.owner_name}</span>
                </div>
              )}
              {project.start_date && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <Calendar className="w-3 h-3" />
                  <span className="font-bold">
                    {t("staffMisc.projectDetail.startDate", {
                      date: new Date(project.start_date).toLocaleDateString(),
                    })}
                  </span>
                </div>
              )}
              {project.end_date && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                  <Calendar className="w-3 h-3" />
                  <span className="font-bold">
                    {t("staffMisc.projectDetail.endDate", {
                      date: new Date(project.end_date).toLocaleDateString(),
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all text-[10px] font-bold uppercase tracking-wide"
      >
        <RefreshCw className="w-3.5 h-3.5" /> {t("staffMisc.projectDetail.refresh")}
      </button>
    </header>
  );
}
