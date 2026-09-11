"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PermissionShell, { useSubTab } from "@/components/permissions/PermissionShell";
import PermissionManager from "@/components/permissions/PermissionCenter";
import CatalogView from "@/components/permissions/CatalogView";

/**
 * PHASE UI-5 — Rules.
 *
 * "Who is allowed to have what — and why can't I grant it?"
 *
 *   ceilings → the feature × identity allowlists the engine enforces (fail
 *              closed: a missing row denies). The vault, not the daily screen.
 *   warnings → the responsibility role allowlists behind the in-app "role
 *              incompatibility" warnings.
 *
 * The capability registry (formerly the Catalog tab) is not a screen of its
 * own: it is reference material, so it opens underneath the ceiling it
 * explains, and only when asked for.
 */
const TAB_BY_SUB = {
  ceilings: "eligibility",
  warnings: "access",
};

export default function PermissionRulesPage() {
  const { t } = useI18n();
  const [sub, setSub] = useSubTab("ceilings");
  const [showCatalog, setShowCatalog] = useState(false);
  const tab = TAB_BY_SUB[sub] || "eligibility";

  return (
    <PermissionShell active="rules" sub={sub} onSubChange={setSub}>
      <p className="mb-4 text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.questionRules")}
      </p>

      <PermissionManager key={sub} initialTab={tab} />

      {sub === "ceilings" && (
        <div className="mt-6 space-y-3">
          <button
            onClick={() => setShowCatalog((open) => !open)}
            aria-expanded={showCatalog}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
          >
            {showCatalog ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            {t("engineering.permissions.seeAllFeatures")}
          </button>
          {showCatalog && <CatalogView />}
        </div>
      )}
    </PermissionShell>
  );
}
