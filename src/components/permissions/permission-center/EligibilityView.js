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
import { Loader2, Shield } from "lucide-react";
import EligibilityIdentityPicker from "@/components/permissions/permission-center/eligibility-view/EligibilityIdentityPicker";
import EligibilityImpactModal from "@/components/permissions/permission-center/eligibility-view/EligibilityImpactModal";
import EligibilityMatrix from "@/components/permissions/permission-center/eligibility-view/EligibilityMatrix";
import EligibilityNotices from "@/components/permissions/permission-center/eligibility-view/EligibilityNotices";
import EligibilityViewToggle from "@/components/permissions/permission-center/eligibility-view/EligibilityViewToggle";

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
      <EligibilityViewToggle
        t={t}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Matrix view: roles × features — click a cell to edit that identity */}
      {viewMode === "matrix" && data && (
        <EligibilityMatrix
          t={t}
          data={data}
          matrixRoles={matrixRoles}
          isDatabaseRole={isDatabaseRole}
          stateFor={stateFor}
          setIdentityType={setIdentityType}
          setIdentityValue={setIdentityValue}
          setViewMode={setViewMode}
        />
      )}

      <EligibilityNotices t={t} canConfigure={canConfigure} />

      {/* Identity selector */}
      <EligibilityIdentityPicker
        t={t}
        identityType={identityType}
        setIdentityType={setIdentityType}
        setIdentityValue={setIdentityValue}
        identityValue={identityValue}
        identities={identities}
      />

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
        <EligibilityImpactModal
          t={t}
          pendingImpacts={pendingImpacts}
          setPendingImpacts={setPendingImpacts}
          save={save}
          saving={saving}
        />
      )}
    </div>
  );
}
