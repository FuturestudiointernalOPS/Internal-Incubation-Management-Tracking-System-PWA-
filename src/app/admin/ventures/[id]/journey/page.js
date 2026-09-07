"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Route } from "lucide-react";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";

/**
 * Admin → Ventures → [Venture] → Journey
 * Super Admin surface for the Venture's staff-defined journey.
 */
export default function VentureJourneyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${id}`);
        const d = await res.json();
        if (d.success) setVenture(d.venture);
      } catch (e) {
        console.error("Failed to load venture:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> Back to {venture?.company_name || "Venture"}
      </button>

      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
            <Route className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">Venture Journey</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {venture?.company_name} · {venture?.venture_id} — staff-defined operating path shown to the Venture
            </p>
          </div>
        </div>
      </div>

      <JourneyManagerPanel ventureId={id} />
    </div>
  );
}
