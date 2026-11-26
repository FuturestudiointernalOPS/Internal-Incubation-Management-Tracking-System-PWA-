"use client";

import { Trash2 } from "lucide-react";
import { FACILITATOR_CAPS } from "./capabilities";

/** One assigned facilitator: their identity, removal, and per-capability overrides. */
export default function AssignedFacilitatorCard({ facilitator, t, onRemove, onToggleOverride }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase truncate">{facilitator.name || facilitator.email || facilitator.cid}</p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{facilitator.email && facilitator.email !== facilitator.name ? facilitator.email : ""}</p>
        </div>
        <button
          onClick={onRemove}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-400 hover:underline shrink-0"
        >
          <Trash2 className="w-3 h-3" /> {t("pmMisc.facilitators.remove")}
        </button>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          {t("pmMisc.facilitators.individualOverrides")}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {FACILITATOR_CAPS.map((capability) => {
            const active = !!(facilitator.permissions || {})[capability.key];
            return (
              <button
                key={capability.key}
                onClick={() => onToggleOverride(capability.key)}
                className={`p-2 rounded-lg border text-left text-[10px] font-bold uppercase truncate transition-all ${active ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
              >
                {t(capability.label)}
                {active ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
