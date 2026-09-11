"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  Lock,
  Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled } from "./effectUtils";
import PendingChangesList from "./ui/PendingChangesList";
import {
  buildFeatureRows,
  deriveModuleCaps,
} from "@/components/permissions/matrixHelpers";

/**
 * PHASE 2 — Defaults Matrix (Permission Center).
 *
 * Rows: features → (expand) modules. Columns: the eligibility identities
 * (7, founder included). Cells show what each identity's DEFAULT profile
 * carries. Module access is DERIVED from capabilities — nothing here stores
 * a module grant. Zero-capability modules stay visible ([—]). `locked`
 * modules (duplicates) are visible but not editable.
 *
 * Editing follows: drawer → pending tray → review → save (PUT
 * /api/access-profiles, the existing profile-capabilities endpoint). Impact
 * hint = the roles the profile is default for.
 */

export default function DefaultsMatrixView() {
  const { t } = useI18n();
  const [data, setData] = useState(null); // { features, roles, catalog, moduleToFeature, profiles, roleDefaults }
  const [profileCaps, setProfileCaps] = useState({}); // profileId -> {module:{cap:level}}
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // feature -> bool
  const [drawer, setDrawer] = useState(null); // { identity, module }
  const [draft, setDraft] = useState({}); // module -> {cap: bool}
  const [tray, setTray] = useState([]); // pending { profileId, module, cap, level, label }
  const [impactTotal, setImpactTotal] = useState(null); // Phase 3: users affected by the tray
  const [reason, setReason] = useState(""); // Phase 3d: optional audit reason attached to the apply
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Phase 3 — impact preview: whenever the tray changes, ask the server how
  // many contacts resolve to each affected profile (direct + role default) so
  // the reviewer sees "this change affects N users" before applying.
  useEffect(() => {
    let alive = true;
    defer(() => {
      if (alive) setImpactTotal(null);
    });
    const profileIds = [...new Set(tray.map((i) => String(i.profileId)))];
    if (profileIds.length > 0) {
      Promise.all(
        profileIds.map(async (pid) => {
          try {
            const res = await fetch(`/api/engineering/permissions/impact?profile_id=${encodeURIComponent(pid)}`);
            const d = await res.json();
            return d.success ? Number(d.impact?.total || 0) : 0;
          } catch {
            return 0;
          }
        }),
      ).then((counts) => {
        if (alive) setImpactTotal(counts.reduce((a, b) => a + b, 0));
      });
    }
    return () => {
      alive = false;
    };
  }, [tray]);

  const load = useCallback(async (bypassCache = false) => {
    const urlElig = "/api/engineering/permissions/eligibility";
    const urlCat = "/api/engineering/permissions";
    const urlProf = "/api/access-profiles";
    const apply = (elig, cat, prof) => {
      const roleDefaults = prof.roleDefaults || {};
      const identities = elig.roles || [];
      setData({
        features: elig.features || [],
        roles: identities,
        identityGroups: elig.identityGroups || {},
        catalog: cat.catalog || {},
        moduleToFeature: cat.moduleToFeature || {},
        profiles: prof.profiles || [],
        roleDefaults,
      });
    };
    let painted = false;
    try {
      if (!bypassCache) {
        const cached = [cacheGet(urlElig), cacheGet(urlCat), cacheGet(urlProf)];
        if (cached.every((c) => c && c.success)) {
          await settled(null); // yield before the cached paint
          apply(cached[0], cached[1], cached[2]);
          setLoading(false);
          painted = true;
        }
      }
      const [eRes, cRes, pRes] = await Promise.all([
        fetch(urlElig),
        fetch(urlCat),
        fetch(urlProf),
      ]);
      const [elig, cat, prof] = await Promise.all([
        eRes.json(),
        cRes.json(),
        pRes.json(),
      ]);
      if (elig.success && cat.success && prof.success) {
        cacheSet(urlElig, elig);
        cacheSet(urlCat, cat);
        cacheSet(urlProf, prof);
        apply(elig, cat, prof);
      } else if (!painted) setErr(t("engineering.permissions.matrixLoadFailed"));
    } catch {
      if (!painted) setErr(t("engineering.permissions.matrixLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  // Lazy-load the caps of an identity's default profile when the drawer opens.
  const openDrawer = async (identity, module) => {
    setDrawer({ identity, module });
    setDraft({});
    const profile = defaultProfileFor(identity);
    if (!profile) return;
    let caps = profileCaps[profile.id];
    if (!caps) {
      try {
        const res = await fetch(`/api/access-profiles?id=${profile.id}`);
        const d = await res.json();
        if (d.success) {
          const next = {};
          for (const row of d.capabilities || []) {
            next[row.module] ??= {};
            next[row.module][row.capability] = Number(row.access_level ?? 0);
          }
          caps = next;
          setProfileCaps((prev) => ({ ...prev, [profile.id]: next }));
        }
      } catch {
        /* profile load failed — drawer still opens read-only */
      }
    }
    if (caps) {
      const init = {};
      const moduleDef = findModule(module);
      for (const cap of moduleDef?.caps || []) {
        init[cap] = Number(caps[module]?.[cap] ?? 0) > 0;
      }
      setDraft(init);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    return buildFeatureRows(data.features, data.moduleToFeature, data.catalog);
  }, [data]);

  const findModule = (module) => {
    for (const row of rows) {
      const hit = row.modules.find((m) => m.module === module);
      if (hit) return hit;
    }
    return null;
  };

  const defaultProfileFor = (identity) => {
    if (!data) return null;
    const def = data.roleDefaults[identity];
    if (!def) return null;
    return data.profiles.find((p) => String(p.id) === String(def.profileId ?? def.id)) || null;
  };

  const moduleCapsFor = (identity, module) => {
    const profile = defaultProfileFor(identity);
    if (!profile) return { held: [], heldCount: 0, accessible: false };
    return deriveModuleCaps(profileCaps[profile.id] || {}, module);
  };

  const toggleDraft = (cap) => {
    setDraft((prev) => ({ ...prev, [cap]: !prev[cap] }));
  };

  const queueFromDrawer = () => {
    const { identity, module } = drawer;
    const profile = defaultProfileFor(identity);
    const moduleDef = findModule(module);
    if (!profile || !moduleDef) return;
    const pending = [];
    for (const cap of moduleDef.caps) {
      const wantOn = Boolean(draft[cap]);
      const current = profileCaps[profile.id]?.[module]?.[cap] ?? 0;
      if (wantOn && current <= 0) pending.push({ profileId: profile.id, module, cap, level: 5, label: `${module}.${cap}` });
      if (!wantOn && current > 0) pending.push({ profileId: profile.id, module, cap, level: 0, label: `${module}.${cap}` });
    }
    if (!pending.length) {
      setMsg(t("engineering.permissions.matrixNoPendingChanges"));
      return;
    }
    setTray((prev) => [...prev, ...pending]);
    setMsg(t("engineering.permissions.addedToTray"));
    setDrawer(null);
  };

  const applyTray = async () => {
    if (!tray.length) return;
    setBusy(true);
    setErr("");
    try {
      const byProfile = {};
      for (const item of tray) {
        byProfile[item.profileId] ??= {};
        byProfile[item.profileId][item.module] ??= {};
        byProfile[item.profileId][item.module][item.cap] = item.level;
      }
      for (const [profileId, modules] of Object.entries(byProfile)) {
        const merged = JSON.parse(JSON.stringify(profileCaps[profileId] || {}));
        for (const [module, caps] of Object.entries(modules)) {
          merged[module] ??= {};
          for (const [cap, level] of Object.entries(caps)) merged[module][cap] = level;
        }
        const res = await fetch("/api/access-profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: profileId,
            capabilities: merged,
            reason: reason.trim() || undefined,
          }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.error || "save failed");
        setProfileCaps((prev) => ({ ...prev, [profileId]: merged }));
      }
      setTray([]);
      setReason("");
      setMsg(t("engineering.permissions.permissionsSaved"));
      // Profile writes invalidate authorization contexts server-side; refresh
      // the client projection so menus reflect the change immediately.
      if (typeof window !== "undefined") {
        try {
          await fetch("/api/me/permissions");
        } catch { /* cosmetic refresh — server remains authoritative */ }
      }
    } catch (e) {
      setErr(e.message || t("engineering.permissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const identityCells = data?.roles || [];
  // Baseline identities vs context roles (UI-4c) — labelled, never conflated.
  const contextRoles = new Set(data?.identityGroups?.contextRoles || []);

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.defaultsMatrixHint")}
      </p>
      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
        {t("engineering.permissions.identityGroupsNote")}
      </p>
      {err && <p className="text-xs font-bold text-red-500">{err}</p>}
      {msg && (
        <p className="flex items-center gap-2 text-xs font-bold text-green-500">
          <CheckCircle2 className="w-3.5 h-3.5" /> {msg}
        </p>
      )}

      {/* Matrix */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-secondary/40">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.matrixFeature")}
              </th>
              {identityCells.map((ident) => (
                <th key={ident} className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-center">
                  {ident.replace(/_/g, " ")}
                  {contextRoles.has(ident) && (
                    <span className="block text-[8px] font-black text-teal-400">
                      {t("engineering.permissions.contextRoleTag")}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = Boolean(expanded[row.feature]);
              return (
                <React.Fragment key={row.feature}>
                  <tr
                    className="border-b border-[var(--border-primary)] cursor-pointer hover:bg-secondary/60"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [row.feature]: !prev[row.feature] }))
                    }
                  >
                    <td className="p-3">
                      <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        )}
                        {row.feature.replace(/_/g, " ")}
                      </span>
                    </td>
                    {identityCells.map((ident) => {
                      const total = row.modules.reduce(
                        (acc, m) => acc + moduleCapsFor(ident, m.module).heldCount,
                        0,
                      );
                      return (
                        <td key={ident} className="p-3 text-center">
                          <span className="inline-block px-2 py-1 rounded-md bg-secondary border border-[var(--border-primary)] text-[10px] font-black text-[var(--text-secondary)]">
                            {total > 0 ? `[${total}]` : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {isOpen &&
                    row.modules.map((m) => (
                      <tr key={`${row.feature}-${m.module}`} className="border-b border-[var(--border-primary)]/50">
                        <td className="pl-8 pr-3 py-2">
                          <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                            {m.locked && <Lock className="w-3 h-3 text-amber-400" />}
                            {m.module.replace(/_/g, " ")}
                            {m.locked && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                                {t("engineering.permissions.moduleLocked")}
                              </span>
                            )}
                          </span>
                        </td>
                        {identityCells.map((ident) => {
                          const state = moduleCapsFor(ident, m.module);
                          const profile = defaultProfileFor(ident);
                          return (
                            <td key={ident} className="p-2 text-center">
                              {!profile ? (
                                <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
                                  —
                                </span>
                              ) : (
                                <button
                                  disabled={m.locked}
                                  onClick={() => openDrawer(ident, m.module)}
                                  className={`px-2 py-1 rounded-md text-[10px] font-black border transition-all ${
                                    state.accessible
                                      ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/30 text-[var(--brand-orange)]"
                                      : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
                                  } ${m.locked ? "cursor-not-allowed opacity-60" : "hover:opacity-80"}`}
                                >
                                  {state.accessible
                                    ? `[${state.heldCount}]`
                                    : "[—]"}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Small screens: the same features, the same identity totals, and the
          same drawer — nothing is hidden, the table just reflows into cards. */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => {
          const isOpen = Boolean(expanded[row.feature]);
          return (
            <div
              key={row.feature}
              className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 overflow-hidden"
            >
              <button
                aria-expanded={isOpen}
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [row.feature]: !prev[row.feature] }))
                }
                className="w-full flex items-center gap-2 p-3 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                )}
                <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {row.feature.replace(/_/g, " ")}
                </span>
              </button>
              <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                {identityCells.map((ident) => {
                  const total = row.modules.reduce(
                    (acc, m) => acc + moduleCapsFor(ident, m.module).heldCount,
                    0,
                  );
                  return (
                    <span
                      key={ident}
                      className="px-2 py-0.5 rounded-md bg-secondary border border-[var(--border-primary)] text-[10px] font-black text-[var(--text-secondary)]"
                    >
                      {ident.replace(/_/g, " ")} {total > 0 ? `[${total}]` : "—"}
                    </span>
                  );
                })}
              </div>
              {isOpen &&
                row.modules.map((m) => (
                  <div
                    key={`${row.feature}-${m.module}`}
                    className="border-t border-[var(--border-primary)]/50 px-3 py-3 space-y-2"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                      {m.locked && <Lock className="w-3 h-3 text-amber-400" />}
                      {m.module.replace(/_/g, " ")}
                      {m.locked && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                          {t("engineering.permissions.moduleLocked")}
                        </span>
                      )}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {identityCells.map((ident) => {
                        const state = moduleCapsFor(ident, m.module);
                        const profile = defaultProfileFor(ident);
                        const label = profile
                          ? state.accessible
                            ? `[${state.heldCount}]`
                            : "[—]"
                          : "—";
                        return (
                          <button
                            key={ident}
                            disabled={m.locked || !profile}
                            onClick={() => openDrawer(ident, m.module)}
                            aria-label={ident.replace(/_/g, " ")}
                            className={`px-2 py-1 rounded-md text-[10px] font-black border text-left transition-all ${
                              state.accessible && profile
                                ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/30 text-[var(--brand-orange)]"
                                : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
                            } ${m.locked || !profile ? "cursor-not-allowed opacity-60" : "hover:opacity-80"}`}
                          >
                            <span className="block text-[9px] uppercase tracking-widest opacity-70">
                              {ident.replace(/_/g, " ")}
                            </span>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {/* Pending tray */}
      {tray.length > 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.pendingTray")} ({tray.length})
            </h3>
            <button
              onClick={() => {
                setTray([]);
                setReason("");
              }}
              className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-red-400"
            >
              {t("engineering.permissions.matrixClear")}
            </button>
          </div>
          <PendingChangesList items={tray} />
          {impactTotal !== null && impactTotal > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
              {t("engineering.permissions.impactAffects", { total: impactTotal })}
            </p>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("engineering.permissions.reasonPlaceholder")}
            rows={2}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)] resize-none"
          />
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.reasonLabel")}
          </p>
          <button
            onClick={applyTray}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {busy ? t("engineering.permissions.matrixSaving") : t("engineering.permissions.reviewAndApply")}
          </button>
        </div>
      )}

      {/* Action drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40" onClick={() => setDrawer(null)}>
          <div
            className="w-full max-w-md h-full bg-surface-1 border-l border-[var(--border-primary)] p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                {drawer.module.replace(/_/g, " ")}
              </h3>
              <button onClick={() => setDrawer(null)}>
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] mb-4">
              {drawer.identity.replace(/_/g, " ")} —{" "}
              {defaultProfileFor(drawer.identity)?.name ||
                t("engineering.permissions.matrixNoDefaultProfile")}
            </p>
            {!defaultProfileFor(drawer.identity) ? (
              <p className="text-xs font-bold text-amber-400">
                <Info className="inline w-3.5 h-3.5 mr-1" />
                {t("engineering.permissions.matrixNoDefaultProfileHint")}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {(findModule(drawer.module)?.caps || []).map((cap) => (
                    <label
                      key={cap}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-primary)] bg-secondary/40 px-3 py-2.5 cursor-pointer"
                    >
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {drawer.module}.{cap}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(draft[cap])}
                        onChange={() => toggleDraft(cap)}
                        className="accent-[var(--brand-orange)]"
                      />
                    </label>
                  ))}
                </div>
                <button
                  onClick={queueFromDrawer}
                  className="mt-4 w-full px-4 py-2.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest"
                >
                  {t("engineering.permissions.addToPendingTray")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
