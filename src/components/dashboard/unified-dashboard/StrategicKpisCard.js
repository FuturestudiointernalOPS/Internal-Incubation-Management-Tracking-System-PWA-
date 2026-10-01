"use client";

import { TrendingUp } from "lucide-react";

/**
 * STRATEGIC KPIs — the objectives grouped by programme, with the programme's
 * progress bar.
 *
 * Extracted verbatim from UnifiedDashboard. The grouping is presentation (which
 * programme an objective belongs to), so it happens here; whether the block is
 * shown at all is the screen's decision.
 */
export default function StrategicKpisCard({ kpis, programs }) {
  const grouped = {};
  (kpis || []).forEach((kpi) => {
    if (!grouped[kpi.program_id]) grouped[kpi.program_id] = [];
    grouped[kpi.program_id].push(kpi);
  });

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[var(--brand-orange)]" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          Strategic KPIs
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).slice(0, 3).map(([programId, programKpis]) => {
          const program = (programs || []).find(
            (candidate) => String(candidate.id) === String(programId),
          );
          return (
            <div key={programId} className="space-y-2">
              {program && (
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {program.name}
                </span>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {programKpis.slice(0, 6).map((kpi) => {
                  const percent = Math.round(parseFloat(kpi.completion_rate) || 0);
                  return (
                    <div
                      key={kpi.kpi_id}
                      className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase truncate max-w-[80px]">
                          {kpi.title || kpi.name}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--brand-orange)]">
                          {Math.round(percent)}%
                        </span>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-amber-400 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
