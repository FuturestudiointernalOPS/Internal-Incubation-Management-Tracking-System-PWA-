"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, X, AlertCircle } from "lucide-react";

/**
 * StartupBroadcastBanner
 * 
 * Checks if there is an active census or form broadcast for this venture.
 * If the venture hasn't completed it, renders an attention-grabbing executive banner.
 * Auto-dismisses when the startup submits the form.
 */
export default function StartupBroadcastBanner({ ventureId, ventureName }) {
  const [broadcast, setBroadcast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!ventureId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function checkBroadcast() {
      try {
        const res = await fetch(`/api/admin/ventures/broadcasts?venture_id=${encodeURIComponent(ventureId)}`);
        const json = await res.json();
        if (isMounted && json.success && json.activeBroadcast) {
          setBroadcast(json.activeBroadcast);
        }
      } catch (err) {
        // Silently handle
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkBroadcast();
    return () => { isMounted = false; };
  }, [ventureId]);

  if (loading || !broadcast || dismissed) return null;

  const targetUrl = `/s/${broadcast.form_run_slug}?venture_id=${encodeURIComponent(
    ventureId
  )}&name=${encodeURIComponent(ventureName || "")}`;

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 via-orange-600/10 to-amber-500/10 p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/30">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                Action Required
              </span>
              <h4 className="font-semibold text-[var(--text-primary)] text-sm">
                {broadcast.title}
              </h4>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              {broadcast.message ||
                `Please complete this periodic performance & impact census for ${ventureName || "your startup"}. Unanswered or pre-stage metrics can be left blank.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-orange)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 active:scale-95"
          >
            <span>{broadcast.button_text || "Complete Census"}</span>
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-white/5"
            title="Dismiss for this session"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
