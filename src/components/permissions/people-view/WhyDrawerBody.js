"use client";

import EffectiveBadge from "../ui/EffectiveBadge";
import { capabilityLabel } from "@/models/authorization/capability-catalog";

/**
 * The body of the Why drawer: WHY a capability resolves the way it does —
 * the effective answer first, in a sentence, then each source layer, then the
 * eligibility gate. The drawer chrome (title, close) stays with the screen;
 * this is only its content.
 *
 * Structured before technical on purpose: an admin reads "This person can edit
 * contacts" before being asked to interpret Profile / Group / Grant /
 * Restriction. Every marker pairs a glyph with a word, so the state never rests
 * on colour alone.
 */
const LAYERS = [
  { key: "profile", stateKey: "profile", heldLabel: "matrixStateInherited" },
  { key: "groups", stateKey: "group", heldLabel: "matrixStateInherited" },
  { key: "grants", stateKey: "grant", heldLabel: "matrixStateDirect" },
  { key: "restrictions", stateKey: "restricted", heldLabel: "matrixStateRestricted" },
];

export default function WhyDrawerBody({ t, why, eligibility, moduleToFeature }) {
  const action = capabilityLabel(why.module, why.cap);
  const feature = moduleToFeature?.[why.module];
  const eligible = feature ? eligibility?.[feature] !== false : true;
  const effective = Boolean(why.state?.effective);

  return (
    <div className="space-y-5">
      {/* The answer, stated plainly. */}
      <section className="space-y-2">
        <h4 className="text-xs font-medium text-[var(--text-secondary)]">
          {t("engineering.permissions.userMatrixEffective")}
        </h4>
        <p className="flex items-start gap-2 text-sm font-medium text-[var(--text-primary)]">
          <span
            className={`mt-0.5 font-black ${effective ? "text-emerald-400" : "text-red-400"}`}
            aria-hidden="true"
          >
            {effective ? "✓" : "✗"}
          </span>
          <span>
            {effective
              ? t("engineering.permissions.whyEffectiveCan", { action })
              : t("engineering.permissions.whyEffectiveCannot", { action })}
          </span>
        </p>
        <EffectiveBadge effective={effective} reason={why.reason} />
        {why.state?.restricted && (
          <p className="text-xs text-red-400">
            {t("engineering.permissions.whyBlockedNote")}
          </p>
        )}
      </section>

      {/* Where it comes from. */}
      <section className="space-y-2 border-t border-divider/60 pt-4">
        <h4 className="text-xs font-medium text-[var(--text-secondary)]">
          {t("engineering.permissions.explanationSources")}
        </h4>
        <dl className="space-y-1.5">
          {LAYERS.map((layer) => {
            const on = Boolean(why.state?.[layer.stateKey]);
            return (
              <div key={layer.key} className="flex items-center justify-between gap-3">
                <dt className="text-sm text-[var(--text-secondary)]">
                  {t(`engineering.permissions.whyLayer_${layer.key}`)}
                </dt>
                <dd
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    on ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] opacity-60"
                  }`}
                >
                  <span className="font-black" aria-hidden="true">
                    {on ? (layer.key === "restrictions" ? "⊘" : "✓") : "—"}
                  </span>
                  {on
                    ? t(`engineering.permissions.${layer.heldLabel}`)
                    : t("engineering.permissions.capOriginNone")}
                </dd>
              </div>
            );
          })}
        </dl>
        {!why.state?.restricted && (
          <p className="text-xs text-[var(--text-secondary)]">
            {t("engineering.permissions.whyNoRestrictions")}
          </p>
        )}
      </section>

      {/* The outer gate. */}
      <section className="space-y-1 border-t border-divider/60 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--text-secondary)]">
            {t("engineering.permissions.whyEligibility")}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {eligible
              ? t("engineering.permissions.whyEligible")
              : t("engineering.permissions.whyNotEligible")}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {t("engineering.permissions.whyScopeNote")}
        </p>
      </section>
    </div>
  );
}
