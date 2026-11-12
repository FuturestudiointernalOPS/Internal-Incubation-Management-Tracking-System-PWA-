"use client";

import { Calendar, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import CalendarPanel from "@/components/ui/CalendarPanel";
import { useI18n } from "@/lib/i18n";
import { useApiMulti } from "@/lib/hooks/useApi";

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

// Module scope on purpose: the hook keys its internal callback on this array and
// on the transformations it carries, so inline values would give them a new
// identity on every render and refetch in a loop.
//
// A read that fails reports null rather than an empty list. The difference
// matters below: an empty program list is what tells a facilitator they have no
// role yet, so it must not be manufactured by a request that failed.
const pickDashboardEvents = (response) =>
  response?.success ? response.events || [] : null;
const pickDashboardPrograms = (response) =>
  response?.success ? response.programs || [] : null;
const FACILITATOR_DASHBOARD_ENDPOINTS = [
  { key: "events", url: "/api/calendar", transform: pickDashboardEvents },
  {
    key: "programs",
    url: "/api/pm/programs?my_facilitator=1",
    transform: pickDashboardPrograms,
  },
];

export default function FacilitatorDashboard() {
  const { t } = useI18n();
  // Both reads' loaders — the cache-first paint, the stale-response discard and
  // the background refresh — belong to the hook, so the screen keeps no data
  // state of its own and never sets state from an effect.
  const { data, loading } = useApiMulti(FACILITATOR_DASHBOARD_ENDPOINTS);
  const allEvents = data.events || [];
  const programsLoaded = Array.isArray(data.programs);
  const programs = programsLoaded ? data.programs : [];

  // Upcoming list = future events; the calendar panel shows the full month.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = allEvents
    .filter((event) => event.date && new Date(event.date) >= today)
    .sort((eventA, eventB) => new Date(eventA.date) - new Date(eventB.date))
    .slice(0, 8);

  // A facilitator with no assigned programs has no role in the system yet. This
  // is only asserted from a read that actually succeeded.
  const hasNoRole = programsLoaded && programs.length === 0;

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  Assigned programs
                </p>
                <p className="text-2xl font-black tracking-tight text-[var(--text-primary)] mt-2">
                  {programs.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  Upcoming activities
                </p>
                <p className="text-2xl font-black tracking-tight text-[var(--text-primary)] mt-2">
                  {upcoming.length}
                </p>
              </div>
            </div>

            {/* Facilitator with no assigned programs / no role in the system */}
            {hasNoRole && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-sm font-medium text-amber-400">
                  {t("pmMisc.contacts.noProgramsAssigned")}
                </p>
              </div>
            )}

            {/* Calendar (reused CalendarPanel from the shared UI library) + upcoming list */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <CalendarPanel events={allEvents} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    Upcoming
                  </h2>
                </div>

                {upcoming.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-10 text-center">
                    <CheckCircle2 className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      No upcoming activities
                    </p>
                  </div>
                ) : (
                  upcoming.map((event) => {
                  const eventMeta = EVENT_META[event.source] || {
                    label: event.type || event.source,
                    color: "text-[var(--text-secondary)]",
                    bg: "bg-tertiary",
                  };
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border-primary)] bg-secondary"
                    >
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase shrink-0 ${eventMeta.bg} ${eventMeta.color}`}>
                        {eventMeta.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{event.title}</p>
                        {event.description && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
