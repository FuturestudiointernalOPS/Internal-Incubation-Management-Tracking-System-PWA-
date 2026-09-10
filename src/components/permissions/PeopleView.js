"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { Skeleton } from "@/components/ui/Skeleton";
import Badge from "./ui/Badge";
import EffectiveBadge from "./ui/EffectiveBadge";
import WhyDrawer from "./ui/WhyDrawer";
import { collectContextModules, deriveUserCapState, deriveDenialReason } from "./matrixHelpers";
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
 * Editing access stays in the Individual Access screen (unchanged); this
 * screen links to it and never invents a verdict the server did not return.
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

export default function PeopleView({ onManageAccess }) {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [moduleToFeature, setModuleToFeature] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [err, setErr] = useState("");
  const [scope, setScope] = useState([]);
  const [why, setWhy] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const url = "/api/responsibilities/assign";
      const cached = cacheGet(url);
      const d = cached?.success ? cached : await (await fetch(url)).json();
      if (d?.success) {
        cacheSet(url, d);
        setUsers(d.users || d.contacts || d.rows || []);
      }
    } catch {
      /* list optional */
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const url = "/api/engineering/permissions";
      const cached = cacheGet(url);
      const d = cached?.success ? cached : await (await fetch(url)).json();
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
    loadUsers();
    loadCatalog();
  }, [loadUsers, loadCatalog]);

  const pick = useCallback(
    async (u) => {
      setSelected(u);
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

  // Deep link: ?cid= preselects a user once the list is available.
  useEffect(() => {
    if (!users.length) return;
    let cid = "";
    try {
      cid = new URLSearchParams(window.location.search).get("cid") || "";
    } catch {
      cid = "";
    }
    if (!cid) return;
    const hit = users.find((u) => String(u.cid) === String(cid));
    if (hit) pick(hit);
  }, [users, pick]);

  const filtered = users.filter(
    (u) =>
      !query.trim() ||
      (u.name || "").toLowerCase().includes(query.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(query.toLowerCase()) ||
      (u.cid || "").toLowerCase().includes(query.toLowerCase()),
  );

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

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.peopleHint")}
      </p>

      {/* Search + results */}
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("engineering.permissions.searchPlaceholder")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 font-bold text-xs"
            />
          </div>
          {loadingUsers ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">
              {filtered.slice(0, 50).map((u) => (
                <button
                  key={u.cid}
                  onClick={() => pick(u)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    selected?.cid === u.cid
                      ? "bg-[var(--brand-orange)]/10"
                      : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="block text-xs font-bold text-[var(--text-primary)]">
                    {u.name || u.cid}
                  </span>
                  <span className="block text-[10px] text-[var(--text-secondary)]">
                    {u.email || u.cid}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-xs font-bold text-[var(--text-secondary)]">
                  {t("common.noResults")}
                </p>
              )}
            </div>
          )}
        </div>

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
                {onManageAccess && (
                  <button
                    onClick={() => onManageAccess(selected.cid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    {t("engineering.permissions.peopleManageAccess")}
                  </button>
                )}
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

              {/* Sources matrix */}
              <div
                tabIndex={0}
                role="region"
                aria-label={t("engineering.permissions.peopleTableAria")}
                className="overflow-x-auto rounded-xl border border-[var(--border-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
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
                          const s = deriveUserCapState(ctx.sources, m.module, cap);
                          const reason = reasonFor(s);
                          return (
                            <tr
                              key={`${m.module}.${cap}`}
                              onClick={() => setWhy({ module: m.module, cap, state: s, reason })}
                              onKeyDown={(e) => {
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
                              <td className="text-center">
                                <SourceGlyph on={s.grant} kind="grants" />
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
            </>
          )}
        </div>
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
