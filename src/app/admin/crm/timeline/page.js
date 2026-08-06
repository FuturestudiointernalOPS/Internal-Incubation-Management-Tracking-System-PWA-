"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Clock, Filter, User, ChevronRight, Search } from "lucide-react";
import Link from "next/link";

const MODULE_COLORS = {
  forms: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  programs: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ventures: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  investors: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  communications: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  crm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

function TimelinePageContent() {
  const searchParams = useSearchParams();
  const cid = searchParams.get("cid");

  const [contact, setContact] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("");

  useEffect(() => {
    if (!cid) return;
    async function fetchTimeline() {
      setLoading(true);
      try {
        const url = `/api/contacts/${cid}/timeline?limit=100${moduleFilter ? `&module=${moduleFilter}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setContact(data.contact);
          setEvents(data.events || []);
        }
      } catch (e) {
        console.error("Timeline fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, [cid, moduleFilter]);

  // Group events by year
  const eventsByYear = {};
  for (const ev of events) {
    const year = new Date(ev.created_at).getFullYear();
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(ev);
  }
  const sortedYears = Object.keys(eventsByYear).sort((a, b) => b - a);

  if (!cid) {
    return (
      <DashboardLayout role="super_admin" activeTab="crm">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-10 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
            <h2 className="text-lg font-black uppercase mb-2">Select a Contact</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              View a person's complete timeline by navigating from the CRM dashboard or contacts list.
            </p>
            <Link
              href="/admin/crm"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl"
            >
              Back to CRM
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin" activeTab="crm">
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link href="/admin/crm" className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)]">
              ← CRM
            </Link>
            <h1 className="text-xl font-black uppercase tracking-tight mt-1">
              {contact ? contact.name : "Timeline"}
            </h1>
            {contact && (
              <p className="text-xs text-[var(--text-secondary)]">
                {contact.email} · {contact.role || "unassigned"}
              </p>
            )}
          </div>
        </div>

        {/* Module Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "", label: "All" },
            { key: "forms", label: "Forms" },
            { key: "programs", label: "Programs" },
            { key: "ventures", label: "Ventures" },
            { key: "investors", label: "Investors" },
            { key: "communications", label: "Comms" },
            { key: "system", label: "System" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setModuleFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                moduleFilter === f.key
                  ? "bg-[var(--brand-orange)] text-black border-orange-600"
                  : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-10">
            <p className="text-sm text-[var(--text-secondary)]">Loading timeline...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-10 text-center">
            <Clock className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm font-bold mb-1">No events yet</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {contact?.name || "This person"}'s timeline will populate as they interact with Future Studio.
              Events from Forms, Programs, Ventures, and more will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedYears.map((year) => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-3 h-3 rounded-full bg-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    {year}
                  </h2>
                </div>
                <div className="space-y-2 pl-6 border-l-2 border-[var(--border-primary)]">
                  {eventsByYear[year].map((ev) => (
                    <div key={ev.id} className="relative pl-6 pb-4">
                      {/* Timeline dot */}
                      <div className="absolute left-[-23px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--border-primary)] border-2 border-primary" />
                      <div className="bg-primary border border-[var(--border-primary)] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold">{ev.description}</p>
                          {ev.context_module && (
                            <span
                              className={`shrink-0 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                MODULE_COLORS[ev.context_module] || MODULE_COLORS.system
                              }`}
                            >
                              {ev.context_module}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                          {new Date(ev.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[var(--text-secondary)] text-center italic">
          Timeline — Phase 1. Events are backfilled from existing audit data.
        </p>
      </div>
    </DashboardLayout>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading...</div>}>
      <TimelinePageContent />
    </Suspense>
  );
}
