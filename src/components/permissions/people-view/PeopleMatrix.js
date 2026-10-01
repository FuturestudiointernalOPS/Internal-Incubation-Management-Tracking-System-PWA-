"use client";

import React, { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import EffectiveBadge from "../ui/EffectiveBadge";
import SourceGlyph from "./SourceGlyph";
import { deriveUserCapState, deriveDenialReason, describeCapOrigins } from "../matrixHelpers";
import {
  ACCESS_LEVEL_KEYS,
  ACCESS_SHORT,
  GRANT_LEVELS,
  LEVEL_CHIP_ACTIVE,
  LEVEL_CHIP_BASE,
  LEVEL_CHIP_IDLE,
  personalGrantLevel,
} from "../levelChips";

/**
 * The source matrix card of the People screen: for every capability the person
 * is in scope of, the four layers (Profile | Group | Grant | Restriction) and
 * the effective result, with the reason. The list can be narrowed to a
 * capability or to what the person actually holds, so the table answers a
 * question instead of forcing a scroll (UI-7 ergonomics).
 *
 * Presentation only: it derives states from the context it is handed and asks
 * the screen to perform a write (`onGrant`) or open the WHY drawer
 * (`onOpenWhy`). The reads, the reset on person change and the write path stay
 * in PeopleView.
 */

/** The four rights a section can carry, in the product's own order. */
const CRUD_RIGHTS = ["view", "create", "edit", "delete"];
const RIGHT_LABEL_KEYS = {
  view: "engineering.permissions.accessLevelView",
  create: "engineering.permissions.accessLevelCreate",
  edit: "engineering.permissions.accessLevelEdit",
  delete: "engineering.permissions.accessLevelDelete",
};

export default function PeopleMatrix({
  t,
  ctx,
  modules,
  moduleToFeature,
  busyKey,
  actionErr,
  onGrant,
  onOpenWhy,
}) {
  const [query, setQuery] = useState("");
  const [onlyGranted, setOnlyGranted] = useState(false);

  const capsFor = (module) =>
    module.caps.length
      ? module.caps
      : [
          ...new Set([
            ...Object.keys(ctx.sources.profile?.[module.module] || {}),
            ...Object.keys(ctx.sources.groups?.[module.module] || {}),
            ...Object.keys(ctx.sources.grants?.[module.module] || {}),
          ]),
        ].sort();

  const reasonFor = (state) => deriveDenialReason(state);

  // Eligibility is the OUTER gate, mirroring authorize(): a feature-mapped
  // module is allowed only when its feature is explicitly eligible. Super Admin
  // bypasses eligibility entirely, and infra modules without a feature mapping
  // are not eligibility-bound.
  const eligibleFor = (module) => {
    if (ctx?.isSuperAdmin) return true;
    const feature = moduleToFeature[module];
    if (!feature) return true;
    return ctx?.eligibility?.[feature] === true;
  };

  // The person's panel is a long list on a real account, so let the admin ask a
  // question of it: filter by capability or section, or hide everything the
  // person does not actually hold. Plain derivation (no memo) — the list is
  // small and the helpers depend on the resolved context.
  const needle = query.trim().toLowerCase();
  const visibleModules = !ctx
    ? []
    : modules
        .map((module) => {
          const allCaps = capsFor(module);
          return {
            ...module,
            // The section's own right set, kept whole: the header summary must
            // describe the section, not the current filter.
            allCaps,
            caps: allCaps.filter((cap) => {
              const state = deriveUserCapState(
                ctx.sources,
                module.module,
                cap,
                eligibleFor(module.module),
              );
              if (onlyGranted && !state.effective) return false;
              if (!needle) return true;
              return (
                `${module.module}.${cap}`.toLowerCase().includes(needle) ||
                (module.feature || "").toLowerCase().includes(needle)
              );
            }),
          };
        })
        .filter((module) => module.caps.length > 0);

  /** Origin labels of one capability, as a readable sentence. */
  const originText = (state) =>
    describeCapOrigins(state, {
      profileName: ctx?.profile?.profileName || null,
      groups: ctx?.groups || [],
      superAdmin: Boolean(ctx?.isSuperAdmin),
    })
      .map((origin) => t(origin.key, origin.params))
      .join(" · ");

  /** One section header summary: which of the four rights are held. */
  const rightStates = (module) =>
    CRUD_RIGHTS.map((cap) => {
      const offered = (module.allCaps || module.caps).includes(cap);
      const held =
        offered &&
        deriveUserCapState(
          ctx.sources,
          module.module,
          cap,
          eligibleFor(module.module),
        ).effective;
      return { cap, offered, held };
    });

  // One editable Grant control, shared by the table and the mobile cards so the
  // two layouts cannot drift apart. Nothing is written until a chip is clicked.
  const grantControl = (module, capability, eligible) => {
    const level = personalGrantLevel(ctx?.sources, module, capability);
    const busy = busyKey === `${module}.${capability}`;

    // A feature the person is not eligible for is not grantable — say so here
    // rather than letting the click travel to a server-side 403.
    if (!eligible) {
      return (
        <span
          className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70"
          title={t("engineering.permissions.peopleGrantNotEligible")}
        >
          {t("engineering.permissions.peopleGrantNotEligible")}
        </span>
      );
    }

    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-1">
        {GRANT_LEVELS.map((lvl) => {
          const held = level === lvl;
          return (
            <button
              key={lvl}
              type="button"
              aria-pressed={held}
              disabled={held || busy}
              onClick={(event) => {
                event.stopPropagation();
                onGrant("grant", module, capability, lvl);
              }}
              title={t("engineering.permissions.titleSetTo", {
                level: t(ACCESS_LEVEL_KEYS[lvl]),
              })}
              className={`${LEVEL_CHIP_BASE} !h-6 !w-6 ${
                held ? LEVEL_CHIP_ACTIVE[lvl] : LEVEL_CHIP_IDLE
              }`}
            >
              {ACCESS_SHORT[lvl]}
            </button>
          );
        })}
        {level > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onGrant("revoke", module, capability);
            }}
            title={t("engineering.permissions.titleRevokeGrant")}
            className="p-1 rounded-md hover:bg-red-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/20 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[var(--border-primary)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.peopleMatrixTitle")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("engineering.permissions.peopleMatrixFilterPlaceholder")}
              placeholder={t(
                "engineering.permissions.peopleMatrixFilterPlaceholder",
              )}
              className="w-48 sm:w-64 bg-primary border border-[var(--border-primary)] rounded-lg pl-8 pr-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
            />
          </div>
          <button
            type="button"
            aria-pressed={onlyGranted}
            onClick={() => setOnlyGranted((prev) => !prev)}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
              onlyGranted
                ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
                : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("engineering.permissions.peopleMatrixOnlyGranted")}
          </button>
        </div>
      </div>

      <p className="px-3 pt-2 text-[10px] font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.peopleMatrixReportHint")}
      </p>
      <p className="px-3 pt-1 text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
        {t("engineering.permissions.peopleMatrixLegend")}
      </p>

      {/* Write feedback — a rejected write must explain itself next to
          the control that caused it, never silently no-op. */}
      {actionErr && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{actionErr}</p>
        </div>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label={t("engineering.permissions.peopleTableAria")}
        className="hidden md:block overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/60"
      >
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="p-3">{t("engineering.permissions.userMatrixCapability")}</th>
              <th className="p-3 text-center w-24">{t("engineering.permissions.userMatrixProfile")}</th>
              <th className="p-3 text-center w-24">{t("engineering.permissions.userMatrixGroup")}</th>
              <th className="p-3 text-center w-24">{t("engineering.permissions.userMatrixGrant")}</th>
              <th className="p-3 text-center w-24">{t("engineering.permissions.userMatrixRestriction")}</th>
              <th className="p-3 text-center w-32">{t("engineering.permissions.userMatrixEffective")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleModules.map((module) => (
              <React.Fragment key={module.module}>
                <tr className="bg-secondary/60 border-b border-[var(--border-primary)]">
                  <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    {module.module.replace(/_/g, " ")}
                    <span className="ml-2 text-[9px] font-bold normal-case tracking-normal text-[var(--text-secondary)] opacity-70">
                      {module.feature.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td colSpan={5} className="px-3 py-2">
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                        {t("engineering.permissions.peopleMatrixRightsTitle")}
                      </span>
                      {rightStates(module).map((right) => (
                        <span
                          key={right.cap}
                          title={
                            right.held
                              ? t("engineering.permissions.peopleMatrixRightHeld")
                              : right.offered
                                ? t("engineering.permissions.peopleMatrixRightNotHeld")
                                : t("engineering.permissions.peopleMatrixRightNotOffered")
                          }
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${
                            right.held
                              ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
                              : right.offered
                                ? "border-[var(--border-primary)] text-[var(--text-secondary)] opacity-60"
                                : "border-[var(--border-primary)] text-[var(--text-secondary)] opacity-25"
                          }`}
                        >
                          {t(RIGHT_LABEL_KEYS[right.cap])}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
                {module.caps.map((cap) => {
                  const state = deriveUserCapState(ctx.sources, module.module, cap, eligibleFor(module.module));
                  const reason = reasonFor(state);
                  return (
                    <tr
                      key={`${module.module}.${cap}`}
                      onClick={() => onOpenWhy({ module: module.module, cap, state, reason })}
                      onKeyDown={(event) => {
                        // The row acts as a button itself; a keydown from a
                        // Grant chip must not be hijacked into opening the
                        // drawer (and must not lose its default click).
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenWhy({ module: module.module, cap, state, reason });
                        }
                      }}
                      tabIndex={0}
                      aria-label={t("engineering.permissions.peopleRowAria", {
                        capability: `${module.module}.${cap}`,
                      })}
                      className="border-b border-divider/40 cursor-pointer hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/60"
                    >
                      <td className="px-3 py-1.5 text-xs font-bold text-[var(--text-primary)]">
                        {module.module}.{cap}
                        <span className="block text-[9px] font-bold text-[var(--text-secondary)] opacity-80">
                          {originText(state)}
                        </span>
                      </td>
                      <td className="text-center">
                        <SourceGlyph on={state.profile} kind="profile" />
                      </td>
                      <td className="text-center">
                        <SourceGlyph on={state.group} kind="groups" />
                      </td>
                      <td
                        className="px-2 py-1 text-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {grantControl(module.module, cap, eligibleFor(module.module))}
                      </td>
                      <td className="text-center">
                        <SourceGlyph on={state.restricted} kind="restrictions" />
                      </td>
                      <td className="p-1.5 text-center">
                        <EffectiveBadge effective={state.effective} reason={reason} />
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {visibleModules.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
                  {modules.length === 0
                    ? t("engineering.permissions.userMatrixEmpty")
                    : t("engineering.permissions.peopleMatrixFiltered")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Small screens: the same rows as cards (no data hidden) */}
      <div className="md:hidden space-y-3 p-3">
        {visibleModules.map((module) => (
          <div key={module.module} className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              {module.module.replace(/_/g, " ")}
              <span className="ml-2 font-bold normal-case tracking-normal text-[var(--text-secondary)] opacity-70">
                {module.feature.replace(/_/g, " ")}
              </span>
            </p>
            <span className="flex flex-wrap items-center gap-1.5 pb-1">
              {rightStates(module).map((right) => (
                <span
                  key={right.cap}
                  className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${
                    right.held
                      ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
                      : right.offered
                        ? "border-[var(--border-primary)] text-[var(--text-secondary)] opacity-60"
                        : "border-[var(--border-primary)] text-[var(--text-secondary)] opacity-25"
                  }`}
                >
                  {t(RIGHT_LABEL_KEYS[right.cap])}
                </span>
              ))}
            </span>
            {module.caps.map((cap) => {
              const state = deriveUserCapState(ctx.sources, module.module, cap, eligibleFor(module.module));
              const reason = reasonFor(state);
              return (
                <div
                  key={`${module.module}.${cap}`}
                  role="button"
                  tabIndex={0}
                  aria-label={t("engineering.permissions.peopleRowAria", {
                    capability: `${module.module}.${cap}`,
                  })}
                  onClick={() => onOpenWhy({ module: module.module, cap, state, reason })}
                  onKeyDown={(event) => {
                    // Same guard as the table row: the Grant chips inside
                    // keep their own keyboard behaviour.
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenWhy({ module: module.module, cap, state, reason });
                    }
                  }}
                  className="w-full text-left rounded-xl border border-[var(--border-primary)] bg-secondary/30 p-3 space-y-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {module.module}.{cap}
                    </span>
                    <EffectiveBadge effective={state.effective} reason={reason} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[var(--text-secondary)]">
                    {[
                      { label: t("engineering.permissions.userMatrixProfile"), on: state.profile, kind: "profile" },
                      { label: t("engineering.permissions.userMatrixGroup"), on: state.group, kind: "groups" },
                      { label: t("engineering.permissions.userMatrixRestriction"), on: state.restricted, kind: "restrictions" },
                    ].map((src) => (
                      <span key={src.label} className="inline-flex items-center gap-1">
                        {src.label}
                        <SourceGlyph on={src.on} kind={src.kind} />
                      </span>
                    ))}
                  </span>
                  <span className="block text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
                    {originText(state)}
                  </span>
                  <span
                    className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-divider/50"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.userMatrixGrant")}
                    </span>
                    {grantControl(module.module, cap, eligibleFor(module.module))}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {visibleModules.length === 0 && (
          <p className="rounded-xl border border-[var(--border-primary)] p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
            {modules.length === 0
              ? t("engineering.permissions.userMatrixEmpty")
              : t("engineering.permissions.peopleMatrixFiltered")}
          </p>
        )}
      </div>
    </div>
  );
}
