"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2, ChevronRight, ShieldAlert } from "lucide-react";

/**
 * Staff → Ventures — My Ventures (delegated).
 * Lists only the Ventures this staff member is explicitly assigned to.
 */
export default function StaffVenturesList() {
  const router = useRouter();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ventures/assigned");
        const d = await res.json();
        if (d.success) setAssignments(d.assignments || []);
      } catch (e) {
        console.error("Failed to load my Venture assignments:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
          <Rocket className="w-6 h-6 text-[var(--brand-orange)]" /> My Ventures
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Ventures assigned to you — access is per assignment, never by staff role alone.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="card text-center py-16">
          <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-[var(--text-primary)]">No Venture assignments yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            When the Super Admin assigns you as a Lead Manager, Coach or Facilitator for a Venture, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const displayName = a.company_name || a.name || a.venture_id;
            return (
              <button
                key={a.id}
                onClick={() => router.push(`/staff/ventures/${a.venture_id}`)}
                className="w-full card hover:border-[var(--brand-orange)]/40 transition-all text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
                      <Rocket className="w-5 h-5 text-[var(--brand-orange)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[var(--text-primary)] truncate">{displayName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{a.venture_id}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                          {a.responsibility_name || a.responsibility_code}
                        </span>
                        {a.scope_type !== "venture_wide" && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {a.scope_type}{a.scope_ref_id ? ` · ${a.scope_ref_id}` : ""}
                          </span>
                        )}
                        <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">
                          {a.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
