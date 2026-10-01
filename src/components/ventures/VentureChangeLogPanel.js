"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";

const ACTIONS = ["created", "updated", "activated", "locked", "reopened", "deleted", "moved", "applied"];
const ENTITIES = ["journey", "milestone", "task", "deliverable", "dependency", "import"];

/**
 * VentureChangeLogPanel — what changed on this Venture, from what, to what, and
 * who did it.
 *
 * The living-system model needs this: a Journey that was re-dated six weeks ago
 * by someone who has since left is exactly the thing an institution forgets, and
 * exactly the thing a new programme manager needs. Rows are written by the choke
 * points as the change happens and are never edited afterwards, so this is a
 * record rather than another view to keep in step.
 *
 * Collapsed by default: history answers a question, it is not the daily screen.
 */
export default function VentureChangeLogPanel({ ventureId }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  const { data: changes, loading, error } = useApi(
    ventureId ? `/api/ventures/${ventureId}/changes?limit=50` : null,
    { defaultValue: [], transform: (payload) => (payload?.success ? payload.changes || [] : []) },
  );

  // A verb the panel does not know is shown as it was stored rather than hidden —
  // an untranslated word beats a missing event.
  const actionLabel = (action) => (ACTIONS.includes(action) ? t(`venture.changes.actions.${action}`) : action);
  const entityLabel = (type) => (ENTITIES.includes(type) ? t(`venture.changes.entities.${type}`) : type);
  const show = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

  return (
    <div className="card mb-4">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
      >
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.changes.title")}
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{changes.length}</span>
        </h3>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] text-slate-400">{t("venture.changes.intro")}</p>

          {loading && changes.length === 0 && (
            <div className="text-center py-4">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
            </div>
          )}

          {error && (
            <p className="text-[10px] text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t("venture.changes.loadError")}
            </p>
          )}

          {!loading && !error && changes.length === 0 && (
            <p className="text-[10px] text-slate-500">{t("venture.changes.empty")}</p>
          )}

          {changes.length > 0 && (
            <ul className="divide-y divide-divider/60 rounded-xl border border-[var(--border-primary)] overflow-hidden">
              {changes.map((change) => (
                <li key={change.id} className="px-3 py-2 text-[10px]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-slate-500">
                      {change.created_at ? new Date(change.created_at).toLocaleString(lang) : ""}
                    </span>
                    <span className="font-black uppercase tracking-widest text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {entityLabel(change.entity_type)}
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">{change.entity_label || "—"}</span>
                    <span className="text-[var(--text-secondary)]">{actionLabel(change.action)}</span>
                    {change.actor_name && (
                      <span className="text-slate-500">{t("venture.changes.by", { name: change.actor_name })}</span>
                    )}
                  </div>
                  {change.field_name && (
                    <p className="mt-0.5 text-[var(--text-secondary)]">
                      <span className="text-slate-500">{change.field_name}</span>: {show(change.old_value)} →{" "}
                      {show(change.new_value)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
