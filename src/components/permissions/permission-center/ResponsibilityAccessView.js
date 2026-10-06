"use client";

/**
 * RESPONSIBILITY ACCESS VIEW — extracted from `PermissionCenter.js`.
 *
 * The WRITE side of responsibilities: pick a person, grant or revoke the
 * responsibility capabilities the engine enforces. Separate from
 * `ResponsibilitiesView` (the read-only report) because the two have opposite
 * risk profiles: this one writes, so its request sequencing goes through
 * `defer` rather than firing straight from an effect.
 *
 * Split out verbatim, behaviour identical.
 */

import { useCallback, useEffect, useState } from "react";
import { defer } from "@/components/permissions/effectUtils";
import { defaultAllowedRoles, eligibleRolesForFeature, normalizeAllowedRoles } from "@/lib/featureAccess";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

export default function ResponsibilityAccessView() {
  const { t } = useI18n();
  const [responsibilities, setResponsibilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  // feature_eligibility rows — the ceiling that bounds which roles each feature
  // may offer (a role the feature is not eligible for is never proposed).
  const [eligibilityRows, setEligibilityRows] = useState([]);

  const fetchAll = useCallback(async (bypassCache = false) => {
    const url = "/api/responsibilities";
    const apply = (data) => {
      if (data.success) setResponsibilities(data.responsibilities || []);
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this tab renders instantly from a
      // fresh snapshot; mutation flows pass bypassCache=true so the list
      // always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (error) {
      console.error("Failed to fetch responsibilities", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    defer(() => fetchAll());
  }, [fetchAll]);

  // Load the eligibility ceiling (cache-first, fail-soft): without it the role
  // toggles fall back to the full canonical list.
  useEffect(() => {
    let alive = true;
    const url = "/api/engineering/permissions/eligibility";
    const cached = cacheGet(url);
    if (cached !== null && cached.success) {
      defer(() => setEligibilityRows(cached.rows || []));
    }
    (async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!alive) return;
        if (data.success) {
          cacheSet(url, data);
          setEligibilityRows(data.rows || []);
        }
      } catch {
        /* fail-soft — the full role list stays available */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const effectiveRoles = (resp) =>
    normalizeAllowedRoles(resp.allowed_roles) ??
    defaultAllowedRoles(resp.key) ??
    [];

  const saveAccess = async (resp, allowedRoles) => {
    setSavingId(resp.id);
    setSaveMsg("");
    setSaveError("");
    // Optimistic update
    setResponsibilities((prev) =>
      prev.map((responsibility) =>
        responsibility.id === resp.id ? { ...responsibility, allowed_roles: [...allowedRoles] } : responsibility,
      ),
    );
    try {
      const res = await fetch("/api/responsibilities/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resp.id, allowed_roles: allowedRoles }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg(t("engineering.permissions.accessSaved"));
        setTimeout(() => setSaveMsg(""), 2500);
      } else {
        setSaveError(t((data.error || t("engineering.permissions.accessSaveFailed")) || "") || (data.error || t("engineering.permissions.accessSaveFailed")));
        fetchAll(true);
      }
    } catch {
      setSaveError(t("engineering.permissions.networkError"));
      fetchAll(true);
    } finally {
      setSavingId(null);
    }
  };

  const toggleRole = (resp, role) => {
    const current = effectiveRoles(resp);
    const next = current.includes(role)
      ? current.filter((existingRole) => existingRole !== role)
      : [...current, role];
    saveAccess(resp, next);
  };

  const resetAccess = async (resp) => {
    setSavingId(resp.id);
    setSaveMsg("");
    setSaveError("");
    try {
      const res = await fetch("/api/responsibilities/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resp.id, allowed_roles: null }),
      });
      const data = await res.json();
      if (data.success) {
        setResponsibilities((prev) =>
          prev.map((responsibility) =>
            responsibility.id === resp.id ? { ...responsibility, allowed_roles: null } : responsibility,
          ),
        );
        setSaveMsg(t("engineering.permissions.accessReset"));
        setTimeout(() => setSaveMsg(""), 2500);
      } else {
        setSaveError(t((data.error || t("engineering.permissions.accessSaveFailed")) || "") || (data.error || t("engineering.permissions.accessSaveFailed")));
      }
    } catch {
      setSaveError(t("engineering.permissions.networkError"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.responsibilityAccessIntro")}
      </p>

      {saveMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-400">{saveMsg}</p>
        </div>
      )}
      {saveError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{saveError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div
            className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {responsibilities.map((resp) => {
            const effective = effectiveRoles(resp);
            const isCustom = resp.allowed_roles !== null;
            return (
              <div
                key={resp.id}
                className="ios-card !p-5 border-[var(--border-primary)]"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        {resp.name}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isCustom
                            ? "bg-brand-orange/10 text-[var(--brand-orange)]"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {isCustom
                          ? t("engineering.permissions.accessCustom")
                          : t("engineering.permissions.accessDefaults")}
                      </span>
                    </div>
                    {resp.description && (
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                        {resp.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => resetAccess(resp)}
                    disabled={savingId === resp.id}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-40"
                  >
                    {t("engineering.permissions.accessReset")}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {eligibleRolesForFeature(eligibilityRows, resp.key).map((role) => {
                    const active = effective.includes(role);
                    const saving = savingId === resp.id;
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(resp, role)}
                        disabled={saving}
                        title={role}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                          active
                            ? "bg-brand-orange/10 border-brand-orange/40 text-[var(--brand-orange)]"
                            : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-70 hover:opacity-100"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
