"use client";

/**
 * NOTICES — the rules panels under the matrix, extracted from
 * `EligibilityView.js`: the eligibility hint, the identity-groups note and the
 * read-only banner shown when the viewer cannot configure the matrix.
 *
 * Returns a fragment so its three children stay direct children of the view's
 * root — no wrapper element is added.
 *
 * Split out verbatim, behaviour identical.
 */

import { Info } from "lucide-react";

export default function EligibilityNotices({ t, canConfigure, alerts = [], unassignable = [] }) {
  return (
    <>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/20">
        <Info className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.eligibilityHint")}
        </p>
      </div>

      {/* §12.3 — configuration alert: a ceiling that opens onto nothing. */}
      {alerts.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            {t("engineering.permissions.eligibilityCeilingAlertTitle")}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.eligibilityCeilingAlertHint")}
          </p>
          <ul className="space-y-0.5">
            {alerts.map((alert) => (
              <li
                key={`${alert.identityType}:${alert.identityValue}:${alert.feature}`}
                className="text-[10px] font-bold text-[var(--text-primary)]"
              >
                {t("engineering.permissions.eligibilityCeilingAlertItem", {
                  identity: alert.identityValue,
                  feature: alert.feature,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* §12.3 — configuration alert: a profile no baseline role may hold. */}
      {unassignable.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            {t("engineering.permissions.eligibilityUnassignableTitle")}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.eligibilityUnassignableHint")}
          </p>
          <ul className="space-y-0.5">
            {unassignable.map((entry) => (
              <li key={entry.key} className="text-[10px] font-bold text-[var(--text-primary)]">
                {entry.key}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
        {t("engineering.permissions.identityGroupsNote")}
      </p>

      {!canConfigure && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-[10px] font-bold text-amber-400">
            {t("engineering.permissions.eligibilityReadOnly")}
          </p>
        </div>
      )}
    </>
  );
}
