"use client";

/**
 * ACCESS EXPLANATION PANEL — extracted from `PermissionCenter.js`.
 *
 * The "who has access and why" report: per-feature eligibility with the identity
 * rows that produced it, and the raw capability inputs per module alongside the
 * merged effective matrix. Purely presentational — it receives the explanation
 * the parent resolved and renders it. It must never decide anything itself, or
 * the panel could tell an administrator something the engine would refuse.
 *
 * Split out verbatim, behaviour identical. The boundary is exact: the panel ends
 * where its last `</div>` closes, and the audit ACTION vocabulary that follows
 * belongs to `AuditView`, which reads it to build its filter dropdown.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

export default function AccessExplanationPanel({ explanation, t }) {
  const [open, setOpen] = useState(false);
  const eligibility = explanation.eligibility || {};
  const sources = explanation.sources || {};
  const hasEligibility = Object.keys(eligibility).length > 0;
  const hasSources =
    (sources.profile && Object.keys(sources.profile).length > 0) ||
    (sources.groups && Object.keys(sources.groups).length > 0) ||
    (sources.grants && Object.keys(sources.grants).length > 0);

  if (!hasEligibility && !hasSources) return null;

  const sourceBlock = (labelKey, data) => {
    const entries = Object.entries(data || {}).filter(
      ([, caps]) => caps && Object.keys(caps).length > 0,
    );
    if (entries.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t(labelKey)}
        </p>
        <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">
          {entries
            .map(([mod, caps]) =>
              `${mod}: ${Object.entries(caps)
                .map(([cap, lvl]) => `${cap}=${lvl}`)
                .join(", ")}`,
            )
            .join(" · ")}
        </p>
      </div>
    );
  };

  return (
    <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-tertiary/30 hover:bg-tertiary/50 transition-all"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("engineering.permissions.explanationTitle")}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3 divide-y divide-[var(--border-primary)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.explanationEligibility")}
            </p>
            {Object.keys(eligibility).length === 0 ? (
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                {t("engineering.permissions.explanationNone")}
              </p>
            ) : (
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(eligibility).map(([feature, info]) => (
                  <div key={feature} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        info.eligible ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        {feature}
                      </p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {info.eligible
                          ? t("engineering.permissions.eligibilityEligible")
                          : t("engineering.permissions.eligibilityNotEligible")}
                        {(info.sources || []).length > 0 &&
                          ` — ${info.sources
                            .map(
                              (row) => `${row.identity_type}:${row.identity_value}${Number(row.eligible) === 0 ? " (deny)" : ""}`,
                            )
                            .join(", ")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.explanationSources")}
            </p>
            {sourceBlock(
              "engineering.permissions.explanationDefaultAccess",
              sources.profile,
            )}
            {sourceBlock(
              "engineering.permissions.explanationGroups",
              sources.groups,
            )}
            {sourceBlock(
              "engineering.permissions.explanationGrants",
              sources.grants,
            )}
            {!hasSources && (
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {t("engineering.permissions.explanationNone")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
