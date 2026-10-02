"use client";

/**
 * ELIGIBILITY VIEW — extracted from `PermissionCenter.js`.
 *
 * The access review matrix: one row per feature per role, each cell a tri-state
 * verdict (allowed / restricted / blocked) with the reason behind it. Two
 * identity vocabularies meet here and the distinction is load-bearing — the
 * matrix rows are built from `matrixRoles`, which EXCLUDES context roles,
 * because a context role is not a person and cannot hold a verdict. Context
 * roles stay selectable in the identity editor instead, where they carry the
 * `contextRoleTag` badge. Collapsing the two would let the matrix render rows
 * that can never be assigned, or hide roles an admin still needs to grant.
 *
 * Split out verbatim, behaviour identical.
 */

import { useCallback, useEffect, useState } from "react";
import { defer } from "@/components/permissions/effectUtils";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { Info, Loader2, Shield } from "lucide-react";

// The rows below are persisted in `feature_eligibility`, and the SAME resolver
// enforces every API route that guards an eligibility write. Read authority is
// `permissions.view_matrix`; write authority is `permissions.configure_eligibility`
// — a dedicated authority on purpose, deliberately separate from
// `assign_capabilities`, so that configuring the matrix can never be laundered
// through the permission a person already holds.

export default function EligibilityView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [identityType, setIdentityType] = useState("role");
  const [identityValue, setIdentityValue] = useState("");
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("identity"); // identity | matrix
  // C2 — impacted templates reported by a 409 before a downgrade is applied.
  const [pendingImpacts, setPendingImpacts] = useState(null);

  const load = useCallback(async (bypassCache = false) => {
    const url = "/api/engineering/permissions/eligibility";
    const apply = (data) => {
      if (!data.success) return;
      setData(data);
      setErr("");
    };
    let painted = false;
    setLoading(true);
    try {
      // Cache-first paint: returning to this tab renders instantly from a
      // fresh snapshot; the network refresh below converges.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      } else if (!painted) {
        setErr(t(data.error || "errors.somethingWrong"));
      }
    } catch {
      if (!painted) setErr(t("engineering.permissions.networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  // Rebuild the draft whenever the identity changes.
  useEffect(() => {
    defer(() => {
      if (!data) return;
      const rows = (data.rows || []).filter(
        (row) =>
          row.identity_type === identityType &&
          row.identity_value === identityValue,
      );
      const next = {};
      for (const row of rows) next[row.feature_key] = Number(row.eligible);
      setDraft(next);
      setMsg("");
      setErr("");
    });
  }, [identityType, identityValue, data]);

  // Roles the database actually carries that the curated identity list omits
  // (mentor, teacher, program_manager…). They are enforceable
  // ceilings, so they must be selectable here — this is the front-end remedy
  // for a refused template save.
  const extraRoles = data?.extraRoles || [];

  const identities =
    identityType === "role"
      ? [...new Set([...(data?.roles || []), ...extraRoles])]
      : data?.groups || [];
  const canConfigure = !!data?.canConfigure;
  const selected = identityValue || null;

  const currentRows = {};
  if (data && selected) {
    for (const row of data.rows || []) {
      if (
        row.identity_type === identityType &&
        row.identity_value === selected
      ) {
        currentRows[row.feature_key] = Number(row.eligible);
      }
    }
  }

  const hasChanges = (data?.features || []).some((featureKey) => {
    const cur = currentRows[featureKey] ?? null;
    const next = draft[featureKey] ?? null;
    return cur !== next;
  });

  const setFeature = (featureKey, value) => {
    setDraft((prev) => ({ ...prev, [featureKey]: value }));
  };

  const save = async (confirmed = false) => {
    if (!selected || !hasChanges) return;
    setSaving(true);
    setErr("");
    const changes = [];
    for (const featureKey of data.features || []) {
      const cur = currentRows[featureKey] ?? null;
      const next = draft[featureKey] ?? null;
      if (cur !== next) {
        changes.push({
          feature_key: featureKey,
          identity_type: identityType,
          identity_value: selected,
          eligible: next,
        });
      }
    }
    try {
      const res = await fetch("/api/engineering/permissions/eligibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, confirm: confirmed }),
      });
      const data = await res.json();
      if (data.success) {
        setData((prev) => ({ ...prev, rows: data.rows }));
        setPendingImpacts(null);
        setMsg(t("engineering.permissions.eligibilitySaved"));
        setTimeout(() => setMsg(""), 2500);
      } else if (res.status === 409 && data.requiresConfirmation) {
        // C2 — the downgrade would strand capabilities that role-default
        // templates still grant. Nothing was persisted: show the impact and let
        // the admin confirm explicitly.
        setPendingImpacts(data.impacts || []);
      } else if (res.status === 403) {
        setErr(t("engineering.permissions.eligibilityNoPermission"));
      } else {
        setErr(t(data.error || "engineering.permissions.eligibilitySaveFailed"));
      }
    } catch {
      setErr(t("engineering.permissions.networkError"));
    } finally {
      setSaving(false);
    }
  };

  const stateBtn = (featureKey, value, labelKey, activeCls) => {
    const active = draft[featureKey] === value;
    return (
      <button
        onClick={() => setFeature(featureKey, value)}
        disabled={!canConfigure}
        title={t(labelKey)}
        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${active ? activeCls : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] opacity-60 hover:opacity-100"}`}
      >
        {t(labelKey)}
      </button>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
      </div>
    );
  }

  // Eligibility manages BASELINE identities. Context roles (participant,
  // facilitator, investor, founder) are ceilings too, but they are held per
  // relationship, so they are NOT rows of the matrix — they stay selectable in
  // the identity editor, where they are tagged as context roles.
  const contextRoles = new Set(data?.identityGroups?.contextRoles || []);
  // Baseline identities first, then the roles this database carries that the
  // curated list omits. Both are rows of the matrix: an enforced ceiling must
  // never be invisible to the administrator who has to configure it.
  const matrixRoles = [
    ...(data?.roles || []).filter((role) => !contextRoles.has(role)),
    ...(data?.extraRoles || []).filter((role) => !contextRoles.has(role)),
  ];
  const isDatabaseRole = (role) => (data?.extraRoles || []).includes(role);

  // One lookup for both presentations (table on md+, cards below) so the two
  // can never disagree about what a cell shows.
  const stateFor = (role, feature) => {
    const row = (data?.rows || []).find(
      (row) =>
        row.identity_type === "role" &&
        row.identity_value === role &&
        row.feature_key === feature,
    );
    const value = row ? Number(row.eligible) : null;
    return {
      value,
      label: value === 1 ? "E" : value === 0 ? "D" : "—",
      title: `${role} → ${feature}: ${
        value === 1
          ? t("engineering.permissions.eligibilityEligible")
          : value === 0
            ? t("engineering.permissions.eligibilityNotEligible")
            : t("engineering.permissions.eligibilityUnset")
      }`,
      className:
        value === 1
          ? "bg-emerald-500/15 text-emerald-400"
          : value === 0
            ? "bg-red-500/15 text-red-400"
            : "bg-primary text-[var(--text-secondary)] opacity-50",
    };
  };

  return (
    <div className="space-y-4">
      {/* View toggle: identity editor vs roles × features matrix */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
        <button
          onClick={() => setViewMode("identity")}
          className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "identity" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
        >
          {t("engineering.permissions.eligibilityIdentityView")}
        </button>
        <button
          onClick={() => setViewMode("matrix")}
          className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "matrix" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
        >
          {t("engineering.permissions.eligibilityMatrixView")}
        </button>
      </div>

      {/* Matrix view: roles × features — click a cell to edit that identity */}
      {viewMode === "matrix" && data && (
        <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
          <div className="p-3 bg-secondary border-b border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
              {t("engineering.permissions.eligibilityMatrixTitle")}
            </p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
              {t("engineering.permissions.eligibilityMatrixHint")}
            </p>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] sticky left-0 bg-secondary">
                    {t("engineering.permissions.eligibilityIdentity")}
                  </th>
                  {(data.features || []).map((featureKey) => (
                    <th
                      key={featureKey}
                      className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap"
                    >
                      {featureKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRoles.map((role) => (
                  <tr
                    key={role}
                    className="border-b border-[var(--border-primary)] last:border-0"
                  >
                    <td className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] sticky left-0 bg-secondary">
                      {role}
                      {isDatabaseRole(role) && (
                        <span className="ml-1 text-[8px] font-black uppercase tracking-widest text-teal-400">
                          {t("engineering.permissions.databaseRoleTag")}
                        </span>
                      )}
                    </td>
                    {(data.features || []).map((featureKey) => {
                      const state = stateFor(role, featureKey);
                      return (
                        <td key={featureKey} className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => {
                              setIdentityType("role");
                              setIdentityValue(role);
                              setViewMode("identity");
                            }}
                            title={state.title}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${state.className}`}
                          >
                            {state.label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Small screens: one card per identity, one chip per feature — the
              same tap opens the same identity editor. */}
          <div className="md:hidden divide-y divide-divider/50">
            {matrixRoles.map((role) => (
              <div key={role} className="p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {role}
                  {isDatabaseRole(role) && (
                    <span className="ml-1 text-[8px] font-black uppercase tracking-widest text-teal-400">
                      {t("engineering.permissions.databaseRoleTag")}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(data.features || []).map((featureKey) => {
                    const state = stateFor(role, featureKey);
                    return (
                      <button
                        key={featureKey}
                        onClick={() => {
                          setIdentityType("role");
                          setIdentityValue(role);
                          setViewMode("identity");
                        }}
                        title={state.title}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-transparent text-left ${state.className}`}
                      >
                        <span className="block text-[9px] tracking-widest opacity-70">
                          {featureKey}
                        </span>
                        <span>{state.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/20">
        <Info className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.eligibilityHint")}
        </p>
      </div>

      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
        {t("engineering.permissions.identityGroupsNote")}
      </p>

      {!canConfigure && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-[10px] font-bold text-amber-400">
            {t("engineering.permissions.eligibilityReadOnly")}
          </p>
        </div>
      )}

      {/* Identity selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
            {t("engineering.permissions.eligibilityIdentityType")}
          </p>
          <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
            {["role", "group"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setIdentityType(type);
                  setIdentityValue("");
                }}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${identityType === type ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                {type === "role"
                  ? t("engineering.permissions.eligibilityRole")
                  : t("engineering.permissions.eligibilityGroup")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
            {t("engineering.permissions.eligibilityIdentity")}
          </p>
          <select
            value={identityValue}
            onChange={(event) => setIdentityValue(event.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">
              {t("engineering.permissions.eligibilitySelectIdentity")}
            </option>
            {identities.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected ? (
        <>
          <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
            <div className="p-3 bg-secondary border-b border-[var(--border-primary)] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                {identityType === "role"
                  ? t("engineering.permissions.eligibilityRole")
                  : t("engineering.permissions.eligibilityGroup")}
                : {selected}
                {identityType === "role" && contextRoles.has(selected) && (
                  <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-teal-400">
                    {t("engineering.permissions.contextRoleTag")}
                  </span>
                )}
                {identityType === "role" && isDatabaseRole(selected) && (
                  <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-teal-400">
                    {t("engineering.permissions.databaseRoleTag")}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {message && (
                  <span className="text-[10px] font-bold text-emerald-400">
                    {message}
                  </span>
                )}
                {err && (
                  <span className="text-[10px] font-bold text-red-400">
                    {err}
                  </span>
                )}
                <button
                  onClick={() => save()}
                  disabled={!canConfigure || !hasChanges || saving}
                  className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40"
                >
                  {saving
                    ? t("engineering.permissions.eligibilitySaving")
                    : t("engineering.permissions.eligibilitySave")}
                </button>
              </div>
            </div>
            <div className="divide-y divide-[var(--border-primary)]">
              {(data?.features || []).map((featureKey) => {
                const state = draft[featureKey];
                const cur = currentRows[featureKey] ?? null;
                const dirty = cur !== (state ?? null);
                return (
                  <div
                    key={featureKey}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${dirty ? "bg-brand-orange/5" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                        {featureKey}
                      </p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">
                        {state === 1
                          ? t("engineering.permissions.eligibilityEligible")
                          : state === 0
                            ? t("engineering.permissions.eligibilityNotEligible")
                            : t("engineering.permissions.eligibilityUnset")}
                        {dirty
                          ? " • " + t("engineering.permissions.eligibilityDirty")
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {stateBtn(
                        featureKey,
                        1,
                        "engineering.permissions.eligibilityEligible",
                        "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
                      )}
                      {stateBtn(
                        featureKey,
                        0,
                        "engineering.permissions.eligibilityNotEligible",
                        "bg-red-500/15 border-red-500/40 text-red-400",
                      )}
                      {stateBtn(
                        featureKey,
                        null,
                        "engineering.permissions.eligibilityUnset",
                        "bg-primary border-[var(--border-primary)] text-[var(--text-primary)]",
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.eligibilityLegend")}
          </p>
        </>
      ) : (
        <div className="py-10 text-center opacity-40">
          <Shield className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">
            {t("engineering.permissions.eligibilityNoIdentity")}
          </p>
        </div>
      )}

      {/* C2 — confirmation before an eligibility downgrade strands capabilities
          that role-default templates still grant. Nothing was deleted. */}
      {pendingImpacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setPendingImpacts(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <h4
              className="text-sm font-black uppercase tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {t("engineering.permissions.eligibilityImpactTitle")}
            </h4>
            <p
              className="text-[10px] font-bold mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("engineering.permissions.eligibilityImpactHint")}
            </p>
            <div className="space-y-3 mt-4">
              {pendingImpacts.map((impact) => (
                <div
                  key={`${impact.role}:${impact.feature}`}
                  className="rounded-lg border p-3 space-y-1.5"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                    {t("engineering.permissions.eligibilityImpactIdentity", {
                      role: impact.role,
                      feature: impact.feature,
                    })}
                  </p>
                  {impact.templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {tpl.name}
                      </span>
                      <span
                        className="text-[10px] font-mono text-right break-words"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {tpl.capabilities.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setPendingImpacts(null)}
                className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.cancel")}
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
              >
                {t("engineering.permissions.eligibilityImpactConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
