"use client";

import { Rocket } from "lucide-react";
import { PROGRAM_ROLE_LABELS } from "./constants";

/**
 * Programs tab — the person's active and past program engagements.
 */
export default function ProgramsTab({ programs, t }) {
  return (
    <div className="space-y-6">
      {programs.length === 0 ? (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <Rocket className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-sm font-bold">{t("crm.people.noPrograms")}</p>
        </div>
      ) : (
        <>
          {[
            { title: t("crm.people.activeEngagements"), rows: programs.filter(program => program.status === "active") },
            { title: t("crm.people.pastEngagements"), rows: programs.filter(program => program.status !== "active") },
          ].map(engagementGroup => engagementGroup.rows.length === 0 ? null : (
            <div key={engagementGroup.title} className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">{engagementGroup.title}</h3>
              <div className="space-y-2">
                {engagementGroup.rows.map((program) => (
                  <div key={`${program.program_id}-${program.role}`} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-primary">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{program.program_name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                        {t(PROGRAM_ROLE_LABELS[program.role] || "") || program.role}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${program.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-tertiary text-[var(--text-secondary)] border-[var(--border-primary)]"}`}>
                      {program.status === "active" ? t("crm.people.activeStatus") : t("crm.people.completedStatus")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
