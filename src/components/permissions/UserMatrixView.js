"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled } from "./effectUtils";
import {
  collectContextModules,
  deriveUserCapState,
} from "@/components/permissions/matrixHelpers";

/**
 * PHASE 2 — User Matrix (Permission Center → Users).
 *
 * "What exactly can David do, and WHY?" Columns are the source layers of the
 * existing resolver: Profile | Group | Grant | Restriction | Effective.
 * Mixed states are preserved (Profile ✓ + Restriction ✗ never collapse).
 * Scope is displayed as a separate placeholder column — the scope engine is
 * a later phase; capability names never encode scope.
 */
function SourceCell({ on, tone }) {
  if (!on) return <span className="text-[var(--text-secondary)] opacity-40">—</span>;
  const cls =
    tone === "restrict"
      ? "text-red-400"
      : tone === "eff"
        ? "text-green-400"
        : "text-[var(--brand-orange)]";
  return <span className={`text-sm font-black ${cls}`}>✓</span>;
}

export default function UserMatrixView() {
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

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/responsibilities/assign");
      const d = await res.json();
      if (d.success) {
        const arr = d.users || d.contacts || d.rows || [];
        setUsers(arr);
      }
    } catch { /* list optional */ }
    finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    const url = "/api/engineering/permissions";
    try {
      const cached = cacheGet(url);
      const d = cached && cached.success ? await settled(cached) : await (await fetch(url)).json();
      if (d.success) {
        cacheSet(url, d);
        setCatalog(d.catalog || {});
        setModuleToFeature(d.moduleToFeature || {});
      }
    } catch { /* catalog optional */ }
  }, []);

  useEffect(() => {
    defer(() => {
      loadUsers();
      loadCatalog();
    });
  }, [loadUsers, loadCatalog]);

  const pick = async (u) => {
    setSelected(u);
    setCtx(null);
    setErr("");
    setLoadingCtx(true);
    try {
      const res = await fetch(`/api/engineering/permissions/user-context?cid=${encodeURIComponent(u.cid)}`);
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "load failed");
      setCtx(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingCtx(false);
    }
  };

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

  const capListFor = (m) =>
    m.caps.length
      ? m.caps
      : [
          ...new Set([
            ...Object.keys(ctx.sources.profile?.[m.module] || {}),
            ...Object.keys(ctx.sources.groups?.[m.module] || {}),
            ...Object.keys(ctx.sources.grants?.[m.module] || {}),
          ]),
        ].sort();

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.userMatrixHint")}
      </p>

      {/* User picker */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("engineering.permissions.searchPlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs"
        />
      </div>
      {loadingUsers ? (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.slice(0, 30).map((u) => (
            <button
              key={u.cid}
              onClick={() => pick(u)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                selected?.cid === u.cid
                  ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                  : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {u.name || u.cid}
            </button>
          ))}
        </div>
      )}

      {err && <p className="text-xs font-bold text-red-400">{err}</p>}

      {loadingCtx && <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />}

      {ctx && !loadingCtx && (
        <div className="space-y-4">
          {/* Identity chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              <ShieldCheck className="w-3 h-3 text-[var(--brand-orange)]" /> {ctx.role}
            </span>
            {ctx.isSuperAdmin && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest text-amber-400">
                {t("engineering.permissions.superAdminBypass")}
              </span>
            )}
            {ctx.profile?.profileName && (
              <span className="px-2.5 py-1 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-black text-[var(--text-primary)]">
                {ctx.profile.profileName}{" "}
                <span className="text-[var(--text-secondary)] opacity-70">
                  ({ctx.profile.profileSource})
                </span>
              </span>
            )}
            {(ctx.groups || []).map((g) => (
              <span key={g} className="px-2.5 py-1 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)]">
                {g}
              </span>
            ))}
          </div>

          {/* Eligibility strip */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">
              {t("engineering.permissions.eligibilityStrip")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ctx.eligibility || {}).map(([feature, eligible]) => (
                <span
                  key={feature}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    eligible
                      ? "bg-green-400/10 text-green-400 border border-green-400/20"
                      : "bg-secondary text-[var(--text-secondary)] opacity-60 border border-[var(--border-primary)]"
                  }`}
                >
                  {feature.replace(/_/g, " ")} {eligible ? "✓" : "—"}
                </span>
              ))}
            </div>
          </div>

          {/* Matrix */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-secondary/40">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  <th className="p-3">{t("engineering.permissions.userMatrixCapability")}</th>
                  <th className="p-3 text-center">{t("engineering.permissions.userMatrixProfile")}</th>
                  <th className="p-3 text-center">{t("engineering.permissions.userMatrixGroup")}</th>
                  <th className="p-3 text-center">{t("engineering.permissions.userMatrixGrant")}</th>
                  <th className="p-3 text-center">{t("engineering.permissions.userMatrixRestriction")}</th>
                  <th className="p-3 text-center">{t("engineering.permissions.userMatrixEffective")}</th>
                  <th className="p-3 text-center">{t("engineering.permissions.userMatrixScope")}</th>
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
                      <td colSpan={6} />
                    </tr>
                    {capListFor(m).map((cap) => {
                      const s = deriveUserCapState(ctx.sources, m.module, cap);
                      return (
                        <tr key={`${m.module}.${cap}`} className="border-b border-[var(--border-primary)]/40">
                          <td className="px-3 py-1.5 text-xs font-bold text-[var(--text-primary)]">
                            {m.module}.{cap}
                          </td>
                          <td className="text-center"><SourceCell on={s.profile} /></td>
                          <td className="text-center"><SourceCell on={s.group} /></td>
                          <td className="text-center"><SourceCell on={s.grant} /></td>
                          <td className="text-center">
                            {s.restricted ? (
                              <span className="text-sm font-black text-red-400">✗</span>
                            ) : (
                              <span className="text-[var(--text-secondary)] opacity-40">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            {s.effective ? (
                              <span className="flex items-center justify-center gap-1 text-green-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-widest">✓</span>
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1 text-[var(--text-secondary)] opacity-50">
                                <XCircle className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-widest">✗</span>
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-[var(--text-secondary)] opacity-70 border border-[var(--border-primary)]">
                              All · P4
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
                {modules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.userMatrixEmpty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="flex items-start gap-1.5 text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            {t("engineering.permissions.userMatrixFootnote")}
          </p>
        </div>
      )}
    </div>
  );
}
