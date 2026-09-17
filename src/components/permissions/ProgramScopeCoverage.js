"use client";

import React from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * COVERAGE — where the program record-scope rule does and does not reach.
 *
 * There is no switch to render: the rule is enforced on every wired write
 * surface, unconditionally. What an administrator still needs to know is the
 * opposite question — where it does NOT reach — so this block publishes that.
 *
 * It is deliberately prominent rather than a footnote. Three legacy V2 route
 * files carry a project banner reserving them for V1 pages and instructing
 * agents to leave them read-only, so their endpoints stay open until a human
 * converts them. A domain that is not fully covered must never read as closed.
 *
 * Read-only: nothing here changes or authorises anything.
 */
export default function ProgramScopeCoverage({ report }) {
  const { t } = useI18n();
  const rows = Array.isArray(report?.coverage) ? report.coverage : [];
  const exemptSurfaces = Number(report?.summary?.exemptSurfaces ?? 0);

  /** A wave's own label, in the active language when a translation exists. */
  function waveLabel(row) {
    const key = `engineering.permissions.programScopeWaveLabel_${row.wave}`;
    const value = t(key);
    return value === key ? row.label || row.wave : value;
  }

  function waveCovers(row) {
    const key = `engineering.permissions.programScopeWaveCovers_${row.wave}`;
    const value = t(key);
    return value === key ? row.covers || "" : value;
  }

  return (
    <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <ShieldCheck className="h-3 w-3 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programScopeCoverageTitle")}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeCoverageBody")}
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeCoverageEmpty")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.wave}
              className={`space-y-1 rounded-lg border px-3 py-2 ${
                row.partial
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-[var(--border-primary)] bg-surface-2"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  {row.partial ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-orange)]" />
                  )}
                  {waveLabel(row)}
                </span>
                <span
                  className={`text-[9px] font-black uppercase tracking-widest ${
                    row.partial ? "text-amber-400" : "text-[var(--brand-orange)]"
                  }`}
                >
                  {row.partial
                    ? t("engineering.permissions.programScopeCoveragePartial")
                    : t("engineering.permissions.programScopeCoverageFull")}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                {waveCovers(row)}
              </p>

              {row.partial && (row.exempt || []).length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <p className="text-[10px] font-bold leading-relaxed text-amber-400">
                    {t("engineering.permissions.programScopeCoverageExemptTitle")}
                  </p>
                  <ul className="space-y-0.5">
                    {row.exempt.map((surface) => (
                      <li
                        key={surface}
                        className="text-[10px] leading-relaxed text-[var(--text-secondary)]"
                      >
                        {surface}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {exemptSurfaces > 0 && (
        <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeCoverageSummary")}
        </p>
      )}
    </div>
  );
}
