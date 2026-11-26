"use client";

import { ChevronRight, Layers, Rocket, Sparkles, Zap } from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";
import { programStatusLabel } from "./constants";

/**
 * The recent-activity feed: the six latest log lines, or its empty state.
 * Extracted verbatim from app/admin/page.js.
 */
export function ActivityFeed({ activity, loading, lang }) {
  const { t } = useI18n();
  return (
    <div className="lg:col-span-2 card">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--brand-orange)]" />{" "}
          {t("reports.recentReports")}
        </h4>
      </div>
      <div className="space-y-3">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : activity.length > 0 ? (
          activity.slice(0, 6).map((log, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-tertiary transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:border-[var(--brand-orange)]">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                  {log.action}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">
                  {log.user || t("adminMisc.dashboard.system")} ·{" "}
                  {new Date(log.timestamp).toLocaleTimeString(lang)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--border-primary)]" />
            </div>
          ))
        ) : (
          <AppEmptyState
            size="sm"
            icon={Sparkles}
            title={t("reports.noActivity")}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The active-programmes list: each row opening the programme, or its empty
 * state.
 * Extracted verbatim from app/admin/page.js.
 */
export function ActiveProgramsCard({ programs, loading, lang, onOpen, onViewAll }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-500" />{" "}
          {t("admin.activePrograms")}
        </h4>
        <button
          onClick={onViewAll}
          className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
        >
          {t("common.viewAll")}
        </button>
      </div>
      <div className="space-y-3">
        {loading ? (
          <TableSkeleton rows={3} />
        ) : programs.length > 0 ? (
          programs.map((program, _i) => (
            <div
              key={program.id}
              onClick={() => onOpen(program)}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-tertiary transition-all cursor-pointer group border border-transparent hover:border-[var(--border-primary)]"
            >
              <div className="w-8 h-8 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                <Rocket className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                  {program.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-500/10 rounded">
                    {programStatusLabel(t, program.status)}
                  </span>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                    {new Date(program.created_at).toLocaleDateString(lang)}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-3 h-3 text-[var(--border-primary)]" />
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
            {t("common.noResults")}
          </p>
        )}
      </div>
    </div>
  );
}