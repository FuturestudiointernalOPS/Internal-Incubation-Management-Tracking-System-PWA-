"use client";

import AppCard from "@/components/ui/AppCard";

/**
 * The Overview tab: venture summary and metric grid.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function OverviewTab({ pipeline, workspace }) {
  return (
    <div className="space-y-4">
      <AppCard padding="lg">
        <div className="space-y-4">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Venture Overview</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{pipeline?.venture_description || "No description available."}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Industry", value: pipeline?.industry || "—" },
              { label: "Country", value: pipeline?.country || "—" },
              { label: "Stage", value: pipeline?.business_stage || "—" },
              { label: "Status", value: workspace.status || "active" },
            ].map((metric, index) => (
              <div key={index} className="p-3 rounded-xl bg-[var(--surface-3)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p>
                <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </AppCard>
    </div>
  );
}
