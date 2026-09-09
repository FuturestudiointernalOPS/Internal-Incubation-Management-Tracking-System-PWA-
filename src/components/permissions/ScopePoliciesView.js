"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * PHASE 3 — Scope Policies (Permission Center) — READ-ONLY PLACEHOLDER.
 *
 * Record-level scope policies are enforced at the data layer by the Scope
 * Engine (roadmap Phase 5). Until then this registry is the governance
 * surface: it names the policy types the engine must honour, so future scope
 * work has an agreed vocabulary. Nothing here authorizes anything.
 */
const POLICIES = [
  {
    key: "rowVenture",
    icon: ShieldCheck,
  },
  {
    key: "rowProgram",
    icon: ShieldCheck,
  },
  {
    key: "rowLearning",
    icon: ShieldCheck,
  },
  {
    key: "rowTeam",
    icon: ShieldCheck,
  },
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
        {POLICIES.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-1.5"
          >
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              <Icon className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              {t(`engineering.permissions.scopePolicies${key}Title`)}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t(`engineering.permissions.scopePolicies${key}Body`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
