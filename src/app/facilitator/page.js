"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * FACILITATOR DASHBOARD
 * Operational overview: upcoming sessions, deadlines and follow-ups for the
 * programs this facilitator is assigned to.
 */

const EVENT_META = {
  session: { label: "Session", color: "text-amber-400", bg: "bg-amber-500/15" },
  deliverable_due: { label: "Deadline", color: "text-purple-400", bg: "bg-purple-500/15" },
  followup: { label: "Follow-up", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  program_start: { label: "Program start", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  program_end: { label: "Program end", color: "text-rose-400", bg: "bg-rose-500/15" },
};

export default function FacilitatorDashboard() {
  const { t } = useI18n();
  const [events, setEvents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/calendar").then((r) => r.json()),
      fetch("/api/pm/programs?my_facilitator=1").then((r) => r.json()),
    ])
      .then(([cal, prog]) => {
        const raw = cal.success ? cal.events || [] : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = raw
          .filter((e) => e.date && new Date(e.date) >= today)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 8);
        setEvents(upcoming);
        if (prog.success) setPrograms(prog.programs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout role="facilitator" activeTab="dashboard">
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            Dashboard
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-1">
            Your upcoming sessions, deadlines and follow-ups.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  Assigned programs
                </p>
                <p className="text-3xl font-black text-[var(--brand-orange)] mt-2">
                  {programs.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  Upcoming activities
                </p>
                <p className="text-3xl font-black text-[var(--brand-orange)] mt-2">
                  {events.length}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                <h2 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">
                  Upcoming
                </h2>
              </div>

              {events.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-10 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3" />
                  <p className="text-[11px] font-black uppercase text-[var(--text-secondary)]">
                    No upcoming activities
                  </p>
                </div>
              ) : (
                events.map((e) => {
                  const meta = EVENT_META[e.source] || {
                    label: e.type || e.source,
                    color: "text-[var(--text-secondary)]",
                    bg: "bg-slate-500/15",
                  };
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border-primary)] bg-secondary"
                    >
                      <span className={`px-2 py-1 rounded text-[8px] font-black uppercase shrink-0 ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold truncate">{e.title}</p>
                        {e.description && (
                          <p className="text-[9px] text-[var(--text-secondary)] truncate">
                            {e.description}
                          </p>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-[var(--text-secondary)] shrink-0">
                        {new Date(e.date).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
