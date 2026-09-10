"use client";

import React from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isScopePolicyImplemented } from "@/lib/authorization/scope-catalog";

/**
 * PHASE 5 — Scope Policies (Permission Center).
 *
 * Renders the REAL scope catalogue (shared with the engine, no duplicated
 * vocabulary). Each policy states its honest state:
 *
 *   - implemented → the data-layer predicate exists and is verifiable through
 *     /api/engineering/permissions/scope-check; it is NOT enforced on routes
 *     yet (that is the next, explicitly-approved seam).
 *   - pending     → declared but unimplemented; resolves to DENY (fail-closed),
 *     never silently allowed.
 *
 * Nothing here authorizes anything.
 */
const ROWS = [
  { policyKey: "venture_own", i18nKey: "rowVenture", icon: ShieldCheck },
  { policyKey: "program_assigned", i18nKey: "rowProgram", icon: ShieldCheck },
  { policyKey: "learning_own", i18nKey: "rowLearning", icon: ShieldCheck },
  { policyKey: "team_own", i18nKey: "rowTeam", icon: ShieldAlert },
];

export default function ScopePoliciesView() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4">
        <p className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">
          {t("engineering.permissions.scopePoliciesIntro")}
        </p>
        <p className="mt-2 inline-block px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.scopePoliciesStatus")}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {ROWS.map(({ policyKey, i18nKey, icon: Icon }) => {
          const implemented = isScopePolicyImplemented(policyKey);
          return (
            <div
              key={policyKey}
              className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-1.5"
            >
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                <Icon className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                {t(`engineering.permissions.scopePolicies${i18nKey}Title`)}
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t(`engineering.permissions.scopePolicies${i18nKey}Body`)}
              </p>
              <p
                className={`text-[9px] font-black uppercase tracking-widest ${
                  implemented
                    ? "text-[var(--brand-orange)]"
                    : "text-amber-400"
                }`}
              >
                {implemented
                  ? t("engineering.permissions.scopePoliciesImplemented")
                  : t("engineering.permissions.scopePoliciesPending")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
