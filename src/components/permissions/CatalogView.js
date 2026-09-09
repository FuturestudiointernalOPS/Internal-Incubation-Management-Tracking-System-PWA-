"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Lock, Info, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { buildFeatureRows } from "@/components/permissions/matrixHelpers";

/**
 * PHASE 2 — Permission Catalog (read-only registry browser).
 *
 * Feature → Module → Capability, generated from the same registry the
 * enforcement layer reads (CAPABILITY_CATALOG + MODULE_TO_FEATURE served by
 * /api/engineering/permissions). Read-only: the catalog is code/data, not an
 * admin-edited store. `locked` and `retired` states are surfaced so the
 * Permission Center never hides a decision.
 */
export default function CatalogView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    try {
      const urlElig = "/api/engineering/permissions/eligibility";
      const urlCat = "/api/engineering/permissions";
      const cachedE = cacheGet(urlElig);
      const cachedC = cacheGet(urlCat);
      const [eRes, cRes] =
        cachedE?.success && cachedC?.success
          ? [cachedE, cachedC]
          : await Promise.all([fetch(urlElig), fetch(urlCat)]);
      const elig = eRes.success ? eRes : await eRes.json();
      const cat = cRes.success ? cRes : await cRes.json();
      if (elig.success) cacheSet(urlElig, elig);
      if (cat.success) cacheSet(urlCat, cat);
      if (elig.success && cat.success) {
        setData({ features: elig.features, catalog: cat.catalog, moduleToFeature: cat.moduleToFeature });
      }
    } catch { /* load failure leaves empty state */ }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    return buildFeatureRows(data.features, data.moduleToFeature, data.catalog);
  }, [data]);

  if (!data) {
    return <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.catalogHint")}
      </p>

      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40">
        {rows.map((row) => {
          const isOpen = Boolean(expanded[row.feature]);
          return (
            <div key={row.feature} className="border-b border-[var(--border-primary)] last:border-0">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [row.feature]: !p[row.feature] }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/60"
              >
                <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {row.feature.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] font-black text-[var(--text-secondary)]">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-2">
                  {row.modules.length === 0 && (
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">
                      {t("engineering.permissions.catalogNoModules")}
                    </p>
                  )}
                  {row.modules.map((m) => (
                    <div
                      key={m.module}
                      className="rounded-lg border border-[var(--border-primary)] bg-secondary/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-black text-[var(--text-primary)]">
                          {m.module.replace(/_/g, " ")}
                        </span>
                        {m.locked && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-[9px] font-black uppercase tracking-widest text-amber-400">
                            <Lock className="w-2.5 h-2.5" /> {t("engineering.permissions.moduleLocked")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.caps.map((cap) => {
                          const def = data.catalog[m.module]?.capabilities?.[cap] || {};
                          return (
                            <span
                              key={cap}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                def.retired
                                  ? "border-[var(--border-primary)] text-[var(--text-secondary)] opacity-50 line-through"
                                  : "border-[var(--border-primary)] text-[var(--text-primary)]"
                              }`}
                              title={def.description || cap}
                            >
                              {cap}
                              {def.retired && " (retired)"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status of the remaining Permission Center sections */}
      <div className="grid md:grid-cols-3 gap-3 pt-2">
        <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4">
          <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] mb-1">
            <Info className="w-3 h-3 text-[var(--brand-orange)]" />
            {t("engineering.permissions.scopePoliciesTitle")}
          </h4>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.scopePoliciesHint")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4">
          <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] mb-1">
            <Info className="w-3 h-3 text-[var(--brand-orange)]" />
            {t("engineering.permissions.groupsTitle")}
          </h4>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.groupsHint")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4">
          <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] mb-1">
            <ShieldAlert className="w-3 h-3 text-[var(--brand-orange)]" />
            {t("engineering.permissions.enforcementNoteTitle")}
          </h4>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.enforcementNoteHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
