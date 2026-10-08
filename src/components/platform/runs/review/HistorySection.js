"use client";

import { History, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/components/admin/dashboard-page/constants";

export default function HistorySection({
  showHistory,
  setShowHistory,
  timeline,
  t,
}) {
  return (
    <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
      <button onClick={() => setShowHistory(!showHistory)} className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-tertiary/30 transition-colors">
        <History className="w-5 h-5 text-[var(--text-secondary)]" />
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)] flex-1">{t("platformMisc.runReview.history")}</h2>
        {showHistory ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
      </button>
      {showHistory && (
        <div className="px-6 py-4 border-t border-[var(--border-primary)] space-y-3">
          {timeline.length === 0 ? (
            <p className="text-[10px] font-medium text-[var(--text-secondary)] text-center py-4">{t("platformMisc.runReview.noActivity")}</p>
          ) : (
            timeline.map((entry, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={cn("w-2 h-2 mt-1.5 rounded-full shrink-0",
                  entry.action === "submitted" ? "bg-blue-500" :
                  entry.action === "approved" ? "bg-emerald-500" :
                  entry.action === "rejected" ? "bg-rose-500" :
                  entry.action === "ai_evaluated" ? "bg-purple-500" : "bg-[var(--brand-orange)]"
                )} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">{entry.action}</p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">{new Date(entry.created_at).toLocaleString()}{entry.actor_name ? ` · ${entry.actor_name}` : ""}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
