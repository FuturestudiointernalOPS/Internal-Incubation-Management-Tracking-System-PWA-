"use client";

import EffectiveBadge from "../ui/EffectiveBadge";

/**
 * The body of the Why drawer: WHY a capability resolves the way it does —
 * eligibility, each source layer, then the effective result. The drawer chrome
 * (title, close) stays with the screen; this is only its content.
 */
const LAYERS = ["profile", "groups", "grants", "restrictions"];

export default function WhyDrawerBody({ t, why, eligibility, moduleToFeature }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.whyEligibility")}
        </span>
        <span className="font-bold text-[var(--text-primary)]">
          {eligibility?.[moduleToFeature[why.module]] === false
            ? t("engineering.permissions.whyNotEligible")
            : t("engineering.permissions.whyEligible")}
        </span>
      </div>
      {LAYERS.map((layer) => {
        const on =
          layer === "restrictions"
            ? why.state.restricted
            : Boolean(why.state[layer === "groups" ? "group" : layer === "grants" ? "grant" : "profile"]);
        return (
          <div key={layer} className="flex items-center justify-between gap-3">
            <span className="font-bold text-[var(--text-secondary)]">
              {t(`engineering.permissions.whyLayer_${layer}`)}
            </span>
            <span className={on ? "font-black text-[var(--brand-orange)]" : "text-[var(--text-secondary)] opacity-50"}>
              {on ? "✓" : "—"}
            </span>
          </div>
        );
      })}
      <div className="pt-2 border-t border-[var(--border-primary)] flex items-center justify-between gap-3">
        <span className="font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.userMatrixEffective")}
        </span>
        <EffectiveBadge effective={why.state.effective} reason={why.reason} />
      </div>
      <p className="pt-2 text-[10px] text-[var(--text-secondary)] opacity-70">
        {t("engineering.permissions.whyScopeNote")}
      </p>
    </div>
  );
}
