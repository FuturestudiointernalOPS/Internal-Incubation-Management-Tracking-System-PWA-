"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import CatalogView from "@/components/permissions/CatalogView";
import ScopePoliciesView from "@/components/permissions/ScopePoliciesView";
import LiveCheckPanel from "@/components/permissions/LiveCheckPanel";

/**
 * Rules — every ceiling in one place, plus the checker that explains them.
 *
 *   eligibility      → the feature × identity allowlists the engine enforces
 *                      (fail closed: a missing row denies), and the capability
 *                      registry beneath it, and the access checker
 *   responsibilities → the responsibility role allowlists behind the in-app
 *                      "role incompatibility" warnings
 *   scope            → the scope policy catalogue + the live verification bench
 */
export default function PermissionRulesPage() {
  const { t } = useI18n();
  const [sub, setSub] = useSubTab("eligibility");
  const [showCatalog, setShowCatalog] = useState(false);

  return (
    <PermissionShell active="rules" sub={sub} onSubChange={setSub}>
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionRules")}
      </p>

      {sub === "responsibilities" ? (
        <PermissionManager key="access" initialTab="access" />
      ) : sub === "scope" ? (
        <div className="space-y-4">
          <ScopePoliciesView />
          <LiveCheckPanel />
        </div>
      ) : (
        <>
          <PermissionManager key="ceilings" initialTab="eligibility" />

          <div className="mt-6 space-y-3">
            <button
              onClick={() => setShowCatalog((open) => !open)}
              aria-expanded={showCatalog}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
            >
              {showCatalog ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t("engineering.permissions.seeAllFeatures")}
            </button>
            {showCatalog && <CatalogView />}
          </div>
        </>
      )}
    </PermissionShell>
  );
}
