"use client";

import React, { useState } from "react";
import { Search, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import EffectiveBadge from "../ui/EffectiveBadge";
import SourceGlyph from "./SourceGlyph";
import {
  deriveUserCapState,
  deriveDenialReason,
  describeCapOrigins,
} from "../matrixHelpers";
import { capabilityLabel } from "@/models/authorization/capability-catalog";
import { moduleCaps } from "./accessSummary";
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
 * The permission matrix of the People screen: for every capability the person
 * is in scope of, the four layers (Profile | Group | Grant | Restriction) and
 * the effective result, with the reason. The list can be narrowed to a
 * capability, a source or what the person actually holds, so the table answers
 * a question instead of forcing a scroll.
 *
 * Readability rules this file follows (UI-7 / UI-10 ergonomics):
 *   - modules are the unit of reading, and each one states how many of its
 *     rights are held — "3 of 4 allowed" — before any row is read;
 *   - a capability is named in human words ("Edit Contacts"), with its
 *     technical name kept visible but quiet;
 *   - a state is never a bare colour or a single letter: every marker pairs a
 *     glyph with a word, so it survives colour-blindness and greyscale.
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
  eligibleFor,
  busyKey,
  actionErr,
  onGrant,
  onOpenWhy,
}) {
  const [query, setQuery] = useState("");
  const [onlyGranted, setOnlyGranted] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  // Same capability set as the summary band: the catalogue's list, or every
  // capability any source layer holds when the catalogue has none.
  const capsFor = (module) => moduleCaps(module, ctx.sources);

  const reasonFor = (state) => deriveDenialReason(state);

  /** Human module name, from the shared labels, else the raw key prettified. */
  const moduleLabel = (module) => {
    const key = `engineering.permissions.moduleLabels.${module}`;
    const value = t(key);
    return value && value !== key ? value : module.replace(/_/g, " ");
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
                capabilityLabel(module.module, cap).toLowerCase().includes(needle) ||
                (module.feature || "").toLowerCase().includes(needle)
              );
            }),
          };
        })
        .filter((module) => module.caps.length > 0);

  const shownCount = visibleModules.reduce((total, module) => total + module.caps.length, 0);

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

  /** How many of the section's rights the person actually holds. */
  const heldCount = (module) =>
    (module.allCaps || module.caps).filter(
      (cap) =>
        deriveUserCapState(
          ctx.sources,
          module.module,
          cap,
          eligibleFor(module.module),
        ).effective,
    ).length;

  const allExpanded = visibleModules.every((module) => collapsed[module.module] !== true);
  const toggleAll = () => {
    if (allExpanded) {
      const next = {};
      for (const entry of visibleModules) next[entry.module] = true;
      setCollapsed(next);
    } else {
      setCollapsed({});
    }
  };

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
          className="text-xs font-medium text-[var(--text-secondary)]"
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
          const levelLabel = t("engineering.permissions.titleSetTo", {
            level: t(ACCESS_LEVEL_KEYS[lvl]),
          });
          return (
            <button
              key={lvl}
              type="button"
              aria-pressed={held}
              aria-label={levelLabel}
              disabled={held || busy}
              onClick={(event) => {
                event.stopPropagation();
                onGrant("grant", module, capability, lvl);
              }}
              title={levelLabel}
              className={`${LEVEL_CHIP_BASE} !h-7 !w-7 ${
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
            aria-label={t("engineering.permissions.titleRevokeGrant")}
            onClick={(event) => {
              event.stopPropagation();
              onGrant("revoke", module, capability);
            }}
            title={t("engineering.permissions.titleRevokeGrant")}
            className="rounded-md p-1.5 transition-all hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
          </button>
        )}
      </span>
    );
  };

  /** The explicit ✓/— marker plus word for one right of a section header. */
  const rightMarker = (right) => (
    <span
      key={right.cap}
      title={
        right.held
          ? t("engineering.permissions.peopleMatrixRightHeld")
          : right.offered
            ? t("engineering.permissions.peopleMatrixRightNotHeld")
            : t("engineering.permissions.peopleMatrixRightNotOffered")
      }
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${
        right.held
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : right.offered
            ? "border-[var(--border-primary)] text-[var(--text-secondary)]"
            : "border-transparent text-[var(--text-secondary)] opacity-40"
      }`}
    >
      <span aria-hidden="true">{right.held ? "✓" : "—"}</span>
      {t(RIGHT_LABEL_KEYS[right.cap])}
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Filters — one row, labelled, with a live count of what is shown. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t("engineering.permissions.peopleMatrixSearchAria")}
            placeholder={t("engineering.permissions.peopleMatrixFilterPlaceholder")}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-primary py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40 sm:w-72"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">
            {t("engineering.permissions.peopleMatrixFilteredCount", { count: shownCount })}
          </span>
          <button
            type="button"
            aria-pressed={onlyGranted}
            onClick={() => setOnlyGranted((prev) => !prev)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
              onlyGranted
                ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
                : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("engineering.permissions.peopleMatrixOnlyGranted")}
          </button>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            {allExpanded
              ? t("engineering.permissions.peopleMatrixCollapseAll")
              : t("engineering.permissions.peopleMatrixExpandAll")}
          </button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.peopleMatrixReportHint")}
      </p>
      <p className="text-xs text-[var(--text-secondary)]">
        {t("engineering.permissions.peopleMatrixLegend")}
      </p>

      {/* Write feedback — a rejected write must explain itself next to
          the control that caused it, never silently no-op. */}
      {actionErr && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs font-medium text-red-400">{actionErr}</p>
        </div>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label={t("engineering.permissions.peopleTableAria")}
        className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/60"
      >
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-xs font-medium text-[var(--text-secondary)]">
              <th className="p-3">{t("engineering.permissions.userMatrixCapability")}</th>
              <th className="w-24 p-3 text-center">{t("engineering.permissions.userMatrixProfile")}</th>
              <th className="w-24 p-3 text-center">{t("engineering.permissions.userMatrixGroup")}</th>
              <th className="w-28 p-3 text-center">{t("engineering.permissions.userMatrixGrant")}</th>
              <th className="w-24 p-3 text-center">{t("engineering.permissions.userMatrixRestriction")}</th>
              <th className="w-32 p-3 text-center">{t("engineering.permissions.userMatrixEffective")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleModules.map((module) => {
              const isOpen = collapsed[module.module] !== true;
              const total = (module.allCaps || module.caps).length;
              const held = heldCount(module);
              return (
                <React.Fragment key={module.module}>
                  <tr className="border-b border-[var(--border-primary)] bg-secondary/40">
                    <td colSpan={6} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [module.module]: isOpen,
                            }))
                          }
                          aria-label={
                            isOpen
                              ? t("engineering.permissions.peopleMatrixCollapseModule", {
                                  module: moduleLabel(module.module),
                                })
                              : t("engineering.permissions.peopleMatrixExpandModule", {
                                  module: moduleLabel(module.module),
                                })
                          }
                          className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                          )}
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {moduleLabel(module.module)}
                          </span>
                          <span className="text-xs font-normal text-[var(--text-secondary)]">
                            {t("engineering.permissions.peopleMatrixModuleSummary", {
                              held,
                              total,
                            })}
                          </span>
                        </button>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {rightStates(module).map(rightMarker)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isOpen &&
                    module.caps.map((cap) => {
                      const state = deriveUserCapState(
                        ctx.sources,
                        module.module,
                        cap,
                        eligibleFor(module.module),
                      );
                      const reason = reasonFor(state);
                      return (
                        <tr
                          key={`${module.module}.${cap}`}
                          onClick={() =>
                            onOpenWhy({ module: module.module, cap, state, reason })
                          }
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
                          className="cursor-pointer border-b border-divider/40 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/60"
                        >
                          <td className="px-3 py-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {capabilityLabel(module.module, cap)}
                            </span>
                            <span
                              className="ml-2 font-mono text-xs text-[var(--text-secondary)]"
                              title={t("engineering.permissions.peopleMatrixTechnicalName", {
                                name: `${module.module}.${cap}`,
                              })}
                            >
                              {module.module}.{cap}
                            </span>
                            <span className="block text-xs text-[var(--text-secondary)]">
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
                            className="px-2 py-1.5 text-center"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {grantControl(module.module, cap, eligibleFor(module.module))}
                          </td>
                          <td className="text-center">
                            <SourceGlyph on={state.restricted} kind="restrictions" />
                          </td>
                          <td className="p-2 text-center">
                            {state.effective ? (
                              <span
                                className="text-base font-black text-emerald-400"
                                title={t("engineering.permissions.effectiveAllowed")}
                                aria-label={t("engineering.permissions.effectiveAllowed")}
                              >
                                ✓
                              </span>
                            ) : (
                              <EffectiveBadge effective={state.effective} reason={reason} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
            {visibleModules.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-[var(--text-secondary)]">
                  {modules.length === 0
                    ? t("engineering.permissions.peopleMatrixNoPermissions")
                    : t("engineering.permissions.peopleMatrixFiltered")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Small screens: the same rows as cards (no data hidden) */}
      <div className="md:hidden space-y-3">
        {visibleModules.map((module) => {
          const isOpen = collapsed[module.module] !== true;
          const total = (module.allCaps || module.caps).length;
          const held = heldCount(module);
          return (
            <div
              key={module.module}
              className="space-y-2 rounded-xl border border-[var(--border-primary)] p-3"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [module.module]: isOpen }))
                }
                className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              >
                <span className="inline-flex items-center gap-1.5">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                  )}
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {moduleLabel(module.module)}
                  </span>
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {t("engineering.permissions.peopleMatrixModuleSummary", { held, total })}
                </span>
              </button>
              <span className="flex flex-wrap items-center gap-1.5">
                {rightStates(module).map(rightMarker)}
              </span>

              {isOpen &&
                module.caps.map((cap) => {
                  const state = deriveUserCapState(
                    ctx.sources,
                    module.module,
                    cap,
                    eligibleFor(module.module),
                  );
                  const reason = reasonFor(state);
                  return (
                    <div
                      key={`${module.module}.${cap}`}
                      role="button"
                      tabIndex={0}
                      aria-label={t("engineering.permissions.peopleRowAria", {
                        capability: `${module.module}.${cap}`,
                      })}
                      onClick={() =>
                        onOpenWhy({ module: module.module, cap, state, reason })
                      }
                      onKeyDown={(event) => {
                        // Same guard as the table row: the Grant chips inside
                        // keep their own keyboard behaviour.
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenWhy({ module: module.module, cap, state, reason });
                        }
                      }}
                      className="w-full space-y-2 rounded-xl border border-[var(--border-primary)] bg-secondary/20 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {capabilityLabel(module.module, cap)}
                          <span className="ml-1.5 font-mono text-xs text-[var(--text-secondary)]">
                            {module.module}.{cap}
                          </span>
                        </span>
                        <EffectiveBadge effective={state.effective} reason={reason} />
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
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
                      <span className="block text-xs text-[var(--text-secondary)]">
                        {originText(state)}
                      </span>
                      <span
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-divider/60 pt-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {t("engineering.permissions.userMatrixGrant")}
                        </span>
                        {grantControl(module.module, cap, eligibleFor(module.module))}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        })}
        {visibleModules.length === 0 && (
          <p className="rounded-xl border border-[var(--border-primary)] p-6 text-center text-sm text-[var(--text-secondary)]">
            {modules.length === 0
              ? t("engineering.permissions.peopleMatrixNoPermissions")
              : t("engineering.permissions.peopleMatrixFiltered")}
          </p>
        )}
      </div>
    </div>
  );
}
