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

export default function EligibilityNotices({ t, canConfigure }) {
  return (
    <>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/20">
        <Info className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.eligibilityHint")}
        </p>
      </div>

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
