"use client";

import { Briefcase, ChevronRight, Users, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

export const dynamic = "force-dynamic";

/**
 * FACILITATOR PROGRAMS
 * Lists the programs this facilitator is assigned to, with program details.
 */

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickFacilitatorPrograms = (response) =>
  response?.success ? response.programs || [] : [];

export default function FacilitatorPrograms() {
  useI18n();
  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no data state of its own and never sets state from an effect.
  const { data: programs, loading } = useApi("/api/pm/programs?my_facilitator=1", {
    defaultValue: [],
    transform: pickFacilitatorPrograms,
  });

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            My Programs
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-1">
            Programs you are assigned to as a facilitator.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-10 text-center">
            <Briefcase className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3" />
            <p className="text-[11px] font-black uppercase text-[var(--text-secondary)]">
              No programs assigned yet
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              Once a Program Manager assigns you, your programs will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {programs.map((program) => (
              <a
                key={program.id}
                href={`/facilitator/program/${program.id}`}
                className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-primary)] bg-secondary hover:border-[var(--brand-orange)] transition-all"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-black uppercase truncate">
                    {program.name}
                  </p>
                  {program.description && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {program.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {program.participants_count || 0} participants
                    </span>
                    <span>{program.status || "—"}</span>
                    {program.duration_weeks ? <span>{program.duration_weeks} wks</span> : null}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
