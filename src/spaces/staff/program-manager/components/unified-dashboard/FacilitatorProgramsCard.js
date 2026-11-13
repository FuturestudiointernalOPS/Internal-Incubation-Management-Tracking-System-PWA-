"use client";

import { Users } from "lucide-react";

/**
 * MY FACILITATOR PROGRAMMES — the programme-scoped facilitator assignments, for
 * anyone who holds one whatever their role.
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function FacilitatorProgramsCard({ t, programs, onOpenProgram }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("dashboard.facilitatorPrograms", "My Facilitator Programs")}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            ({programs.length})
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {programs.map((program) => (
          <div
            key={program.id}
            onClick={() => onOpenProgram(program)}
            className="p-4 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-brand-orange/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)]">
                {program.status || "Active"}
              </span>
            </div>
            <p className="text-[11px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--brand-orange)] transition-colors">
              {program.name}
            </p>
            {program.description && (
              <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                {program.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
