"use client";

import { ListTodo, Shield, Target, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The four stat cards beneath the header: progress, task count, active
 * blockers and team size.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function ProjectStats({
  project,
  activeBlockersCount,
  memberCount,
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="card flex items-center gap-3 p-4">
        <div className="p-2.5 rounded-xl bg-emerald-500/10">
          <Target className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staffMisc.projectDetail.statProgress")}
          </p>
          <p className="text-xl font-black text-emerald-500">
            {project.completionRate || 0}%
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-3 p-4">
        <div className="p-2.5 rounded-xl bg-white/5">
          <ListTodo className="w-4 h-4 text-[var(--text-primary)]" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staffMisc.projectDetail.statTasks")}
          </p>
          <p className="text-xl font-black">
            {project.taskStats?.total || 0}
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-3 p-4">
        <div className="p-2.5 rounded-xl bg-rose-500/10">
          <Shield className="w-4 h-4 text-rose-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staffMisc.projectDetail.statBlockers")}
          </p>
          <p className="text-xl font-black text-rose-500">
            {activeBlockersCount}
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-3 p-4">
        <div className="p-2.5 rounded-xl bg-blue-500/10">
          <Users className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staffMisc.projectDetail.statTeam")}
          </p>
          <p className="text-xl font-black text-blue-500">
            {memberCount}
          </p>
        </div>
      </div>
    </div>
  );
}
