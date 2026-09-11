"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";

/**
 * Admin → Ventures → [Venture] → Journey
 * Super Admin surface for the Venture's staff-defined journey.
 */
export default function VentureJourneyPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("vadmin.journey.backToVenture", { name: venture?.company_name || t("vadmin.dashboard.venture") })}
      </button>

      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
            <Route className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">{t("vadmin.journey.title")}</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {t("vadmin.journey.subtitle", { company: venture?.company_name, code: venture?.venture_id })}
            </p>
          </div>
        </div>
      </div>

      <JourneyManagerPanel ventureId={id} />
    </div>
  );
}
