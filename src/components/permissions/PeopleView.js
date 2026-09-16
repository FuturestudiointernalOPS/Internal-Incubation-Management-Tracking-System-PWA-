"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled } from "./effectUtils";
import { Skeleton } from "@/components/ui/Skeleton";
import Badge from "./ui/Badge";
import EffectiveBadge from "./ui/EffectiveBadge";
import WhyDrawer from "./ui/WhyDrawer";
import { collectContextModules, deriveUserCapState, deriveDenialReason } from "./matrixHelpers";
import {
  ACCESS_LEVEL_KEYS,
  ACCESS_SHORT,
  GRANT_LEVELS,
  LEVEL_CHIP_ACTIVE,
  LEVEL_CHIP_BASE,
  LEVEL_CHIP_IDLE,
  personalGrantLevel,
} from "./levelChips";
import { SCOPE_POLICIES, SCOPE_POLICY_KEYS } from "@/lib/authorization/scope-catalog";

/**
 * PHASE UI-2b — People (access matrix).
 *
 * Answers "what can this person do, and WHY" for every capability the person
 * is actually in scope of: Profile | Group | Grant | Restriction | Effective
 * (+ reason). Mixed states are preserved. The scope panel shows what the
 * Scope Engine currently RESOLVES for the person (read-only verification —
 * nothing is enforced from here).
 *
 * Editing access happens IN PLACE: the Grant column is the person's own
 * capability rows (`user_capabilities`) and is editable with the same level
 * chips as the Individual Access panel. Read-only rows open the "why" drawer.
 */

const LAYERS = ["profile", "groups", "grants", "restrictions"];

function SourceGlyph({ on, kind }) {
  if (!on) {
    return <span className="text-[var(--text-secondary)] opacity-40">—</span>;
  }
  if (kind === "restrictions") {
    return <span className="text-sm font-black text-red-400">✗</span>;
  }
  return <span className="text-sm font-black text-[var(--brand-orange)]">✓</span>;
}

export default function PeopleView({ person = null, onAccessChanged = null }) {
  const { t } = useI18n();
  // The screen above owns the selection (PersonPicker); this panel follows it.
  const selected = person;
  const [ctx, setCtx] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [moduleToFeature, setModuleToFeature] = useState({});
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [err, setErr] = useState("");
  const [scope, setScope] = useState([]);
  const [why, setWhy] = useState(null);
  // In-place granting. `busyKey` is scoped to one capability row so a second
  // click elsewhere is still possible; the write itself is server-authoritative.
  const [busyKey, setBusyKey] = useState(null);
  const [actionErr, setActionErr] = useState("");

  const loadCatalog = useCallback(async () => {
    try {
      const url = "/api/engineering/permissions";
      const cached = cacheGet(url);
      const d = cached?.success ? await settled(cached) : await (await fetch(url)).json();
      if (d?.success) {
        cacheSet(url, d);
        setCatalog(d.catalog || {});
        setModuleToFeature(d.moduleToFeature || {});
      }
    } catch {
      /* catalog optional */
    }
  }, []);

  useEffect(() => {
    defer(() => loadCatalog());
  }, [loadCatalog]);

  const pick = useCallback(
    async (u) => {
      setCtx(null);
      setScope([]);
      setErr("");
      setLoadingCtx(true);
      try {
        const res = await fetch(
          `/api/engineering/permissions/user-context?cid=${encodeURIComponent(u.cid)}`,
        );
        const d = await res.json();
        if (!d.success) throw new Error(d.error || "load failed");
        setCtx(d);

        // Scope panel — read-only: what each implemented policy resolves for
        // this person right now (no record id ⇒ nothing is decided).
        const implemented = SCOPE_POLICY_KEYS.filter(
          (k) => SCOPE_POLICIES[k]?.implemented,
        );
        const settled = await Promise.all(
          implemented.map(async (policy) => {
            try {
              const r = await fetch(
                `/api/engineering/permissions/scope-check?policy=${policy}&cid=${encodeURIComponent(u.cid)}`,
              );
              const sd = await r.json();
              return sd.success
                ? { policy, count: sd.resolved_count ?? 0 }
                : { policy, count: null };
            } catch {
              return { policy, count: null };
            }
          }),
        );
        setScope(settled);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoadingCtx(false);
      }
    },
    [],
  );

  /**
   * Re-read ONLY the resolved context after a write. Deliberately not `pick()`:
   * that resets `ctx` to null and refetches scope, which would flash the whole
   * matrix empty on every chip click.
   */
  const refreshCtx = useCallback(async (cid) => {
    const res = await fetch(
      `/api/engineering/permissions/user-context?cid=${encodeURIComponent(cid)}`,
    );
    const d = await res.json();
    if (d?.success) setCtx(d);
  }, []);

  /**
   * Grant / revoke a PERSONAL capability for the selected person.
   * The server is the boundary: it rejects a grant to an ineligible target
   * (403) and applies the merge semantics — so the surface stays unchanged on
   * failure and the reason is shown next to the control that caused it.
   */
  const writeAccess = useCallback(
    async (action, module, capability, accessLevel) => {
      if (!selected?.cid) return;
      setBusyKey(`${module}.${capability}`);
      setActionErr("");
      try {
        const res = await fetch("/api/engineering/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            user_cid: selected.cid,
            module,
            capability,
            access_level: accessLevel,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d?.success === false) {
          throw new Error(d?.error || t("engineering.permissions.saveFailed"));
        }
        await refreshCtx(selected.cid);
        // The "Change access" panel below holds its own copy of the same data;
        // tell the screen so it remounts with this write included rather than
        // showing a stale matrix next to a fresh one.
        if (onAccessChanged) onAccessChanged();
      } catch (e) {
        setActionErr(e.message || t("engineering.permissions.saveFailed"));
      } finally {
        setBusyKey(null);
      }
    },
    [selected, refreshCtx, onAccessChanged, t],
  );

  // Follow the selection made above (including the first paint, when a ?cid=
  // deep link resolves inside the picker). Keyed on the cid: the picker may
  // hand over a slim { cid } first and the full record a moment later.
  const lastPickedCid = useRef(null);
  useEffect(() => {
    if (!person) return;
    if (lastPickedCid.current === person.cid) return;
    lastPickedCid.current = person.cid;
    defer(() => pick(person));
  }, [person, pick]);

  const modules = useMemo(() => {
    if (!ctx) return [];
    return collectContextModules(ctx.sources).map((module) => ({
      module,
      feature: moduleToFeature[module] || "—",
      locked: Boolean(catalog?.[module]?.locked),
      caps: Object.keys(catalog?.[module]?.capabilities || {}).sort(),
    }));
  }, [ctx, catalog, moduleToFeature]);

  const capsFor = (m) =>
    m.caps.length
      ? m.caps
      : [
          ...new Set([
            ...Object.keys(ctx.sources.profile?.[m.module] || {}),
            ...Object.keys(ctx.sources.groups?.[m.module] || {}),
            ...Object.keys(ctx.sources.grants?.[m.module] || {}),
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
              onClick={(e) => {
                e.stopPropagation();
                writeAccess("grant", module, capability, lvl);
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
            onClick={(e) => {
              e.stopPropagation();
              writeAccess("revoke", module, capability);
            }}
            title={t("engineering.permissions.titleRevokeGrant")}
            className="p-1 rounded-md hover:bg-red-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Selected person */}
      <div className="space-y-3">
          {!selected && (
            <p className="text-xs font-bold text-[var(--text-secondary)]">
              {t("engineering.permissions.peopleSelectPrompt")}
            </p>
          )}
          {err && <p className="text-xs font-bold text-red-500">{err}</p>}
          {loadingCtx && (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-40" />
            </div>
          )}
          {selected && !loadingCtx && ctx && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-[var(--text-primary)]">
                  {selected.name || selected.cid}
                </span>
                <Badge variant="neutral">
                  <ShieldCheck className="w-3 h-3" /> {ctx.role}
                </Badge>
                {ctx.isSuperAdmin && (
                  <Badge variant="pending">
                    {t("engineering.permissions.superAdminBypass")}
                  </Badge>
                )}
                {ctx.profile?.profileName && (
                  <Badge variant="neutral">
                    {ctx.profile.profileName} ({ctx.profile.profileSource})
                  </Badge>
                )}
                {(ctx.groups || []).map((g) => (
                  <Badge key={g} variant="neutral">
                    {g}
                  </Badge>
                ))}
              </div>

              {/* Contextual relationships (UI-4c) — additive, per context, and
                  read from the same assignment data the scope predicates use.
                  This is why a participant is a participant: the identity above
                  stays Member. */}
              <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.peopleContextsTitle")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(ctx.contexts || []).map((c) => (
                    <span
                      key={`${c.type}:${c.id}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)]"
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t(`engineering.permissions.contextKind_${c.type}`)}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {c.label}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                        {String(c.role).replace(/_/g, " ")}
                      </span>
                      <span className="text-[9px] font-mono text-[var(--text-secondary)] opacity-70">
                        {c.scopePolicy}
                      </span>
                      {!c.scopeImplemented && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                          {t("engineering.permissions.contextPending")}
                        </span>
                      )}
                    </span>
                  ))}
                  {(ctx.contexts || []).length === 0 && (
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.peopleContextsNone")}
                    </span>
                  )}
                </div>
                {(ctx.contextsUnavailable || []).length > 0 && (
                  <p className="text-[10px] font-bold text-amber-400">
                    {t("engineering.permissions.peopleContextsPartial", {
                      kinds: (ctx.contextsUnavailable || []).join(", "),
                    })}
                  </p>
                )}
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
                  {t("engineering.permissions.peopleContextsNote")}
                </p>
              </div>

              {/* Scope panel — what the engine resolves today (read-only) */}
              <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.peopleScopeTitle")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {scope.map((s) => (
                    <span
                      key={s.policy}
                      className="px-2 py-0.5 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-mono text-[var(--text-secondary)]"
                    >
                      {s.policy} · {s.count === null ? "—" : s.count}
                    </span>
                  ))}
                  {scope.length === 0 && (
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.peopleScopeEmpty")}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
                  {t("engineering.permissions.peopleScopeNote")}
                </p>
              </div>

              {/* Write feedback — a rejected write must explain itself next to
                  the control that caused it, never silently no-op. */}
              {actionErr && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[10px] font-bold text-red-400">{actionErr}</p>
                </div>
              )}

              {/* Sources matrix */}
              <div
                tabIndex={0}
                role="region"
                aria-label={t("engineering.permissions.peopleTableAria")}
                className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
              >
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      <th className="p-3">{t("engineering.permissions.userMatrixCapability")}</th>
                      <th className="p-3 text-center">{t("engineering.permissions.userMatrixProfile")}</th>
                      <th className="p-3 text-center">{t("engineering.permissions.userMatrixGroup")}</th>
                      <th className="p-3 text-center">{t("engineering.permissions.userMatrixGrant")}</th>
                      <th className="p-3 text-center">{t("engineering.permissions.userMatrixRestriction")}</th>
                      <th className="p-3 text-center">{t("engineering.permissions.userMatrixEffective")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m) => (
                      <React.Fragment key={m.module}>
                        <tr className="bg-secondary/60 border-b border-[var(--border-primary)]">
                          <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                            {m.module.replace(/_/g, " ")}
                            <span className="ml-2 text-[9px] font-bold normal-case tracking-normal text-[var(--text-secondary)] opacity-70">
                              {m.feature.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td colSpan={5} />
                        </tr>
                        {capsFor(m).map((cap) => {
                          const s = deriveUserCapState(ctx.sources, m.module, cap, eligibleFor(m.module));
                          const reason = reasonFor(s);
                          return (
                            <tr
                              key={`${m.module}.${cap}`}
                              onClick={() => setWhy({ module: m.module, cap, state: s, reason })}
                              onKeyDown={(e) => {
                                // The row acts as a button itself; a keydown from
                                // a Grant chip must not be hijacked into opening
                                // the drawer (and must not lose its default click).
                                if (e.target !== e.currentTarget) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setWhy({ module: m.module, cap, state: s, reason });
                                }
                              }}
                              tabIndex={0}
                              aria-label={t("engineering.permissions.peopleRowAria", {
                                capability: `${m.module}.${cap}`,
                              })}
                              className="border-b border-[var(--border-primary)]/40 cursor-pointer hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-orange)]/60"
                            >
                              <td className="px-3 py-1.5 text-xs font-bold text-[var(--text-primary)]">
                                {m.module}.{cap}
                              </td>
                              <td className="text-center">
                                <SourceGlyph on={s.profile} kind="profile" />
                              </td>
                              <td className="text-center">
                                <SourceGlyph on={s.group} kind="groups" />
                              </td>
                              <td
                                className="px-2 py-1 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {grantControl(m.module, cap, eligibleFor(m.module))}
                              </td>
                              <td className="text-center">
                                <SourceGlyph on={s.restricted} kind="restrictions" />
                              </td>
                              <td className="p-1.5 text-center">
                                <EffectiveBadge effective={s.effective} reason={reason} />
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    {modules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
                          {t("engineering.permissions.userMatrixEmpty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Small screens: the same rows as cards (no data hidden) */}
              <div className="md:hidden space-y-3">
                {modules.map((m) => (
                  <div key={m.module} className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      {m.module.replace(/_/g, " ")}
                      <span className="ml-2 font-bold normal-case tracking-normal text-[var(--text-secondary)] opacity-70">
                        {m.feature.replace(/_/g, " ")}
                      </span>
                    </p>
                    {capsFor(m).map((cap) => {
                      const s = deriveUserCapState(ctx.sources, m.module, cap, eligibleFor(m.module));
                      const reason = reasonFor(s);
                      return (
                        // A div, not a button: this card now contains real
                        // buttons (the Grant chips), and nested buttons are
                        // invalid HTML. Same a11y contract as the table row.
                        <div
                          key={`${m.module}.${cap}`}
                          role="button"
                          tabIndex={0}
                          aria-label={t("engineering.permissions.peopleRowAria", {
                            capability: `${m.module}.${cap}`,
                          })}
                          onClick={() => setWhy({ module: m.module, cap, state: s, reason })}
                          onKeyDown={(e) => {
                            // Same guard as the table row: the Grant chips inside
                            // keep their own keyboard behaviour.
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setWhy({ module: m.module, cap, state: s, reason });
                            }
                          }}
                          className="w-full text-left rounded-xl border border-[var(--border-primary)] bg-secondary/30 p-3 space-y-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {m.module}.{cap}
                            </span>
                            <EffectiveBadge effective={s.effective} reason={reason} />
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[var(--text-secondary)]">
                            {[
                              { label: t("engineering.permissions.userMatrixProfile"), on: s.profile, kind: "profile" },
                              { label: t("engineering.permissions.userMatrixGroup"), on: s.group, kind: "groups" },
                              { label: t("engineering.permissions.userMatrixRestriction"), on: s.restricted, kind: "restrictions" },
                            ].map((src) => (
                              <span key={src.label} className="inline-flex items-center gap-1">
                                {src.label}
                                <SourceGlyph on={src.on} kind={src.kind} />
                              </span>
                            ))}
                          </span>
                          <span
                            className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-primary)]/50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                              {t("engineering.permissions.userMatrixGrant")}
                            </span>
                            {grantControl(m.module, cap, eligibleFor(m.module))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {modules.length === 0 && (
                  <p className="rounded-xl border border-[var(--border-primary)] p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.userMatrixEmpty")}
                  </p>
                )}
              </div>
            </>
          )}
      </div>

      {/* Why drawer */}
      {why && (
        <WhyDrawer
          title={`${why.module}.${why.cap}`}
          onClose={() => setWhy(null)}
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[var(--text-secondary)]">
                {t("engineering.permissions.whyEligibility")}
              </span>
              <span className="font-bold text-[var(--text-primary)]">
                {ctx?.eligibility?.[moduleToFeature[why.module]] === false
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
        </WhyDrawer>
      )}
    </div>
  );
}
