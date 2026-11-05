"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";

/**
 * Admin → Ventures → [Venture] → Journey ("Journey" tab of the Venture hub)
 * Super Admin surface for the Venture's staff-defined journey — and nothing
 * else. The Venture's work items have their own page: `/projects`.
 */
export default function VentureJourneyPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/ventures/${id}`);
        const payload = await response.json();
        if (payload.success) setVenture(payload.venture);
      } catch (error) {
        console.error("Failed to load venture:", error);
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
    <div className="stf mx-auto max-w-5xl" style={{ paddingBottom: 60 }}>

      <div className="stf-head" style={{ marginTop: 14 }}>
        <div>
          <h1 className="stf-title">{t("vadmin.journey.title")}</h1>
          <p className="stf-sub">
            {t("vadmin.journey.subtitle", { company: venture?.company_name, code: venture?.venture_id })}
          </p>
        </div>
      </div>

      <JourneyManagerPanel ventureId={id} />
    </div>
  );
}
