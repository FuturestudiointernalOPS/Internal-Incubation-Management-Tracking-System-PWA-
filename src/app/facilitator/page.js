"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, ChevronRight, Users, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * FACILITATOR DASHBOARD
 * Lists only the programs this facilitator is assigned to (server-scoped).
 */

export default function FacilitatorDashboard() {
  const { t } = useI18n();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pm/programs")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPrograms(d.programs || []);
      })
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout role="facilitator" activeTab="dashboard">
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            My Programs
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-1">
            Programs you are assigned to as a facilitator. Access is limited to
            these programs only.
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
              Once a Program Manager assigns you, your programs will appear
              here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {programs.map((p) => (
              <a
                key={p.id}
                href={`/facilitator/program/${p.id}`}
                className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-primary)] bg-secondary hover:border-[var(--brand-orange)] transition-all"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-black uppercase truncate">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-[var(--text-secondary)] uppercase">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {p.participants_count || 0} participants
                    </span>
                    <span>{p.status || "—"}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
              </a>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
