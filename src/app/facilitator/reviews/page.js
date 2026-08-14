"use client";

import React, { useState, useEffect } from "react";
import { ClipboardList, Loader2, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * FACILITATOR — MY REVIEWS
 * All reviews submitted by this facilitator across their programs,
 * including Program Manager decisions.
 */

export default function FacilitatorReviews() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/facilitator-reviews")
      .then((r) => r.json())
      .then((d) => setReviews(d.success ? d.reviews || [] : []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout role="facilitator" activeTab="reviews">
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            My Reviews
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-1">
            Reviews you submitted to your Program Managers, with their
            decisions.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-10 text-center">
            <ClipboardList className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3" />
            <p className="text-[11px] font-black uppercase text-[var(--text-secondary)]">
              No reviews yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase">
                    Review #{r.id}
                  </p>
                  <span
                    className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                      r.status === "decided"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-[9px] text-[var(--text-secondary)]">
                  Submitted {new Date(r.created_at).toLocaleString()} · Program{" "}
                  {r.program_id}
                </p>
                {r.participant_progress && (
                  <p className="text-[9px] text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      Progress:
                    </strong>{" "}
                    {r.participant_progress}
                  </p>
                )}
                {r.pm_decision && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">
                      PM Decision
                    </p>
                    <p className="text-[9px] text-[var(--text-primary)]">
                      {r.pm_decision}
                    </p>
                    {r.pm_decision_note && (
                      <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                        {r.pm_decision_note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
