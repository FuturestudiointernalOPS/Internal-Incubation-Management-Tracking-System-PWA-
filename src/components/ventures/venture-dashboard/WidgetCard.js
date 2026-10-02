"use client";

import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The framed tile every venture-dashboard widget lives in: a title, an optional
 * refresh, and the loading / error / empty / content states.
 * Extracted verbatim from VentureDashboard.
 */
export default function WidgetCard({ title, icon: Icon, iconColor, children, loading, error, onRefresh, empty, emptyMessage }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor || "bg-brand-orange/10"}`}>
            <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
          </div>
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{title}</h3>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="p-1.5 hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className={`w-3 h-3 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
          <p className="text-[10px] font-bold text-rose-400">{error}</p>
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Icon className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">{emptyMessage || t("vadmin.dashboard.noDataAvailable")}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
