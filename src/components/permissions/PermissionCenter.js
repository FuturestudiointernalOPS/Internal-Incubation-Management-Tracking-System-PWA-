"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Shield,
  Search,
  User,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Info,
  Layers,
  Copy,
  Eye,
  EyeOff,
  Award,
  Pencil,
  Ban,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import AppPagination from "@/components/ui/AppPagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";
import { capabilityLabel, CAPABILITY_CATALOG, moduleCapabilityParents } from "@/lib/authorization/capability-catalog";
import { FEATURE_ORDER } from "@/models/authorization/eligibility-defaults";
import { deriveMembershipStatus } from "@/lib/membership-ui";
import {
  isResponsibilityBlockedForRole,
  normalizeAllowedRoles,
  defaultAllowedRoles,
  eligibleRolesForFeature,
} from "@/lib/featureAccess";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import Badge from "@/components/permissions/ui/Badge";
import StatCard from "@/components/permissions/ui/StatCard";
import WhyDrawer from "@/components/permissions/ui/WhyDrawer";
import PendingChangesList from "@/components/permissions/ui/PendingChangesList";
import { diffCapabilities } from "@/components/permissions/pendingChanges";
import { splitAuditReason } from "@/components/permissions/auditHelpers";
import RiskConfirmDialog from "@/components/permissions/RiskConfirmDialog";
import AuditPersonFilter from "@/components/permissions/AuditPersonFilter";
import { riskyChanges } from "@/components/permissions/riskGate";
import { deriveProfileBadges } from "@/components/permissions/profileBadges";
import FeatureMatrixSection from "@/components/permissions/FeatureMatrixSection";
import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import { groupModulesByFeature, buildSubsectionRows, toggleCapability, toggleFullCapabilities, filterSectionsByRoleEligibility, crudCapabilities, CRUD_CAPABILITIES, collectHiddenStoredCaps, eligibleFeaturesForPerson, isPersonEligibleForFeature, deriveUserCapState, describeCapOrigins } from "@/components/permissions/matrixHelpers";
import { defer, createLatestGuard } from "@/components/permissions/effectUtils";
// Person-screen level chips — shared with PeopleView so both screens offer the
// same editable affordance for the same value (see ./levelChips). Declared in
// ONE place: a second copy is how the two screens drifted apart before.
import {
  ACCESS_LEVEL_KEYS,
  ACCESS_SHORT,
  LEVELS_ORDER,
  LEVEL_CHIP_ACTIVE,
  LEVEL_CHIP_BASE,
  LEVEL_CHIP_IDLE,
  LEVEL_CHIP_INHERITED,
} from "@/components/permissions/levelChips";

export default function PermissionManager({
  initialTab = "search",
  initialProfileId = null,
  cid = null,
}) {
  const { t, lang } = useI18n();
  // Navigation is owned by the Permission Shell (route + `?sub=`); this screen
  // renders exactly the view its props ask for. The call sites key the
  // instance on the sub-tab, so switching a sub-tab remounts it fresh — there
  // is no internal tab state left to disagree with the URL.
  const activeTab = initialTab;
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState(null);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [modules, setModules] = useState({});
  const [modulesError, setModulesError] = useState("");
  const [moduleToFeature, setModuleToFeature] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  // A pending write whose capability the catalog rates high or critical. It is
  // CONFIRMED, never blocked — see ./RiskConfirmDialog.
  const [riskGate, setRiskGate] = useState(null);
  const [whyTarget, setWhyTarget] = useState(null); // { module, capability } for the explanation modal
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignProfileId, setAssignProfileId] = useState("");
  const [assignProfiles, setAssignProfiles] = useState([]);
  const [assignMsg, setAssignMsg] = useState("");
  const [assignErr, setAssignErr] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);

  const fetchModules = useCallback(async () => {
    setModulesError("");
    try {
      const res = await fetch("/api/engineering/permissions");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setModules(data.modules || {});
      setModuleToFeature(data.moduleToFeature || {});
    } catch (e) {
      console.error("Failed to fetch modules", e);
      // The catalogue is what the grid is built from: without it there is no
      // section and no right to show, so the failure is stated where the grid
      // would be instead of looking like an empty screen.
      setModulesError(
        e?.message || t("engineering.permissions.catalogLoadFailed"),
      );
    }
  }, [t]);

  // SAME editable catalog as the Templates editor: PERMISSION_MODULES ∪ every
  // non-locked catalog module. Both editors therefore expose the same modules
  // (e.g. bulk_upload) and neither can silently hide one.
  const availableModules = useMemo(() => buildEditableModules(modules), [modules]);

  // Grouped by FUNCTIONALITY (the dashboard sections), exactly like Templates —
  // not by a local hardcoded list. Unmapped modules (org_membership) and
  // modules without a CRUD capability stay out of this grid; their non-CRUD
  // capabilities live in the Advanced section below. The eligibility ceiling is
  // applied further down (it needs the resolved person context).
  const allModuleSections = useMemo(
    () =>
      groupModulesByFeature(availableModules, moduleToFeature, FEATURE_ORDER)
        .filter((section) => !section.unmapped)
        .map((section) => ({
          ...section,
          modules: section.modules.filter(
            (m) => crudCapabilities(availableModules[m]?.capabilities || []).length > 0,
          ),
        }))
        .filter((section) => section.modules.length > 0),
    [availableModules, moduleToFeature],
  );

  // i18n with a real fallback: a missing key comes back as the key itself.
  const featureLabel = (feature) => {
    const key = `engineering.permissions.features.${feature}`;
    const value = t(key);
    return value && value !== key ? value : feature.replace(/_/g, " ");
  };

  // Effects live BELOW the loaders they call, so no variable is accessed
  // before its declaration (react-hooks/immutability).
  useEffect(() => {
    defer(() => fetchModules());
  }, [fetchModules]);

  // One line of succession for every read of the selected person's access: a
  // late answer from the person you just left must never paint their rights
  // under the name of the person you are now looking at. The loader is declared
  // BEFORE the effect that calls it, so neither is accessed before declaration
  // (react-hooks/immutability).
  const personLoad = useRef(null);
  if (personLoad.current == null) {
    personLoad.current = createLatestGuard();
  }

  const selectUser = useCallback(async (user) => {
    setSelectedUser(user);
    // One person, two lenses: keep ?cid= in the URL so the "Effective access"
    // sub-tab (the read lens) opens the same person.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("cid", user.cid);
      window.history.replaceState(null, "", url);
    } catch {
      /* cosmetic handoff between the two lenses */
    }
    setLoadingPerms(true);
    setActionMsg("");
    setActionError("");
    setShowAssignForm(false); // reset the profile-override card for the new user
    setAssignMsg("");
    setAssignErr("");
    setLoadError("");
    // Clear the previous person's rights: keeping them on screen while the next
    // person loads shows one person's access under another person's name.
    setUserPerms(null);
    const token = personLoad.current.begin();
    try {
      const res = await fetch(
        `/api/engineering/permissions?user_cid=${user.cid}`,
      );
      const data = await res.json();
      if (!personLoad.current.isCurrent(token)) return; // a newer person won
      if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setUserPerms(data);
      // Auto-expand all modules
      const expanded = {};
      Object.keys(data.effectivePermissions || {}).forEach((key) => {
        expanded[key] = true;
      });
      setExpandedModules(expanded);
    } catch (e) {
      console.error("Failed to fetch user permissions", e);
      if (!personLoad.current.isCurrent(token)) return;
      setLoadError(
        e?.message || t("engineering.permissions.personAccessLoadFailed"),
      );
    } finally {
      if (personLoad.current.isCurrent(token)) setLoadingPerms(false);
    }
  }, [t]);

  // The screen above owns the person selection: the editor follows the cid it
  // is handed (Individual Access merged both lenses onto one selection).
  useEffect(() => {
    if (!cid) return;
    defer(() => selectUser({ cid }));
  }, [cid, selectUser]);

  const loadAssignProfiles = async () => {
    try {
      const res = await fetch("/api/access-profiles");
      const data = await res.json();
      if (data.success) setAssignProfiles(data.profiles || []);
    } catch (e) {
      console.error("Failed to load profiles", e);
    }
  };

  // Assign or remove the selected user's profile override (empty = remove).
  const saveProfileOverride = async (profileId) => {
    if (!selectedUser) return;
    setAssignBusy(true);
    setAssignMsg("");
    setAssignErr("");
    try {
      const res = await fetch("/api/access-profiles/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_cid: selectedUser.cid,
          profile_id: profileId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignMsg(t(data.message || "") || data.message);
        setShowAssignForm(false);
        setAssignProfileId("");
        selectUser(selectedUser); // refresh the effective profile + matrix
      } else {
        setAssignErr(t((data.error || t("engineering.permissions.failedToAssign")) || "") || (data.error || t("engineering.permissions.failedToAssign")));
      }
    } catch {
      setAssignErr(t("engineering.permissions.networkError"));
    } finally {
      setAssignBusy(false);
    }
  };

  // The source layers as the SERVER describes them (profile, group, direct
  // grant) plus the blocks, so the editors can name the origin of a capability
  // exactly the way the report does. `getOrigin` below answers the coarser
  // question the write controls need (is there a personal exception?); this one
  // answers "why do they have it?" for the reader.
  const sourceLayers = useMemo(() => {
    const sources = userPerms?.explanation?.sources || {};
    const restrictions = {};
    for (const row of userPerms?.individualRestrictions || []) {
      if (!row?.module || !row?.capability) continue;
      restrictions[row.module] ??= {};
      restrictions[row.module][row.capability] = true;
    }
    return {
      profile: sources.profile || {},
      groups: sources.groups || {},
      grants: sources.grants || {},
      restrictions,
    };
  }, [userPerms]);

  /** Origin labels of one capability, ready to render (never empty). */
  const originsOf = (module, capability) =>
    describeCapOrigins(
      deriveUserCapState(
        sourceLayers,
        module,
        capability,
        isPersonEligibleForFeature(eligibilityMap, featureMap[module]),
      ),
      {
        profileName: userPerms?.effectiveProfile?.profileName || null,
        groups: userPerms?.groups || [],
        superAdmin: userPerms?.user?.role === "super_admin",
      },
    );

  /** One capability's origin, as a readable sentence. */
  const originText = (module, capability) =>
    originsOf(module, capability)
      .map((origin) => t(origin.key, origin.params))
      .join(" · ");

  const getEffectiveLevel = (module, capability) => {
    return userPerms?.effectivePermissions?.[module]?.[capability] ?? 0;
  };

  const getOrigin = (module, capability) => {
    const grants = userPerms?.individualGrants || [];
    const restrictions = userPerms?.individualRestrictions || [];
    if (
      restrictions.some(
        (r) => r.module === module && r.capability === capability,
      )
    )
      return "restricted";
    if (grants.some((g) => g.module === module && g.capability === capability))
      return "granted";
    return "inherited";
  };

  // Person screen — BOTH blocks only offer what this person can actually be
  // granted: the features they are eligible for, PLUS any feature or right
  // where a personal exception already exists (so it stays visible and can be
  // undone). A missing eligibility map hides nothing at all.
  const eligibilityMap = userPerms?.explanation?.eligibility || null;
  const featureMap = userPerms?.moduleToFeature || moduleToFeature || {};

  // "module.capability" keys that hold a personal grant or block, for the parts
  // a template matrix cannot show (the non-CRUD capabilities). The CRUD rights
  // need no such list: every section is listed above, so a personal CRUD
  // exception is always visible and always undoable.
  const exceptionSpecialCaps = new Set();
  for (const [mod, def] of Object.entries(availableModules)) {
    for (const capability of def.capabilities || []) {
      if (getOrigin(mod, capability) === "inherited") continue;
      if (!CRUD_CAPABILITIES.includes(capability)) {
        exceptionSpecialCaps.add(`${mod}.${capability}`);
      }
    }
  }
  const exceptionModules = [
    ...new Set(
      [...exceptionSpecialCaps].map((key) => key.slice(0, key.indexOf("."))),
    ),
  ];

  const personFeatures =
    eligibleFeaturesForPerson(eligibilityMap, featureMap, exceptionModules) ??
    // Unknown eligibility → treat every feature as available (hide nothing),
    // while still passing a set so the block never shows non-section parts.
    new Set(Object.values(featureMap));

  // Basic-rights grid: EVERY section of the catalogue is listed, always. The
  // eligibility ceiling decides whether a NEW right can be granted here (the
  // server rejects a grant on an ineligible feature), never whether the admin
  // can see the section: filtering the grid by eligibility made the rights look
  // like they had vanished. An ineligible section is rendered read-only — the
  // person's existing individual exceptions (a grant or a block) stay visible
  // and can still be undone.
  const moduleSections = allModuleSections.map((section) => ({
    ...section,
    eligible: isPersonEligibleForFeature(eligibilityMap, section.feature),
  }));

  const ineligibleSectionCount = moduleSections.filter(
    (section) => !section.eligible,
  ).length;

  const applyQuickAction = async (action, module, capability, level) => {
    setActionMsg("");
    setActionError("");

    // Optimistic update — apply change immediately to local state
    const prevPerms = { ...userPerms };
    const newPerms = JSON.parse(JSON.stringify(userPerms));

    if (action === "grant") {
      // Add to individual grants
      const existing = newPerms.individualGrants || [];
      const idx = existing.findIndex(
        (g) => g.module === module && g.capability === capability,
      );
      if (idx >= 0) {
        existing[idx].access_level = level;
      } else {
        existing.push({
          module,
          capability,
          access_level: level,
          granted_by: "self",
        });
      }
      newPerms.individualGrants = existing;
      // Update effective permissions
      if (!newPerms.effectivePermissions[module])
        newPerms.effectivePermissions[module] = {};
      newPerms.effectivePermissions[module][capability] = level;
      // Remove from restrictions if present
      newPerms.individualRestrictions = (
        newPerms.individualRestrictions || []
      ).filter((r) => !(r.module === module && r.capability === capability));
    }

    if (action === "revoke") {
      newPerms.individualGrants = (newPerms.individualGrants || []).filter(
        (g) => !(g.module === module && g.capability === capability),
      );
      // Revert effective to 0 (or re-calculate by removing from effective)
      if (newPerms.effectivePermissions[module]) {
        delete newPerms.effectivePermissions[module][capability];
      }
    }

    if (action === "restrict") {
      newPerms.individualRestrictions = newPerms.individualRestrictions || [];
      if (
        !newPerms.individualRestrictions.some(
          (r) => r.module === module && r.capability === capability,
        )
      ) {
        newPerms.individualRestrictions.push({
          module,
          capability,
          restricted_by: "self",
        });
      }
      if (newPerms.effectivePermissions[module]) {
        delete newPerms.effectivePermissions[module][capability];
      }
    }

    if (action === "unrestrict") {
      newPerms.individualRestrictions = (
        newPerms.individualRestrictions || []
      ).filter((r) => !(r.module === module && r.capability === capability));
      // Restore default level (will be corrected by background refresh)
      if (newPerms.effectivePermissions[module]) {
        newPerms.effectivePermissions[module][capability] = level || 1;
      }
    }

    // Apply optimistic update immediately
    setUserPerms(newPerms);
    setActionMsg(t("engineering.permissions.actionUpdating", { action }));

    // Fire API in background
    try {
      const res = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          user_cid: selectedUser.cid,
          module,
          capability,
          access_level: level ?? 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t("engineering.permissions.actionSuccess", { action }));
        // Quietly refresh in background
        refreshUserPerms();
      } else {
        // Revert on failure
        setUserPerms(prevPerms);
        setActionError(t((data.error || t("engineering.permissions.actionFailed")) || "") || (data.error || t("engineering.permissions.actionFailed")));
      }
    } catch {
      setUserPerms(prevPerms);
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  /**
   * The gate in front of `applyQuickAction`. `critical` and `high` capabilities
   * were already colour-coded in the matrix, but the click carried no name: this
   * states which capability is about to change and at what risk, then applies it
   * on confirm. Low and medium writes stay one click — confirming everything is
   * how a confirmation stops being read.
   */
  const handleQuickAction = async (action, module, capability, level) => {
    const risky = riskyChanges([{ module, capability }]);
    if (risky.length > 0) {
      setRiskGate({ action, module, capability, level, risky });
      return;
    }
    await applyQuickAction(action, module, capability, level);
  };

  const refreshUserPerms = async () => {
    const token = personLoad.current.begin();
    try {
      const res = await fetch(
        `/api/engineering/permissions?user_cid=${selectedUser.cid}`,
      );
      const data = await res.json();
      if (!personLoad.current.isCurrent(token)) return; // a newer person won
      if (data.success) setUserPerms(data);
    } catch {}
  };

  // Promote / remove Super Admin — one implementation, rendered either inside
  // the full identity bar (standalone screen) or in the compact header of the
  // merged Individual Access screen.
  const superAdminAction = selectedUser && userPerms && (
    userPerms.user.role !== "super_admin" ? (
      <button
        onClick={async () => {
          setActionMsg("");
          setActionError("");
          try {
            const res = await fetch("/api/engineering/permissions", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "promote_super_admin",
                user_cid: selectedUser.cid,
              }),
            });
            const data = await res.json();
            if (data.success) {
              setActionMsg(t("engineering.permissions.promotedToSuperAdmin"));
              selectUser(selectedUser);
            } else
              setActionError(
                t((data.error || t("engineering.permissions.failed")) || "") ||
                  (data.error || t("engineering.permissions.failed")),
              );
          } catch {
            setActionError(t("engineering.permissions.networkError"));
          }
        }}
        className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500/20 transition-all"
      >
        <Shield className="w-3 h-3 inline mr-1" />
        {t("engineering.permissions.makeSuperAdmin")}
      </button>
    ) : (
      <button
        onClick={async () => {
          setActionMsg("");
          setActionError("");
          try {
            const res = await fetch("/api/engineering/permissions", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "remove_super_admin",
                user_cid: selectedUser.cid,
              }),
            });
            const data = await res.json();
            if (data.success) {
              setActionMsg(t("engineering.permissions.superAdminRemoved"));
              selectUser(selectedUser);
            } else
              setActionError(
                t((data.error || t("engineering.permissions.failed")) || "") ||
                  (data.error || t("engineering.permissions.failed")),
              );
          } catch {
            setActionError(t("engineering.permissions.networkError"));
          }
        }}
        className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
      >
        <Shield className="w-3 h-3 inline mr-1" />
        {t("engineering.permissions.removeSuperAdmin")}
      </button>
    )
  );

  return (
    <>
      <div className="space-y-8 pb-20">
        {activeTab === "eligibility" && <EligibilityView />}
        {activeTab === "setup" && <AccessProfilesView initialProfileId={initialProfileId} />}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Loading, and failing to load, keep this panel in place and say
                what is happening. The area used to render nothing until the
                person's access arrived — and nothing at all when the request
                was refused, which reads exactly like a section removed from
                the screen. */}
            {selectedUser && !userPerms && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                  {t("engineering.permissions.accessEditorTitle")}
                </h3>
                {loadingPerms ? (
                  <div
                    role="status"
                    aria-label={t("common.loading")}
                    className="space-y-3"
                  >
                    <Skeleton className="h-10" />
                    <Skeleton className="h-40" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                      {t("engineering.permissions.personAccessLoadFailed")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] break-words">
                      {loadError ||
                        t("engineering.permissions.personAccessUnavailable")}
                    </p>
                    <button
                      type="button"
                      onClick={() => selectUser(selectedUser)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t("common.refresh")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User Permission Panel */}
            {selectedUser && userPerms && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    {t("engineering.permissions.accessEditorTitle")}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {superAdminAction}
                  </div>
                </div>

                {/* Status messages */}
                {actionMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-[10px] font-bold text-emerald-400">
                      {actionMsg}
                    </p>
                  </div>
                )}
                {actionError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] font-bold text-red-400">
                      {actionError}
                    </p>
                  </div>
                )}

                {/* Profile override — an Individual Access exception (Super
                    Admin uses the bypass, so an override is not applicable) */}
                {userPerms.user.role !== "super_admin" && (
                  <div className="ios-card !p-5 border-[var(--border-primary)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                        {t("engineering.permissions.assignProfileTitle")}
                      </h4>
                      {userPerms.effectiveProfile?.source === "user" && (
                        <button
                          onClick={() => saveProfileOverride("")}
                          disabled={assignBusy}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {t("engineering.permissions.removeOverride")}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {userPerms.effectiveProfile?.source === "user"
                        ? t("engineering.permissions.currentOverride", {
                            name:
                              userPerms.effectiveProfile.profileName || "—",
                          })
                        : t("engineering.permissions.noOverride", {
                            name:
                              userPerms.effectiveProfile?.profileName ||
                              t("engineering.permissions.legacyRoleCapabilities"),
                          })}
                    </p>
                    {assignMsg && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] font-bold text-emerald-400">
                          {assignMsg}
                        </p>
                      </div>
                    )}
                    {assignErr && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-[10px] font-bold text-red-400">
                          {assignErr}
                        </p>
                      </div>
                    )}
                    {showAssignForm ? (
                      <div className="space-y-3">
                        <select
                          value={assignProfileId}
                          onChange={(e) => setAssignProfileId(e.target.value)}
                          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                        >
                          <option value="">
                            {t("engineering.permissions.selectProfile")}
                          </option>
                          {assignProfiles
                            .filter((p) => p.is_active)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveProfileOverride(assignProfileId)}
                            disabled={!assignProfileId || assignBusy}
                            className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {t("engineering.permissions.assign")}
                          </button>
                          <button
                            onClick={() => {
                              setShowAssignForm(false);
                              setAssignProfileId("");
                            }}
                            className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                          >
                            {t("engineering.permissions.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowAssignForm(true);
                          setAssignProfileId("");
                          loadAssignProfiles();
                        }}
                        className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.assignProfile")}
                      </button>
                    )}
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />{" "}
                    {t("engineering.permissions.legendInherited")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                    {t("engineering.permissions.legendIndividualGrant")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />{" "}
                    {t("engineering.permissions.restricted")}
                  </span>
                </div>

                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("engineering.permissions.personRightsHint")}
                </p>

                {ineligibleSectionCount > 0 && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-80">
                    {t("engineering.permissions.personIneligibleSectionsNote")}
                  </p>
                )}

                {/* Access explanation — who has access and why */}
                {userPerms.explanation && (
                  <AccessExplanationPanel
                    explanation={userPerms.explanation}
                    t={t}
                  />
                )}

                {/* Permission Tables */}
                {loadingPerms ? (
                  <div className="flex items-center justify-center py-20">
                    <div
                      className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,102,0,0.1)",
                        borderTopColor: "var(--brand-orange)",
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {modulesError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                          {t("engineering.permissions.catalogLoadFailed")}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] break-words">
                          {modulesError}
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchModules()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t("common.refresh")}
                        </button>
                      </div>
                    )}
                    {!modulesError && moduleSections.length === 0 && (
                      <p className="text-xs font-bold text-[var(--text-secondary)]">
                        {t("engineering.permissions.personNoSections")}
                      </p>
                    )}
                    {moduleSections.map((section) => (
                      <div key={section.feature} className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 pl-1">
                          <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">
                            {featureLabel(section.feature)}
                          </h3>
                          {!section.eligible && (
                            <span className="px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-[9px] font-black uppercase tracking-widest text-amber-400">
                              {t("engineering.permissions.personSectionNotEligible")}
                            </span>
                          )}
                        </div>
                        {section.modules.map((modKey) => {
                          const mod = availableModules[modKey];
                          if (!mod) return null;
                          // The CRUD grid edits CRUD only; the module's other
                          // capabilities live in the Advanced section below.
                          const caps = crudCapabilities(mod.capabilities || []);
                          if (caps.length === 0) return null;
                          const isExpanded = expandedModules[modKey] !== false;
                          // Eligibility ceiling on the WRITE control only: the
                          // server refuses a grant on an ineligible feature. The
                          // section still shows what the person holds, and a
                          // block can still be undone.
                          const lockLevels = !section.eligible;

                          return (
                            <div
                              key={modKey}
                              className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
                            >
                              {/* Module header */}
                              <button
                                onClick={() =>
                                  setExpandedModules((prev) => ({
                                    ...prev,
                                    [modKey]: !prev[modKey],
                                  }))
                                }
                                className="w-full flex items-center justify-between px-5 py-4 bg-tertiary/30 hover:bg-tertiary/50 transition-all border-b border-[var(--border-primary)]"
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                  )}
                                  <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">
                                    {mod.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                                  {t("engineering.permissions.capabilitiesCount", { count: caps.length })}
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-[var(--border-primary)]">
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                                          {t("engineering.permissions.capability")}
                                        </th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                                          {t("engineering.permissions.actions")}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {caps.map((cap) => {
                                        const effectiveLevel =
                                          getEffectiveLevel(modKey, cap);
                                        const origin = getOrigin(modKey, cap);

                                        return (
                                          <tr
                                            key={cap}
                                            className="group border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                                          >
                                            {/* Capability name */}
                                            <td className="px-5 py-3">
                                              <div className="flex flex-wrap items-center gap-2">
                                                {origin === "granted" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                                    title={t("engineering.permissions.titleIndividualGrant")}
                                                  />
                                                )}
                                                {origin === "restricted" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-red-400 shrink-0"
                                                    title={t("engineering.permissions.restricted")}
                                                  />
                                                )}
                                                {origin === "inherited" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-slate-400 shrink-0"
                                                    title={t("engineering.permissions.titleInherited")}
                                                  />
                                                )}
                                                <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                                                  {capabilityLabel(modKey, cap)}
                                                </span>
                                                {origin === "granted" && (
                                                  <span className="shrink-0 px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                                                    {t("engineering.permissions.legendIndividualGrant")}
                                                  </span>
                                                )}
                                                {origin === "restricted" && (
                                                  <span className="shrink-0 px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-400">
                                                    {t("engineering.permissions.restricted")}
                                                  </span>
                                                )}
                                              </div>
                                              {/* The state the chips act on: what the
                                                  person has TODAY and where it comes
                                                  from, so a chip is never clicked blind
                                                  (a direct grant of a level the person
                                                  already inherits changes nothing). */}
                                              <p className="mt-1 text-[9px] font-bold text-[var(--text-secondary)] opacity-80">
                                                {t("engineering.permissions.advancedCurrentState")}:{" "}
                                                {originText(modKey, cap)}
                                              </p>
                                            </td>

                                            {/* Controls — the level chips use the same
                                                visual language as the template matrix:
                                                pick a level to grant it personally, block
                                                a right the person would otherwise inherit,
                                                or restore it. */}
                                            <td className="px-5 py-3">
                                              {origin === "restricted" ? (
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleQuickAction(
                                                        "unrestrict",
                                                        modKey,
                                                        cap,
                                                      )
                                                    }
                                                    title={t("engineering.permissions.titleRemoveRestriction")}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                                  >
                                                    <RotateCcw className="w-3 h-3" />
                                                    {t("engineering.permissions.restore")}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setWhyTarget({ module: modKey, capability: cap })
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                                    title={t("engineering.permissions.whyAccess")}
                                                  >
                                                    <Info className="w-3 h-3 text-blue-400" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                  {LEVELS_ORDER.filter(
                                                    (level) => level > 0,
                                                  ).map((level) => {
                                                    const isActive =
                                                      effectiveLevel === level;
                                                    return (
                                                      <button
                                                        key={level}
                                                        type="button"
                                                        disabled={isActive || lockLevels}
                                                        aria-pressed={isActive}
                                                        onClick={() =>
                                                          handleQuickAction(
                                                            "grant",
                                                            modKey,
                                                            cap,
                                                            level,
                                                          )
                                                        }
                                                        title={t(
                                                          "engineering.permissions.titleSetTo",
                                                          {
                                                            level: t(
                                                              ACCESS_LEVEL_KEYS[level],
                                                            ),
                                                          },
                                                        )}
                                                        className={`${LEVEL_CHIP_BASE} ${
                                                          isActive
                                                            ? origin === "granted"
                                                              ? LEVEL_CHIP_ACTIVE[level]
                                                              : LEVEL_CHIP_INHERITED
                                                            : LEVEL_CHIP_IDLE
                                                        }`}
                                                      >
                                                        {ACCESS_SHORT[level]}
                                                      </button>
                                                    );
                                                  })}

                                                  {effectiveLevel > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleQuickAction(
                                                          "restrict",
                                                          modKey,
                                                          cap,
                                                          0,
                                                        )
                                                      }
                                                      title={t("engineering.permissions.titleRestrict")}
                                                      className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:border-red-400/50 hover:text-red-400 transition-all"
                                                    >
                                                      <Ban className="w-3 h-3" />
                                                      {t("engineering.permissions.block")}
                                                    </button>
                                                  )}

                                                  {origin === "granted" && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleQuickAction(
                                                          "revoke",
                                                          modKey,
                                                          cap,
                                                        )
                                                      }
                                                      title={t("engineering.permissions.titleRevokeGrant")}
                                                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                                    >
                                                      <Trash2 className="w-3 h-3 text-red-400" />
                                                    </button>
                                                  )}

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setWhyTarget({ module: modKey, capability: cap })
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                                    title={t("engineering.permissions.whyAccess")}
                                                  >
                                                    <Info className="w-3 h-3 text-blue-400" />
                                                  </button>
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    {/* Non-CRUD capabilities (grant, promote_super_admin, send,
                        publish, execute…) — individual grants/blocks. Hidden when
                        the catalogue failed: these controls are built from it, and
                        an empty list would claim there is nothing to grant. */}
                    {!modulesError && (
                      <AdvancedCapabilities
                        availableModules={availableModules}
                        moduleToFeature={moduleToFeature}
                        visibleFeatures={personFeatures}
                        retainedCaps={exceptionSpecialCaps}
                        mode="individual"
                        stateOf={(module, capability) => ({
                          level: getEffectiveLevel(module, capability),
                          origin: getOrigin(module, capability),
                          origins: originsOf(module, capability),
                        })}
                        onAction={handleQuickAction}
                        onWhy={(module, capability) =>
                          setWhyTarget({ module, capability })
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "responsibilities" && <ResponsibilitiesView />}
        {activeTab === "access" && <ResponsibilityAccessView />}
        {activeTab === "audit" && <AuditView />}
        {whyTarget && (
          <CapabilityWhyModal
            userPerms={userPerms}
            module={whyTarget.module}
            capability={whyTarget.capability}
            t={t}
            lang={lang}
            onClose={() => setWhyTarget(null)}
          />
        )}

        {/* Critical/high-risk confirmation: the write is applied on confirm. */}
        <RiskConfirmDialog
          open={Boolean(riskGate)}
          changes={riskGate?.risky || []}
          subject={selectedUser?.name || selectedUser?.cid || ""}
          onCancel={() => setRiskGate(null)}
          onConfirm={() => {
            const gate = riskGate;
            setRiskGate(null);
            if (gate) {
              applyQuickAction(
                gate.action,
                gate.module,
                gate.capability,
                gate.level,
              );
            }
          }}
        />
      </div>
    </>
  );
}

/**
 * The module catalog the Access-Profile editor can EDIT: the server-served
 * PERMISSION_MODULES (the write-validated set) UNION every non-locked module of
 * the registry (CAPABILITY_CATALOG), shaped as { name, capabilities: string[] }.
 *
 * Why: MODULE_TO_FEATURE maps some modules (bulk_upload) that PERMISSION_MODULES
 * does not carry, so a feature would show only part of its sub-sections. Locked
 * modules (duplicates) stay out — they are super-admin role-locked.
 */
function buildEditableModules(permissionModules) {
  const out = { ...(permissionModules || {}) };
  for (const [mod, def] of Object.entries(CAPABILITY_CATALOG)) {
    if (out[mod] || def.locked) continue;
    out[mod] = { name: def.name, capabilities: Object.keys(def.capabilities || {}) };
  }
  return out;
}

function AccessProfilesView({ initialProfileId = null }) {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [allRoles, setAllRoles] = useState([]);
  const [eligibilityRows, setEligibilityRows] = useState([]); // feature_eligibility rows for role-based filtering
  const [moduleToFeature, setModuleToFeature] = useState({}); // capability module → feature key
  const [featureKeys, setFeatureKeys] = useState([]); // canonical feature order (eligibility API)
  // The capability catalog (PERMISSION_MODULES) as served by /api/access-profiles
  // — the SAME definition the access-profile writes are validated against. Held
  // in state: the editor used to read a `window` global and fall back to a
  // hardcoded 11-module copy of an 18-module catalog, so it showed fewer
  // modules, two renamed ones and a missing capability.
  const [moduleCatalog, setModuleCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [, setProfileCaps] = useState([]);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  // { role, violations:[{module,capability,feature}] } — set when the server
  // refuses a save against the eligibility ceiling. Rendered explicitly: the
  // generic "not eligible" message alone left the administrator unable to tell
  // WHICH identity blocked the save (that is how a retired `admin` role silently
  // blocked every save of Staff Default).
  const [saveViolations, setSaveViolations] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", description: "" });
  const [safetyAck, setSafetyAck] = useState(false); // confirmed role-bound profile edits
  const [pendingSaveConfirm, setPendingSaveConfirm] = useState(null); // roles[] when saving changes to a role-default profile
  const [draftCaps, setDraftCaps] = useState({}); // working copy {module:{capability:level}}
  const [savedCaps, setSavedCaps] = useState({}); // last-saved state for change detection
  const [saving, setSaving] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  // UI-2c — review-before-save: an optional audit reason and the number of
  // users this profile currently reaches (real count, from the impact API).
  const [reason, setReason] = useState("");
  const [impactTotal, setImpactTotal] = useState(null);
  // "Default for" — which kinds of person receive this template. This was the
  // Role → Profile screen; it belongs on the template it changes, one click
  // from the contents it affects. Same endpoint, no new authority.
  const [defaultRoleChoice, setDefaultRoleChoice] = useState("");
  const [defaultRoleMsg, setDefaultRoleMsg] = useState("");
  const [defaultRoleErr, setDefaultRoleErr] = useState("");
  const [defaultRoleBusy, setDefaultRoleBusy] = useState(false);
  // Assigned-roles editor: the roles list is read-only by default (chips), and
  // the modal holds the add/remove controls.
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState("");
  const [removeMsg, setRemoveMsg] = useState("");
  const [removeErr, setRemoveErr] = useState("");

  const fetchProfiles = useCallback(async (bypassCache = false) => {
    const urls = [
      "/api/access-profiles",
      "/api/engineering/permissions/eligibility",
    ];
    const apply = (data, eligData) => {
      if (data.success) {
        setProfiles(data.profiles || []);
        setRoleDefaults(data.roleDefaults || {});
        setModuleCatalog(data.modules || {});
      }
      // Full role catalog (ROLE_CATALOG) — not just roles that already have
      // a default — so every role can be configured in the form dropdown.
      // The same payload also feeds the role-based feature filter below.
      if (eligData.success) {
        setAllRoles(eligData.roles || Object.keys(data.roleDefaults || {}));
        setEligibilityRows(eligData.rows || []);
        setModuleToFeature(eligData.moduleToFeature || {});
        setFeatureKeys(eligData.features || []);
      } else {
        setAllRoles(Object.keys(data.roleDefaults || {}));
      }
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this tab renders instantly from fresh
      // snapshots; mutation flows pass bypassCache=true so the list always
      // reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1]);
          setLoading(false);
        }
      }
      const res = await fetch(urls[0]);
      const data = await res.json();
      if (data.success) cacheSet(urls[0], data);
      const eligRes = await fetch(urls[1]);
      const eligData = await eligRes.json();
      if (eligData.success) cacheSet(urls[1], eligData);
      apply(data, eligData);
    } catch (e) {
      console.error("Failed to load profiles", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    defer(() => fetchProfiles());
  }, [fetchProfiles]);

  const capsToObject = (rows) => {
    const o = {};
    for (const r of rows || []) {
      o[r.module] ??= {};
      o[r.module][r.capability] = Number(r.access_level);
    }
    return o;
  };

  const selectProfile = async (profile) => {
    setSelectedProfile(profile);
    setSafetyAck(false);
    setPendingSaveConfirm(null);
    setRenameMode(false);
    setActionMsg("");
    setActionError("");
    setSaveViolations(null);
    try {
      const res = await fetch(`/api/access-profiles?id=${profile.id}`);
      const data = await res.json();
      if (data.success) {
        setProfileCaps(data.capabilities || []);
        const saved = capsToObject(data.capabilities);
        setSavedCaps(saved);
        setDraftCaps(JSON.parse(JSON.stringify(saved)));
      }
    } catch (e) {
      console.error("Failed to load profile capabilities", e);
    }
  };

  // Picker → selection + deep link. `replaceState` keeps the URL shareable
  // (?profile=<id>) without importing next/navigation into this file.
  const handleProfilePick = (e) => {
    const id = e.target.value;
    if (!id) {
      setSelectedProfile(null);
      setProfileCaps([]);
      setSavedCaps({});
      setDraftCaps({});
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("profile");
        window.history.replaceState({}, "", url);
      } catch {
        /* history unavailable — ignore */
      }
      return;
    }
    const profile = profiles.find((p) => String(p.id) === String(id));
    if (!profile) return;
    selectProfile(profile);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("profile", id);
      window.history.replaceState({}, "", url);
    } catch {
      /* history unavailable — ignore */
    }
  };

  // UI-2c — deep-link / rail preselection: ?profile=<id> (or the rail) selects
  // a profile as soon as the list is available. Never auto-selects without a
  // requested id (the screen keeps its explicit "select a profile" state).
  useEffect(() => {
    if (!initialProfileId) return;
    if (
      selectedProfile &&
      String(selectedProfile.id) === String(initialProfileId)
    ) {
      return;
    }
    const hit = profiles.find((p) => String(p.id) === String(initialProfileId));
    // Deferred: the mount effect must not perform a synchronous state update.
    if (hit) defer(() => selectProfile(hit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfileId, profiles, selectedProfile]);

  // UI-2c — impact preview for the selected profile (how many users resolve to
  // it today). Read-only, fail-soft: no number is better than a wrong number.
  useEffect(() => {
    if (!selectedProfile?.id) {
      defer(() => setImpactTotal(null));
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/engineering/permissions/impact?profile_id=${encodeURIComponent(selectedProfile.id)}`,
        );
        const d = await res.json();
        if (alive) setImpactTotal(d.success ? Number(d.impact?.total || 0) : null);
      } catch {
        if (alive) setImpactTotal(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedProfile?.id]);

  const createProfile = async () => {
    if (!newProfile.name.trim()) return;
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch("/api/access-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfile.name.trim(),
          description: newProfile.description,
          capabilities: {},
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t("engineering.permissions.profileCreated", { name: newProfile.name }));
        setShowCreateForm(false);
        setNewProfile({ name: "", description: "" });
        fetchProfiles(true);
        // Auto-select the profile just created (the route returns its id).
        selectProfile({
          id: data.profileId,
          name: newProfile.name.trim(),
          description: newProfile.description,
          is_active: 1,
        });
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToCreate")) || "") || (data.error || t("engineering.permissions.failedToCreate")));
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const duplicateProfile = async (profile) => {
    setActionMsg("");
    setActionError("");
    try {
      // Fetch full profile with capabilities
      const res = await fetch(`/api/access-profiles?id=${profile.id}`);
      const data = await res.json();
      if (!data.success) {
        setActionError(t("engineering.permissions.failedToFetchSourceProfile"));
        return;
      }

      // Build capabilities object from response
      const caps = {};
      for (const c of data.capabilities) {
        if (!caps[c.module]) caps[c.module] = {};
        caps[c.module][c.capability] = c.access_level;
      }

      // Create copy
      const createRes = await fetch("/api/access-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${profile.name} (copy)`,
          description: profile.description,
          capabilities: caps,
        }),
      });
      const createData = await createRes.json();
      if (createData.success) {
        setActionMsg(t("engineering.permissions.profileDuplicated", { name: `${profile.name} (copy)` }));
        fetchProfiles(true);
      } else {
        setActionError(t((createData.error || t("engineering.permissions.failedToDuplicate")) || "") || (createData.error || t("engineering.permissions.failedToDuplicate")));
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const toggleProfileActive = async (profile) => {
    try {
      const res = await fetch("/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profile.id,
          is_active: !profile.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(
          profile.is_active
            ? t("engineering.permissions.profileDisabled")
            : t("engineering.permissions.profileEnabled"),
        );
        fetchProfiles(true);
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToToggle")) || "") || (data.error || t("engineering.permissions.failedToToggle")));
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  // ── "Default for" assignment (the retired Role → Profile screen). ──
  const assignRoleDefault = async () => {
    if (!selectedProfile?.id || !defaultRoleChoice) return;
    setDefaultRoleBusy(true);
    setDefaultRoleMsg("");
    setDefaultRoleErr("");
    try {
      const res = await fetch("/api/access-profiles/role-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_name: defaultRoleChoice,
          profile_id: selectedProfile.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDefaultRoleMsg(
          t("engineering.permissions.defaultForSetMsg", {
            name: selectedProfile.name,
            role: defaultRoleChoice,
          }),
        );
        setDefaultRoleChoice("");
        fetchProfiles(true);
      } else {
        setDefaultRoleErr(
          t((data.error || t("engineering.permissions.failedToUpdate")) || "") ||
            (data.error || t("engineering.permissions.failedToUpdate")),
        );
      }
    } catch {
      setDefaultRoleErr(t("engineering.permissions.networkError"));
    } finally {
      setDefaultRoleBusy(false);
    }
  };

  // Remove a role's default profile mapping (the role falls back to legacy
  // role_capabilities until another default is set).
  const removeRoleDefault = async (role) => {
    if (!selectedProfile?.id) return;
    setRemoveBusy(role);
    setRemoveMsg("");
    setRemoveErr("");
    try {
      const res = await fetch(
        `/api/access-profiles/role-defaults?role_name=${encodeURIComponent(role)}&profile_id=${encodeURIComponent(selectedProfile.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        setRemoveMsg(t("engineering.permissions.rolesRemoved"));
        fetchProfiles(true);
      } else {
        setRemoveErr(
          t((data.error || t("engineering.permissions.failedToRemoveDefault")) || "") ||
            (data.error || t("engineering.permissions.failedToRemoveDefault")),
        );
      }
    } catch {
      setRemoveErr(t("engineering.permissions.networkError"));
    } finally {
      setRemoveBusy("");
    }
  };

  // ── Draft-based matrix editing: changes are staged, then saved explicitly. ──
  const defaultRolesFor = (profileId) =>
    Object.entries(roleDefaults)
      .filter(([, v]) => v.profileId === profileId)
      .map(([role]) => role);

  const isChanged = (mod, cap) =>
    (draftCaps[mod]?.[cap] ?? 0) !== (savedCaps[mod]?.[cap] ?? 0);

  // Checkbox editing: View is the base capability and, within a capability
  // family, a child requires its parent (checking `archive` also checks
  // `edit`; clearing `edit` clears `archive`). The pure helpers own the rules.
  const toggleDraftCap = (mod, capability, checked, moduleCapabilities = []) => {
    setActionError("");
    setDraftCaps((prev) =>
      toggleCapability(prev, mod, capability, checked, moduleCapabilities, moduleCapabilityParents(mod)),
    );
  };

  const toggleDraftFull = (mod, checked, moduleCapabilities = []) => {
    setActionError("");
    setDraftCaps((prev) =>
      toggleFullCapabilities(prev, mod, checked, moduleCapabilities),
    );
  };

  const persistCaps = async () => {
    if (!selectedProfile) return;
    setSaving(true);
    setActionMsg("");
    setActionError("");
    setSaveViolations(null);
    try {
      const res = await fetch("/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProfile.id,
          capabilities: draftCaps,
          // UI-2c: the review bar's reason lands in the permission audit log
          // (the endpoint has recorded it since Phase 3d).
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await selectProfile(selectedProfile); // reload the saved state
        setReason("");
        setActionMsg(t("engineering.permissions.permissionsSaved"));
      } else {
        // The ceiling check runs against EVERY role this template serves, so a
        // refusal is per identity: keep the server's `role` + `violations` and
        // show them — they name the feature to allow in Rules → Feature
        // eligibility before saving again.
        setSaveViolations(
          Array.isArray(data.violations) && data.violations.length > 0
            ? { role: data.role || null, violations: data.violations }
            : null,
        );
        setActionError(t((data.error || t("engineering.permissions.failedToUpdate")) || "") || (data.error || t("engineering.permissions.failedToUpdate")));
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    } finally {
      setSaving(false);
    }
  };

  // Profile safety: saving changes to a role-default profile requires one
  // explicit confirmation (the warning is not an authorization mechanism —
  // the server still authorizes the mutation).
  const saveChanges = () => {
    if (!selectedProfile || computeChanges() === 0) return;
    const defaultFor = defaultRolesFor(selectedProfile.id);
    if (defaultFor.length > 0 && !safetyAck) {
      setPendingSaveConfirm(defaultFor);
      return;
    }
    persistCaps();
  };

  const confirmSave = () => {
    setSafetyAck(true);
    setPendingSaveConfirm(null);
    persistCaps();
  };

  const discardChanges = () => {
    setDraftCaps(JSON.parse(JSON.stringify(savedCaps)));
  };

  // Lazy: availableModules is defined later in the component body. The union
  // with the draft/saved modules matters for C1: a stored module the matrix
  // cannot show (ineligible feature, or a module no longer in the registry) is
  // exactly the one the "Remove" action clears, and that change must enable
  // Save.
  const computeChanges = () => {
    const modKeys = new Set([
      ...Object.keys(availableModules),
      ...Object.keys(draftCaps || {}),
      ...Object.keys(savedCaps || {}),
    ]);
    let count = 0;
    for (const modKey of modKeys) {
      const caps = new Set([
        ...(availableModules[modKey]?.capabilities || []),
        ...Object.keys(draftCaps?.[modKey] || {}),
        ...Object.keys(savedCaps?.[modKey] || {}),
      ]);
      for (const cap of caps) {
        if (isChanged(modKey, cap)) count += 1;
      }
    }
    return count;
  };

  const renameProfile = async () => {
    if (!selectedProfile || !renameValue.trim()) return;
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch("/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedProfile.id, name: renameValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedProfile({ ...selectedProfile, name: renameValue.trim() });
        setRenameMode(false);
        setActionMsg(t("engineering.permissions.profileRenamed"));
        fetchProfiles(true);
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToUpdate")) || "") || (data.error || t("engineering.permissions.failedToUpdate")));
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  // The editor's module catalog = the registry truth (CAPABILITY_CATALOG), not
  // just PERMISSION_MODULES, so each feature shows ALL of its sub-sections
  // (e.g. CRM → Contacts + Bulk Upload). `locked` modules (duplicates) are
  // super-admin role-locked and never enter a profile.
  const availableModules = moduleCatalog ? buildEditableModules(moduleCatalog) : {};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div
          className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255,102,0,0.1)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );
  }

  const changesCount = computeChanges();
  const selectedIsDefaultFor = selectedProfile
    ? defaultRolesFor(selectedProfile.id)
    : [];

  // A role is eligible for a feature when at least one row says yes and no
  // row explicitly denies it — mirrors the resolver's fail-closed semantics.
  const isRoleEligibleForFeature = (role, feature) => {
    let anyEligible = false;
    for (const row of eligibilityRows) {
      if (
        row.identity_type !== "role" ||
        row.identity_value !== role ||
        row.feature_key !== feature
      ) {
        continue;
      }
      if (Number(row.eligible) === 1) anyEligible = true;
      else return false; // explicit deny wins
    }
    return anyEligible;
  };

  // Feature sections: each FEATURE (sidebar-level section) carries its modules
  // as sub-sections (rows) and the ordered union of their capabilities (the
  // header row). STRICT: only the features the profile's assigned role(s) are
  // eligible for are shown (union); a profile with no role shows nothing until
  // it is assigned one (see filterSectionsByRoleEligibility).
  //
  // Unmapped modules (modules with no feature — e.g. org_membership) are NOT
  // features and are dropped: the template only ever shows dashboard sections.
  const eligibleSections = filterSectionsByRoleEligibility(
    groupModulesByFeature(availableModules, moduleToFeature, featureKeys),
    selectedIsDefaultFor,
    isRoleEligibleForFeature,
  ).filter((section) => !section.unmapped);

  // The features the profile's roles are eligible for. Also the ceiling for the
  // Advanced section, so it never offers what the roles cannot hold.
  const visibleFeatures = new Set(
    eligibleSections.map((section) => section.feature),
  );

  // Every module of every eligible feature is listed as a sub-section — INCLUDING
  // modules whose capabilities are all non-CRUD (bulk_upload, permissions,
  // facilitator): the feature must show its real sub-sections. Those capabilities
  // are edited in the Advanced section below; the CRUD cells stay empty for them.
  const visibleSections = eligibleSections;

  // C1 — modules the matrix above can edit. Anything STORED outside this set is
  // invisible to the editor (ineligible feature, or module without a dashboard
  // section) yet still granted AND still validated on save, so it must stay
  // visible and removable instead of silently blocking the save.
  const editableModules = new Set(
    visibleSections.flatMap((section) => section.modules),
  );
  // Capability granularity: a module can be editable while one of its
  // capabilities is no longer offered (retired), so the hidden set is computed
  // per capability, not per module.
  const editableCaps = {};
  for (const moduleKey of editableModules) {
    editableCaps[moduleKey] = availableModules[moduleKey]?.capabilities || [];
  }
  const hiddenStoredCaps = collectHiddenStoredCaps(savedCaps, editableCaps);

  // C1 — drop the stored capabilities the matrix above does not offer. Staged
  // like every other edit: the review bar + Save still apply, so it can be
  // discarded. Capability-level, so an offered capability of the same module is
  // never collateral damage.
  const clearHiddenCaps = (entry) => {
    setActionError("");
    setDraftCaps((prev) => {
      const next = { ...prev, [entry.module]: { ...(prev[entry.module] || {}) } };
      for (const capability of entry.capabilities) {
        next[entry.module][capability] = 0;
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {actionMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-400">{actionMsg}</p>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{actionError}</p>
        </div>
      )}
      {saveViolations && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            {t("engineering.permissions.ineligibleCapsTitle")}
          </p>
          {saveViolations.role && (
            <p className="text-[10px] font-bold text-[var(--text-primary)]">
              {t("engineering.permissions.ineligibleCapsRole", {
                role: saveViolations.role,
              })}
            </p>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {[
              ...new Set(
                saveViolations.violations.map(
                  (v) => `${v.module}.${v.capability} → ${v.feature}`,
                ),
              ),
            ].map((line) => (
              <li
                key={line}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary border border-[var(--border-primary)] text-[var(--text-secondary)]"
              >
                {line}
              </li>
            ))}
          </ul>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.ineligibleCapsHint")}
          </p>
        </div>
      )}

      {/* Header aligné : descriptif à gauche, bouton "Nouveau profil" à droite */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs font-bold text-[var(--text-secondary)] max-w-3xl">
          {t("engineering.permissions.profilesIntro")}
        </p>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shrink-0 self-start"
        >
          <Plus className="w-3 h-3" /> {t("engineering.permissions.newProfile")}
        </button>
      </div>

      {showCreateForm && (
            <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
              <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                {t("engineering.permissions.newAccessProfile")}
              </h4>
              <div className="space-y-3">
                <input
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, name: e.target.value })
                  }
                  placeholder={t("engineering.permissions.profileNamePlaceholder")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
                <input
                  value={newProfile.description}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, description: e.target.value })
                  }
                  placeholder={t("engineering.permissions.descriptionOptional")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createProfile}
                    disabled={!newProfile.name.trim()}
                    className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {t("engineering.permissions.create")}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewProfile({ name: "", description: "" });
                    }}
                    className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                  >
                    {t("engineering.permissions.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Champ déroulant des profils — remplace l'ancienne liste latérale */}
      <div className="ios-card !p-5 border-[var(--border-primary)] space-y-2">
        <label
          htmlFor="access-profile-picker"
          className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]"
        >
          {t("engineering.permissions.profilePickerLabel")}
        </label>
        <select
          id="access-profile-picker"
          value={selectedProfile ? String(selectedProfile.id) : ""}
          onChange={handleProfilePick}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        >
          <option value="">{t("engineering.permissions.selectProfileOption")}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
              {!profile.is_active
                ? ` — ${t("engineering.permissions.disabled")}`
                : ""}
            </option>
          ))}
        </select>
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {profiles.length === 0
            ? t("engineering.permissions.noAccessProfilesHint")
            : t("engineering.permissions.profilePickerHint")}
        </p>
      </div>

      {/* Détail — affiché en dessous, seulement si un profil est sélectionné */}
      {selectedProfile ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {renameMode ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder={t("engineering.permissions.renamePlaceholder")}
                        className="w-56 bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50"
                      />
                      <button
                        onClick={renameProfile}
                        disabled={!renameValue.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        onClick={() => {
                          setRenameMode(false);
                          setRenameValue("");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
                        {selectedProfile.name}
                      </h3>
                      <button
                        onClick={() => {
                          setRenameMode(true);
                          setRenameValue(selectedProfile.name);
                        }}
                        className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title={t("engineering.permissions.renameProfile")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {selectedProfile.description && (
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                      {selectedProfile.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.capabilitiesCount", {
                        count: selectedProfile.capability_count || 0,
                      })}
                    </span>
                    {deriveProfileBadges(selectedProfile, selectedIsDefaultFor).map((badge) => (
                      <span
                        key={badge}
                        title={
                          badge === "roleDefault"
                            ? selectedIsDefaultFor.join(", ")
                            : undefined
                        }
                      >
                        <Badge variant={badge === "roleDefault" ? "verified" : "locked"}>
                          {t(`engineering.permissions.profileBadge_${badge}`)}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded ${
                      selectedProfile.is_active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {selectedProfile.is_active
                      ? t("engineering.permissions.active")
                      : t("engineering.permissions.disabled")}
                  </span>
                  <button
                    onClick={() => duplicateProfile(selectedProfile)}
                    title={t("engineering.permissions.duplicateProfileTitle")}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleProfileActive(selectedProfile)}
                    title={
                      selectedProfile.is_active
                        ? t("engineering.permissions.disableProfile")
                        : t("engineering.permissions.enableProfile")
                    }
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {selectedProfile.is_active ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Rôles attribués — lecture seule, édition via la modale "Modifier" */}
              <div className="ios-card !p-5 border-[var(--border-primary)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      {t("engineering.permissions.rolesAssignedTitle")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                      {t("engineering.permissions.rolesAssignedHint")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDefaultRoleMsg("");
                      setDefaultRoleErr("");
                      setRemoveMsg("");
                      setRemoveErr("");
                      setRolesModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                  >
                    <Pencil className="w-3 h-3" />{" "}
                    {t("engineering.permissions.editRoles")}
                  </button>
                </div>
                {selectedIsDefaultFor.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIsDefaultFor.map((role) => (
                      <span
                        key={role}
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                      >
                        {role.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.defaultForNone")}
                  </p>
                )}
                {selectedIsDefaultFor.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-amber-400">
                      {t("engineering.permissions.profileInUseWarning", {
                        roles: selectedIsDefaultFor.join(", "),
                      })}
                    </p>
                    <p className="text-[10px] font-bold text-amber-400/70">
                      {t("engineering.permissions.profileChangeAffectsUsers")}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-3 space-y-2 shadow-lg">
                {impactTotal !== null && impactTotal > 0 && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    {t("engineering.permissions.impactAffects", { total: impactTotal })}
                  </p>
                )}
                {changesCount > 0 && (
                  <PendingChangesList
                    items={diffCapabilities(savedCaps, draftCaps).map((c) => ({
                      label: c.label,
                      level: c.to,
                    }))}
                  />
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {changesCount > 0
                      ? t("engineering.permissions.changesPending", {
                          count: changesCount,
                        })
                      : t("engineering.permissions.noPendingChanges")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={discardChanges}
                      disabled={changesCount === 0 || saving}
                      className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-40"
                    >
                      {t("engineering.permissions.discardChanges")}
                    </button>
                    <button
                      onClick={saveChanges}
                      disabled={changesCount === 0 || saving}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
                    >
                      {saving
                        ? t("engineering.permissions.saving")
                        : t("engineering.permissions.saveChanges")}
                    </button>
                  </div>
                </div>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("engineering.permissions.reasonPlaceholder")}
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-secondary px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)]"
                />
              </div>

              {selectedIsDefaultFor.length > 0 ? (
                <div className="p-3 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profileEligibilityFilterHint", {
                      roles: selectedIsDefaultFor.join(", "),
                    })}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-secondary/50 border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profileNoRolesHint")}
                  </p>
                </div>
              )}

              {!moduleCatalog && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-[10px] font-bold text-amber-400">
                    {t("engineering.permissions.catalogUnavailable")}
                  </p>
                </div>
              )}

              {moduleCatalog && visibleSections.length === 0 && (
                <div className="py-10 text-center opacity-60">
                  <p className="text-xs font-black text-[var(--text-primary)] uppercase">
                    {t(
                      selectedIsDefaultFor.length === 0
                        ? "engineering.permissions.profileNoRolesEmpty"
                        : "engineering.permissions.profileNoEligibleFeatures",
                    )}
                  </p>
                </div>
              )}

              {moduleCatalog && visibleSections.length > 0 && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("engineering.permissions.viewBaseHint")}
                </p>
              )}

              <div className="space-y-6">
                {visibleSections.map((section) => (
                  <FeatureMatrixSection
                    key={section.feature}
                    section={section}
                    rows={buildSubsectionRows(section.feature, availableModules, moduleToFeature)}
                    availableModules={availableModules}
                    draftCaps={draftCaps}
                    savedCaps={savedCaps}
                    onToggle={toggleDraftCap}
                    onToggleFull={toggleDraftFull}
                  />
                ))}
              </div>

              {/* Non-CRUD capabilities (grant, promote_super_admin, send,
                  publish, execute…) — editable on the same draft + save flow. */}
              <AdvancedCapabilities
                availableModules={availableModules}
                moduleToFeature={moduleToFeature}
                visibleFeatures={visibleFeatures}
                mode="profile"
                stateOf={(module, capability) => ({
                  level: draftCaps?.[module]?.[capability] ?? 0,
                })}
                onToggle={toggleDraftCap}
              />

              {/* C1 — capabilities still STORED but not shown in the matrix
                  above (their feature is no longer eligible for the template's
                  roles, or the module has no dashboard section). They are still
                  granted to everyone who inherits the profile, so the screen
                  never hides them: it lists them and lets the admin remove
                  them, which is what unblocks the save. */}
              {hiddenStoredCaps.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      {t("engineering.permissions.hiddenStoredTitle")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.hiddenStoredHint")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {hiddenStoredCaps.map((entry) => (
                      <div
                        key={entry.module}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        style={{ borderColor: "var(--border-primary)" }}
                      >
                        <span className="min-w-0 text-[10px] text-[var(--text-primary)]">
                          <span className="font-black uppercase tracking-wide">
                            {entry.module.replace(/_/g, " ")}
                          </span>
                          <span className="ml-2 font-medium text-[var(--text-secondary)] opacity-70">
                            {entry.capabilities.join(", ")}
                          </span>
                        </span>
                        <button
                          onClick={() => clearHiddenCaps(entry)}
                          className="shrink-0 px-2 py-1 rounded-lg bg-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-all"
                        >
                          {t("engineering.permissions.hiddenStoredRemove")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ios-card !p-10 border border-[var(--border-primary)] flex flex-col items-center justify-center text-center opacity-60 space-y-2">
              <Layers className="w-10 h-10 text-slate-500" />
              <p className="text-xs font-black text-[var(--text-primary)] uppercase">
                {t("engineering.permissions.selectProfilePromptTitle")}
              </p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                {t("engineering.permissions.selectProfilePrompt")}
              </p>
            </div>
      )}

      {/* Assigned-roles modal — the roles list is read-only until Edit */}
      {rolesModalOpen && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setRolesModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <h4
              className="text-sm font-black uppercase tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {t("engineering.permissions.rolesEditTitle")}
            </h4>
            <p
              className="text-[10px] font-black uppercase tracking-widest mt-4"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("engineering.permissions.defaultForTitle")}
            </p>

            <div className="space-y-1.5 mt-2">
              {selectedIsDefaultFor.length > 0 ? (
                selectedIsDefaultFor.map((role) => (
                  <div
                    key={role}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--border-primary)" }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {role.replace(/_/g, " ")}
                    </span>
                    <button
                      onClick={() => removeRoleDefault(role)}
                      disabled={removeBusy === role}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />{" "}
                      {t("engineering.permissions.rolesRemove")}
                    </button>
                  </div>
                ))
              ) : (
                <p
                  className="text-[10px] font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("engineering.permissions.defaultForNone")}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <select
                value={defaultRoleChoice}
                onChange={(e) => setDefaultRoleChoice(e.target.value)}
                aria-label={t("engineering.permissions.defaultForTitle")}
                className="bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
              >
                <option value="">
                  {t("engineering.permissions.defaultForPick")}
                </option>
                {(allRoles || [])
                  .filter((r) => !selectedIsDefaultFor.includes(r))
                  .map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
              </select>
              <button
                onClick={assignRoleDefault}
                disabled={!defaultRoleChoice || defaultRoleBusy}
                className="px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
              >
                {t("engineering.permissions.rolesAdd")}
              </button>
            </div>

            {defaultRoleMsg && (
              <p className="text-[10px] font-bold text-emerald-400 mt-2">
                {defaultRoleMsg}
              </p>
            )}
            {defaultRoleErr && (
              <p className="text-[10px] font-bold text-red-400 mt-2">
                {defaultRoleErr}
              </p>
            )}
            {removeMsg && (
              <p className="text-[10px] font-bold text-emerald-400 mt-2">
                {removeMsg}
              </p>
            )}
            {removeErr && (
              <p className="text-[10px] font-bold text-red-400 mt-2">
                {removeErr}
              </p>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setRolesModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile-safety confirmation for role-bound profiles */}
      {pendingSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setPendingSaveConfirm(null)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <h4
              className="text-sm font-black uppercase tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {t("engineering.permissions.confirmChanges")}
            </h4>
            <p
              className="text-[10px] font-bold mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("engineering.permissions.profileInUseWarning", {
                roles: pendingSaveConfirm.join(", "),
              })}
            </p>
            <p
              className="text-[10px] font-bold mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("engineering.permissions.profileChangeAffectsUsers")}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setPendingSaveConfirm(null)}
                className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.cancel")}
              </button>
              <button
                onClick={confirmSave}
                className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                {t("engineering.permissions.confirmChanges")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResponsibilitiesView() {
  const { t } = useI18n();
  const [selectedUser, setSelectedUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [responsibilities, setResponsibilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const fetchUsers = async (bypassCache = false) => {
    const url = "/api/contacts";
    const apply = (data) => {
      if (!data.success) return;
      const sorted = (data.contacts || []).sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
      setAllUsers(sorted);
      setSearchResults(sorted);
    };
    try {
      // Cache-first paint: returning to this tab renders the user list
      // instantly from a fresh snapshot; the network refresh below converges.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const selectUser = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(
        `/api/responsibilities/assign?user_cid=${user.cid}`,
      );
      const data = await res.json();
      if (data.success) {
        setResponsibilities(data.responsibilities || []);
      }
    } catch (e) {
      console.error("Failed to fetch responsibilities", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleResponsibility = async (resp) => {
    setActionMsg("");
    setActionError("");
    const action = resp.assigned ? "remove" : "assign";

    // Optimistic update
    setResponsibilities((prev) =>
      prev.map((r) => (r.id === resp.id ? { ...r, assigned: !r.assigned } : r)),
    );

    try {
      const res = await fetch("/api/responsibilities/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_cid: selectedUser.cid,
          responsibility_id: resp.id,
          action,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t(data.message || "") || data.message);
      } else {
        // Revert
        setResponsibilities((prev) =>
          prev.map((r) =>
            r.id === resp.id ? { ...r, assigned: !r.assigned } : r,
          ),
        );
        setActionError(t((data.error || t("engineering.permissions.actionFailed")) || "") || (data.error || t("engineering.permissions.actionFailed")));
      }
    } catch {
      setResponsibilities((prev) =>
        prev.map((r) =>
          r.id === resp.id ? { ...r, assigned: !r.assigned } : r,
        ),
      );
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const searchUsers = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(allUsers);
      return;
    }
    const q = query.toLowerCase();
    setSearchResults(
      allUsers.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.cid || "").toLowerCase().includes(q),
      ),
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.responsibilitiesIntro")}
      </p>

      {/* User Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          value={searchQuery}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder={t("engineering.permissions.responsibilitiesSearchPlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
        />
      </div>

      {/* User List */}
      {!selectedUser && (
        <div className="space-y-1 max-w-md">
          {searchResults.slice(0, 20).map((u) => (
            <button
              key={u.cid}
              onClick={() => selectUser(u)}
              className="w-full ios-card !p-3 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[var(--text-primary)] uppercase">
                    {u.name}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {u.role}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          ))}
          {searchResults.length === 0 && (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
              {t("engineering.permissions.noUsersFound")}
            </p>
          )}
        </div>
      )}

      {/* Selected User Responsibilities */}
      {selectedUser && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setResponsibilities([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.back")}
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--text-primary)] uppercase">
                    {selectedUser.name}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {selectedUser.role} · {selectedUser.email}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {actionMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-400">
                {actionMsg}
              </p>
            </div>
          )}
          {actionError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] font-bold text-red-400">
                {actionError}
              </p>
            </div>
          )}

          {(() => {
            const blockedAssigned = responsibilities.filter(
              (r) =>
                r.assigned &&
                isResponsibilityBlockedForRole(
                  selectedUser.role,
                  r.key,
                  r.allowed_roles,
                ),
            );
            if (blockedAssigned.length === 0) return null;
            return (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("engineering.permissions.responsibilityRoleWarningTitle")}
                </p>
                <p className="text-[10px] font-bold text-amber-400/90 mt-1">
                  {t("engineering.permissions.responsibilityRoleWarningBody", {
                    role: selectedUser.role,
                    features: blockedAssigned.map((r) => r.name).join(", "),
                  })}
                </p>
              </div>
            );
          })()}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {responsibilities.map((resp) => (
                <button
                  key={resp.id}
                  onClick={() => toggleResponsibility(resp)}
                  className={`ios-card !p-4 border transition-all text-left ${
                    resp.assigned
                      ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/5"
                      : "border-[var(--border-primary)] opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Award
                        className={`w-4 h-4 ${
                          resp.assigned
                            ? "text-[var(--brand-orange)]"
                            : "text-slate-500"
                        }`}
                      />
                      <div>
                        <p
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            resp.assigned
                              ? "text-[var(--brand-orange)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {resp.name}
                        </p>
                        {resp.description && (
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                            {resp.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                        resp.assigned
                          ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                          : "border-slate-500"
                      }`}
                    >
                      {resp.assigned && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      )}
                    </div>
                  </div>
                  {isResponsibilityBlockedForRole(
                    selectedUser.role,
                    resp.key,
                    resp.allowed_roles,
                  ) && (
                    <p className="mt-2 flex items-start gap-1 text-[10px] font-bold text-amber-400">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>
                        {t("engineering.permissions.responsibilityRoleWarning", {
                          role: selectedUser.role,
                          feature: resp.name,
                          roles: (normalizeAllowedRoles(resp.allowed_roles) ??
                            defaultAllowedRoles(resp.key) ??
                            []
                          ).join(", "),
                        })}
                      </span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResponsibilityAccessView() {
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
    } catch (e) {
      console.error("Failed to fetch responsibilities", e);
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
      prev.map((r) =>
        r.id === resp.id ? { ...r, allowed_roles: [...allowedRoles] } : r,
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
      ? current.filter((r) => r !== role)
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
          prev.map((r) =>
            r.id === resp.id ? { ...r, allowed_roles: null } : r,
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
                            ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
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
                            ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/40 text-[var(--brand-orange)]"
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

// ─── Eligibility configuration (Phase A — Permissions control center) ───────
// Membership/Identity → Feature → Eligible / Not Eligible / Unset.
// Persisted in feature_eligibility; consumed by the same resolver that
// enforces every API route. Read = permissions.view_matrix; write =
// permissions.configure_eligibility (a dedicated authority, deliberately
// separate from assign_capabilities).

function EligibilityView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [identityType, setIdentityType] = useState("role");
  const [identityValue, setIdentityValue] = useState("");
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("identity"); // identity | matrix
  // C2 — impacted templates reported by a 409 before a downgrade is applied.
  const [pendingImpacts, setPendingImpacts] = useState(null);

  const load = useCallback(async (bypassCache = false) => {
    const url = "/api/engineering/permissions/eligibility";
    const apply = (d) => {
      if (!d.success) return;
      setData(d);
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
      const d = await res.json();
      if (d.success) {
        cacheSet(url, d);
        apply(d);
      } else if (!painted) {
        setErr(t(d.error || "errors.somethingWrong"));
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
        (r) =>
          r.identity_type === identityType &&
          r.identity_value === identityValue,
      );
      const next = {};
      for (const r of rows) next[r.feature_key] = Number(r.eligible);
      setDraft(next);
      setMsg("");
      setErr("");
    });
  }, [identityType, identityValue, data]);

  // Roles the database actually carries that the curated identity list omits
  // (mentor, teacher, developer, program_manager…). They are enforceable
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
    for (const r of data.rows || []) {
      if (
        r.identity_type === identityType &&
        r.identity_value === selected
      ) {
        currentRows[r.feature_key] = Number(r.eligible);
      }
    }
  }

  const hasChanges = (data?.features || []).some((f) => {
    const cur = currentRows[f] ?? null;
    const next = draft[f] ?? null;
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
    for (const f of data.features || []) {
      const cur = currentRows[f] ?? null;
      const next = draft[f] ?? null;
      if (cur !== next) {
        changes.push({
          feature_key: f,
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
      const d = await res.json();
      if (d.success) {
        setData((prev) => ({ ...prev, rows: d.rows }));
        setPendingImpacts(null);
        setMsg(t("engineering.permissions.eligibilitySaved"));
        setTimeout(() => setMsg(""), 2500);
      } else if (res.status === 409 && d.requiresConfirmation) {
        // C2 — the downgrade would strand capabilities that role-default
        // templates still grant. Nothing was persisted: show the impact and let
        // the admin confirm explicitly.
        setPendingImpacts(d.impacts || []);
      } else if (res.status === 403) {
        setErr(t("engineering.permissions.eligibilityNoPermission"));
      } else {
        setErr(t(d.error || "engineering.permissions.eligibilitySaveFailed"));
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
    ...(data?.roles || []).filter((r) => !contextRoles.has(r)),
    ...(data?.extraRoles || []).filter((r) => !contextRoles.has(r)),
  ];
  const isDatabaseRole = (role) => (data?.extraRoles || []).includes(role);

  // One lookup for both presentations (table on md+, cards below) so the two
  // can never disagree about what a cell shows.
  const stateFor = (role, feature) => {
    const row = (data?.rows || []).find(
      (r) =>
        r.identity_type === "role" &&
        r.identity_value === role &&
        r.feature_key === feature,
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
                  {(data.features || []).map((f) => (
                    <th
                      key={f}
                      className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap"
                    >
                      {f}
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
                    {(data.features || []).map((f) => {
                      const state = stateFor(role, f);
                      return (
                        <td key={f} className="px-2 py-1.5 text-center">
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
          <div className="md:hidden divide-y divide-[var(--border-primary)]/50">
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
                  {(data.features || []).map((f) => {
                    const state = stateFor(role, f);
                    return (
                      <button
                        key={f}
                        onClick={() => {
                          setIdentityType("role");
                          setIdentityValue(role);
                          setViewMode("identity");
                        }}
                        title={state.title}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-transparent text-left ${state.className}`}
                      >
                        <span className="block text-[9px] tracking-widest opacity-70">
                          {f}
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

      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20">
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
            onChange={(e) => setIdentityValue(e.target.value)}
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
                {msg && (
                  <span className="text-[10px] font-bold text-emerald-400">
                    {msg}
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
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${dirty ? "bg-[var(--brand-orange)]/5" : ""}`}
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

// ─── Access explanation (Phase 2 — “who has access and why”) ─────────────────
// Renders the resolver's buildPermissionExplanation output: per-feature
// eligibility (with the identity rows that produced it) + the capability
// inputs (Default Access base, group capabilities, individual grants).

function AccessExplanationPanel({ explanation, t }) {
  const [open, setOpen] = useState(false);
  const eligibility = explanation.eligibility || {};
  const sources = explanation.sources || {};
  const hasEligibility = Object.keys(eligibility).length > 0;
  const hasSources =
    (sources.profile && Object.keys(sources.profile).length > 0) ||
    (sources.groups && Object.keys(sources.groups).length > 0) ||
    (sources.grants && Object.keys(sources.grants).length > 0);

  if (!hasEligibility && !hasSources) return null;

  const sourceBlock = (labelKey, data) => {
    const entries = Object.entries(data || {}).filter(
      ([, caps]) => caps && Object.keys(caps).length > 0,
    );
    if (entries.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t(labelKey)}
        </p>
        <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">
          {entries
            .map(([mod, caps]) =>
              `${mod}: ${Object.entries(caps)
                .map(([cap, lvl]) => `${cap}=${lvl}`)
                .join(", ")}`,
            )
            .join(" · ")}
        </p>
      </div>
    );
  };

  return (
    <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-tertiary/30 hover:bg-tertiary/50 transition-all"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("engineering.permissions.explanationTitle")}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3 divide-y divide-[var(--border-primary)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.explanationEligibility")}
            </p>
            {Object.keys(eligibility).length === 0 ? (
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                {t("engineering.permissions.explanationNone")}
              </p>
            ) : (
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(eligibility).map(([feature, info]) => (
                  <div key={feature} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        info.eligible ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        {feature}
                      </p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {info.eligible
                          ? t("engineering.permissions.eligibilityEligible")
                          : t("engineering.permissions.eligibilityNotEligible")}
                        {(info.sources || []).length > 0 &&
                          ` — ${info.sources
                            .map(
                              (s) => `${s.identity_type}:${s.identity_value}${Number(s.eligible) === 0 ? " (deny)" : ""}`,
                            )
                            .join(", ")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.explanationSources")}
            </p>
            {sourceBlock(
              "engineering.permissions.explanationDefaultAccess",
              sources.profile,
            )}
            {sourceBlock(
              "engineering.permissions.explanationGroups",
              sources.groups,
            )}
            {sourceBlock(
              "engineering.permissions.explanationGrants",
              sources.grants,
            )}
            {!hasSources && (
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {t("engineering.permissions.explanationNone")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Phase 7: Permission Audit viewer ───────────────────────────────────── */

const AUDIT_ACTIONS = [
  "granted",
  "revoked",
  "restricted",
  "unrestricted",
  "eligibility_changed",
  "profile_created",
  "profile_updated",
  "profile_deleted",
  "role_default_changed",
  "access_profile_changed",
  "membership_changed",
  "role_changed",
];

const AUDIT_FILTER_DEFAULTS = {
  q: "",
  actor: "",
  target: "",
  action: "",
  module: "",
  capability: "",
  target_cid: "",
  from: "",
  to: "",
};

function AuditView() {
  const { t } = useI18n();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Every filter the audit endpoint supports and the screen exposes. `applied`
  // is what has been SENT (the fetch depends on it), `filters` is what the admin
  // is typing — so a half-typed name never issues a request.
  const [filters, setFilters] = useState(AUDIT_FILTER_DEFAULTS);
  const [applied, setApplied] = useState(AUDIT_FILTER_DEFAULTS);
  const [detail, setDetail] = useState(null);
  // The fetch waits for the URL read below: a ?target_cid= deep link must be
  // part of the FIRST request, not a second one after an unfiltered paint.
  const [ready, setReady] = useState(false);

  // Deep link from the person screen: "show me THIS person's whole history".
  // Deferred (project convention: an effect performs no synchronous state
  // write), and reading the URL is not part of the authorization decision — the
  // server filters and authorizes the same request either way.
  useEffect(() => {
    defer(() => {
      const seeded = { ...AUDIT_FILTER_DEFAULTS };
      try {
        const params = new URLSearchParams(window.location.search);
        for (const key of Object.keys(AUDIT_FILTER_DEFAULTS)) {
          const value = params.get(key);
          if (value) seeded[key] = value;
        }
      } catch {
        /* no deep link — start unfiltered */
      }
      setFilters(seeded);
      setApplied(seeded);
      setReady(true);
    });
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const applyFilters = () => setApplied(filters);

  const clearFilters = () => {
    setFilters({ ...AUDIT_FILTER_DEFAULTS });
    setApplied({ ...AUDIT_FILTER_DEFAULTS });
    setPage(1);
  };

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const [k, v] of Object.entries(applied)) {
      if (v) params.set(k, v);
    }
    const url = `/api/engineering/permissions/audit?${params.toString()}`;
    const apply = (data) => {
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    };
    (async () => {
      setLoading(true);
      setError("");
      let painted = false;
      // Cache-first paint: returning to this page / paging back renders
      // instantly from fresh snapshots keyed by page + applied filters.
      const cached = cacheGet(url);
      if (cached !== null && cached.success) {
        apply(cached);
        setLoading(false);
        painted = true;
      }
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          if (data.success) {
            cacheSet(url, data);
            apply(data);
          } else if (!painted) {
            setError(data.error || "—");
          }
        }
      } catch {
        if (!cancelled && !painted) setError("—");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied, page, pageSize, ready]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const moduleOptions = Object.keys(CAPABILITY_CATALOG).sort();

  const fmtDate = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters: the free-text box searches everything at once; the fields next
          to it answer the narrower, more common questions — who made the change,
          who it was about, which capability, and one person's whole history. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <input
            value={filters.q}
            onChange={(e) => updateFilter("q", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder={t("engineering.permissions.auditSearch")}
            aria-label={t("engineering.permissions.auditSearch")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 transition-all"
          />
        </div>
        <input
          value={filters.actor}
          onChange={(e) => updateFilter("actor", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterActor")}
          aria-label={t("engineering.permissions.auditFilterActor")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        />
        <input
          value={filters.target}
          onChange={(e) => updateFilter("target", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterTarget")}
          aria-label={t("engineering.permissions.auditFilterTarget")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        />
        <input
          value={filters.capability}
          onChange={(e) => updateFilter("capability", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterCapability")}
          aria-label={t("engineering.permissions.auditFilterCapability")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        />
        <select
          value={filters.action}
          onChange={(e) => updateFilter("action", e.target.value)}
          aria-label={t("engineering.permissions.auditFilterActionAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        >
          <option value="">{t("engineering.permissions.auditAllActions")}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={filters.module}
          onChange={(e) => updateFilter("module", e.target.value)}
          aria-label={t("engineering.permissions.auditFilterModuleAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        >
          <option value="">{t("engineering.permissions.auditAllModules")}</option>
          {moduleOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <AuditPersonFilter
          value={filters.target_cid}
          onChange={(cid) => updateFilter("target_cid", cid)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterFrom")}
          </span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterTo")}
          </span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
          />
        </label>
        <button
          onClick={applyFilters}
          className="px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
        >
          {t("engineering.permissions.auditApplyFilters")}
        </button>
        <button
          onClick={clearFilters}
          className="px-4 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
        >
          {t("engineering.permissions.auditClearFilters")}
        </button>
      </div>

      {applied.target_cid && (
        <p className="rounded-xl border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 px-3 py-2 text-[10px] font-bold text-[var(--text-primary)]">
          {t("engineering.permissions.auditFilterPersonActive")}
        </p>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{error}</p>
        </div>
      )}

      <div
        className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
      >
        <div className="px-5 py-3 bg-secondary border-b border-[var(--border-primary)] flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
            {t("engineering.permissions.auditTotal", { total })}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
            {t("engineering.permissions.auditReadOnly")}
          </p>
        </div>
        {loading ? (
          <div className="p-8 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center opacity-50">
            <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">
              {t("engineering.permissions.auditNoResults")}
            </p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditDate")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditActor")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditTarget")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditAction")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditObject")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditChange")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all">
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                      {fmtDate(e.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {e.actor_name || e.actor_cid || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {e.target_name || e.target_cid || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      {e.module ? `${e.module}.${e.capability || "*"}` : e.details ? String(e.details).slice(0, 48) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                      {e.previous_value || e.new_value ? (
                        <span>
                          <span className="text-slate-500 line-through">{e.previous_value || "—"}</span>
                          {" → "}
                          <span className="text-emerald-400">{e.new_value || "—"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setDetail(e)}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.auditViewDetail")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Small screens: one card per record — same fields, same drawer. */}
          <div className="md:hidden divide-y divide-[var(--border-primary)]/50">
            {entries.map((e) => (
              <div key={e.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                    {e.action}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {fmtDate(e.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditActor")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {e.actor_name || e.actor_cid || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditTarget")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {e.target_name || e.target_cid || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditObject")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {e.module
                        ? `${e.module}.${e.capability || "*"}`
                        : e.details
                          ? String(e.details).slice(0, 48)
                          : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditChange")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {e.previous_value || e.new_value ? (
                        <span>
                          <span className="text-slate-500 line-through">
                            {e.previous_value || "—"}
                          </span>
                          {" → "}
                          <span className="text-emerald-400">{e.new_value || "—"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetail(e)}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                >
                  {t("engineering.permissions.auditViewDetail")}
                </button>
              </div>
            ))}
          </div>
          </>
        )}
        {!loading && entries.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--border-primary)]">
            <AppPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Detail drawer — read-only; the audit reason gets its own field */}
      {detail && (
        <WhyDrawer
          title={t("engineering.permissions.auditDetailTitle")}
          onClose={() => setDetail(null)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{detail.action}</Badge>
            {detail.created_at && (
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {fmtDate(detail.created_at)}
              </span>
            )}
          </div>
          {(() => {
            const parsed = splitAuditReason(detail.details);
            return (
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <Field label={t("engineering.permissions.auditActor")} value={detail.actor_name || detail.actor_cid || "—"} />
                <Field label={t("engineering.permissions.auditTarget")} value={detail.target_name || detail.target_cid || "—"} />
                <Field label={t("engineering.permissions.auditObject")} value={detail.module ? `${detail.module}.${detail.capability || "*"}` : "—"} />
                <Field
                  label={t("engineering.permissions.auditChange")}
                  value={
                    detail.previous_value || detail.new_value
                      ? `${detail.previous_value || "—"} → ${detail.new_value || "—"}`
                      : t("engineering.permissions.auditNotAvailable")
                  }
                />
                <div className="col-span-2">
                  <Field
                    label={t("engineering.permissions.auditDetails")}
                    value={parsed.text || t("engineering.permissions.auditNotAvailable")}
                  />
                </div>
                {parsed.reason && (
                  <div className="col-span-2 rounded-lg border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] mb-1">
                      {t("engineering.permissions.auditReason")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)] break-words">
                      {parsed.reason}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </WhyDrawer>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">{label}</p>
      <p className="text-[10px] font-bold text-[var(--text-primary)] break-words">{value}</p>
    </div>
  );
}

/* ─── Phase 7: Governance overview ───────────────────────────────────────── */

/*
 * Memberships (formerly the "Governance" / "Advanced" door). Exported because
 * Phase 2 retired that door: the screen now lives under Context & Scope, next
 * to the context-role registry it reads its data from. Exported rather than
 * moved to keep this change reviewable — a file move is a Phase 3 cleanup.
 */
export function GovernanceView() {
  const { t } = useI18n();
  const [memberships, setMemberships] = useState(null);
  const [protectedMap, setProtectedMap] = useState({});
  const [recent, setRecent] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const urls = [
      "/api/org-membership",
      "/api/engineering/permissions/audit?pageSize=10",
      "/api/access-profiles",
    ];
    const apply = (memData, audData, profData) => {
      if (cancelled) return;
      if (memData.success) {
        setMemberships(memData.memberships || []);
        setProtectedMap(memData.protected || {});
      }
      if (audData.success) setRecent(audData.entries || []);
      if (profData.success) setRoleDefaults(profData.roleDefaults || {});
    };
    (async () => {
      try {
        // Cache-first paint: returning to this tab renders instantly from
        // fresh snapshots; the network refresh below converges.
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1], cached[2]);
          setLoading(false);
        }
        const [memRes, audRes, profRes] = await Promise.all([
          fetch(urls[0]),
          fetch(urls[1]),
          fetch(urls[2]),
        ]);
        const memData = await memRes.json();
        const audData = await audRes.json();
        const profData = await profRes.json();
        if (!cancelled) {
          if (memData.success) cacheSet(urls[0], memData);
          if (audData.success) cacheSet(urls[1], audData);
          if (profData.success) cacheSet(urls[2], profData);
          apply(memData, audData, profData);
        }
      } catch {
        /* informational view — degrade gracefully */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fs = (memberships || []).filter((m) => m.group_name === "FUTURE STUDIO");
  const stats = { active: 0, expiringSoon: 0, expired: 0, ended: 0 };
  for (const m of fs) {
    const s = deriveMembershipStatus(m);
    stats[s] = (stats[s] || 0) + 1;
  }

  const protectedGroups = Object.entries(protectedMap)
    .filter(([, p]) => p)
    .map(([name]) => name);
  const defaultProfiles = Object.entries(roleDefaults).map(([role, v]) => ({
    role,
    profileName: v?.profileName || v?.profileId,
  }));

  const statCard = (label, value, tone) => (
    <StatCard label={label} value={value} tone={tone} />
  );

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.governanceIntro")}
      </p>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface-3)" }} />
          ))}
        </div>
      ) : (
        <>
          {/* Membership status — FUTURE STUDIO */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.governanceMembership")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {statCard(t("engineering.permissions.governanceActive"), stats.active, "success")}
              {statCard(t("engineering.permissions.governanceExpiringSoon"), stats.expiringSoon, "warning")}
              {statCard(t("engineering.permissions.governanceExpired"), stats.expired, "denied")}
              {statCard(t("engineering.permissions.governanceEnded"), stats.ended, "neutral")}
            </div>
          </div>

          {/* Recent permission changes */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.governanceRecent")}
            </h3>
            {recent.length === 0 ? (
              <div
                className="rounded-xl p-4 text-[10px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px dashed var(--border-primary)",
                  color: "var(--text-tertiary)",
                }}
              >
                {t("engineering.permissions.governanceNoRecent")}
              </div>
            ) : (
              <div
                className="rounded-xl divide-y overflow-hidden"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              >
                {recent.map((e) => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                        {e.actor_name || e.actor_cid} → {e.target_name || e.target_cid}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="neutral">{e.action}</Badge>
                        {e.module && (
                          <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                            {e.module}.{e.capability || "*"}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString("en-GB") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Protected configuration */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.governanceProtected")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  {t("engineering.permissions.governanceProtectedGroups")}
                </p>
                {protectedGroups.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-tertiary)]">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {protectedGroups.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  {t("engineering.permissions.governanceDefaultProfiles")}
                </p>
                {defaultProfiles.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-tertiary)]">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {defaultProfiles.map((p) => (
                      <span
                        key={p.role}
                        className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-teal-500/10 text-teal-400"
                      >
                        {p.role} → {p.profileName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Phase 7: "Why this access?" per-capability explanation ────────────── */

function CapabilityWhyModal({ userPerms, module, capability, t, lang, onClose }) {
  const [memberships, setMemberships] = useState(null);
  const cid = userPerms?.user?.cid;

  useEffect(() => {
    if (!cid) return;
    let cancelled = false;
    fetch(`/api/org-membership?user_cid=${encodeURIComponent(cid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.success) setMemberships(d.memberships || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cid]);

  if (!userPerms) return null;

  const user = userPerms.user || {};
  const feature = userPerms.moduleToFeature?.[module] || module;
  const eligibility = userPerms.explanation?.eligibility?.[feature] || { eligible: false, sources: [] };
  const sources = userPerms.explanation?.sources || {};
  const baseLevel = sources.profile?.[module]?.[capability] || 0;
  const groupLevel = sources.groups?.[module]?.[capability] || 0;
  const grant = (userPerms.individualGrants || []).find((g) => g.module === module && g.capability === capability);
  const restriction = (userPerms.individualRestrictions || []).find(
    (r) => r.module === module && r.capability === capability,
  );
  const effective = userPerms.effectivePermissions?.[module]?.[capability] || 0;
  const allowed = effective > 0;
  const profile = userPerms.effectiveProfile;

  const levelLabel = (lvl) =>
    t(ACCESS_LEVEL_KEYS[lvl] || "engineering.permissions.accessLevelNone");

  const fmtDate = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const memberRows = memberships || [];
  const activeMembers = memberRows.filter((m) =>
    ["active", "expiringSoon"].includes(deriveMembershipStatus(m)),
  );
  const inactiveMembers = memberRows.filter((m) =>
    ["expired", "ended"].includes(deriveMembershipStatus(m)),
  );

  const row = (label, value, toneClass) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] shrink-0">
        {label}
      </span>
      <span
        className={`text-[10px] font-bold text-right ${toneClass || "text-[var(--text-primary)]"}`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
              {capabilityLabel(module, capability)}
            </h4>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
              {module}.{capability} — {feature}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                allowed ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}
            >
              {allowed ? t("engineering.permissions.whyAllowed") : t("engineering.permissions.whyDenied")}
            </span>
            <button onClick={onClose} className="p-2 hover:bg-tertiary rounded-lg transition-all">
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-primary)]">
          {/* Identity */}
          <div className="py-2">
            {row(t("engineering.permissions.whyIdentity"), user.role || "—")}
            {(userPerms.groups || []).map((g) => row(t("engineering.permissions.whyMembership"), g))}
          </div>

          {/* Eligibility */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyEligibility"),
              eligibility.eligible
                ? t("engineering.permissions.whyEligibleFor", { identity: user.role || "—", feature })
                : t("engineering.permissions.whyNotEligible"),
              eligibility.eligible ? "text-emerald-400" : "text-red-400",
            )}
            {(eligibility.sources || []).length > 0 && (
              <p className="text-[10px] font-bold text-[var(--text-tertiary)] text-right">
                {eligibility.sources
                  .map((s) => `${s.identity_type}:${s.identity_value}${Number(s.eligible) === 0 ? " (deny)" : ""}`)
                  .join(", ")}
              </p>
            )}
          </div>

          {/* Membership contribution */}
          <div className="py-2">
            {activeMembers.length === 0 && inactiveMembers.length === 0 ? (
              row(t("engineering.permissions.whyMembership"), "—")
            ) : (
              <>
                {activeMembers.map((m) => (
                  <div key={`${m.user_cid}|${m.group_name}`} className="text-right mb-1">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {m.group_name}{" "}
                      <span className="text-emerald-400">
                        {t("engineering.permissions.whyMembershipActive")}
                      </span>
                    </span>
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
                      {t("engineering.permissions.whyExpires")}: {m.expires_at ? fmtDate(m.expires_at) : t("membership.status.never")}
                    </p>
                  </div>
                ))}
                {inactiveMembers.map((m) => (
                  <div key={`${m.user_cid}|${m.group_name}`} className="text-right mb-1">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {m.group_name}{" "}
                      <span className="text-red-400">
                        {t("engineering.permissions.whyMembershipExpired")}
                      </span>
                    </span>
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
                      {t("engineering.permissions.whyMembershipNotContributing")}
                    </p>
                  </div>
                ))}
                {inactiveMembers.length > 0 && (
                  <p className="text-[10px] font-bold text-right mt-1" style={{ color: "var(--text-tertiary)" }}>
                    {t("engineering.permissions.whyAccountIntact")}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Default Access */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyDefaultAccess"),
              profile?.profileName
                ? `${profile.profileName} (${profile.source === "user" ? t("engineering.permissions.whySourceIndividual") : t("engineering.permissions.whySourceRole")})`
                : "—",
            )}
            {row(
              t("engineering.permissions.whyProfileCapability"),
              baseLevel > 0 ? levelLabel(baseLevel) : t("engineering.permissions.whyNone"),
            )}
          </div>

          {/* Group capabilities */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyGroupCapabilities"),
              groupLevel > 0 ? levelLabel(groupLevel) : t("engineering.permissions.whyNone"),
            )}
          </div>

          {/* Individual grant */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyIndividualGrant"),
              grant ? `${levelLabel(Number(grant.access_level))}` : t("engineering.permissions.whyNone"),
            )}
          </div>

          {/* Restriction — strongest block */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyRestriction"),
              restriction ? t("engineering.permissions.whyRestricted") : t("engineering.permissions.whyNone"),
              restriction ? "text-red-400" : undefined,
            )}
            {restriction && (
              <p className="text-[10px] font-bold text-right text-red-400">
                {t("engineering.permissions.whyRestrictionPrecedence")}
              </p>
            )}
          </div>

          {/* Context / Assignment — deferred layer */}
          <div className="py-2">
            {row(t("engineering.permissions.whyContext"), t("engineering.permissions.whyContextPlaceholder"))}
          </div>

          {/* Final result */}
          <div className="py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t("engineering.permissions.whyFinal")}
              </span>
              <span
                className={`text-[11px] font-black uppercase ${
                  allowed ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {allowed
                  ? `${t("engineering.permissions.whyAllowed")} (${levelLabel(effective)})`
                  : t("engineering.permissions.whyDenied")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
