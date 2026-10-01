"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import AuditPersonFilter from "@/components/permissions/AuditPersonFilter";
import RiskConfirmDialog from "@/components/permissions/RiskConfirmDialog";
import { splitAuditReason } from "@/components/permissions/auditHelpers";
import { createLatestGuard, defer } from "@/components/permissions/effectUtils";
import { ACCESS_LEVEL_KEYS, ACCESS_SHORT, LEVELS_ORDER, LEVEL_CHIP_ACTIVE, LEVEL_CHIP_BASE, LEVEL_CHIP_IDLE, LEVEL_CHIP_INHERITED } from "@/components/permissions/levelChips";
import { CRUD_CAPABILITIES, crudCapabilities, deriveUserCapState, describeCapOrigins, eligibleFeaturesForPerson, groupModulesByFeature, isPersonEligibleForFeature } from "@/components/permissions/matrixHelpers";
import AccessExplanationPanel from "@/components/permissions/permission-center/AccessExplanationPanel";
import AccessProfilesView from "@/components/permissions/permission-center/AccessProfilesView";
import CapabilityWhyModal from "@/components/permissions/permission-center/CapabilityWhyModal";
import EligibilityView from "@/components/permissions/permission-center/EligibilityView";
import ResponsibilitiesView from "@/components/permissions/permission-center/ResponsibilitiesView";
import ResponsibilityAccessView from "@/components/permissions/permission-center/ResponsibilityAccessView";
import buildEditableModules from "@/components/permissions/permission-center/shared/buildEditableModules";
import { riskyChanges } from "@/components/permissions/riskGate";
import Badge from "@/components/permissions/ui/Badge";
import StatCard from "@/components/permissions/ui/StatCard";
import WhyDrawer from "@/components/permissions/ui/WhyDrawer";
import AppPagination from "@/components/ui/AppPagination";
import { useDialogs } from "@/components/ui/DialogProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { CAPABILITY_CATALOG, capabilityLabel } from "@/lib/authorization/capability-catalog";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { deriveMembershipStatus } from "@/lib/membership-ui";
import { FEATURE_ORDER } from "@/models/authorization/eligibility-defaults";
import { Ban, ChevronDown, ChevronRight, Clock, Info, RefreshCw, RotateCcw, Shield, Trash2 } from "lucide-react";

export default function PermissionManager({
  initialTab = "search",
  initialProfileId = null,
  cid = null,
}) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
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
    } catch (error) {
      console.error("Failed to fetch modules", error);
      // The catalogue is what the grid is built from: without it there is no
      // section and no right to show, so the failure is stated where the grid
      // would be instead of looking like an empty screen.
      setModulesError(
        error?.message || t("engineering.permissions.catalogLoadFailed"),
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
            (module) => crudCapabilities(availableModules[module]?.capabilities || []).length > 0,
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
    } catch (error) {
      console.error("Failed to fetch user permissions", error);
      if (!personLoad.current.isCurrent(token)) return;
      setLoadError(
        error?.message || t("engineering.permissions.personAccessLoadFailed"),
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
    } catch (error) {
      console.error("Failed to load profiles", error);
    }
  };

  /**
   * Assign or remove the selected user's profile override (empty = remove).
   *
   * Assigning a profile REPLACES the person's base capabilities — the resolver
   * reads access_profile_capabilities INSTEAD OF role_capabilities — so a
   * thinner (or empty) profile silently removes access. The server answers 409
   * with the exact diff; we show it and only re-send with `confirm` once the
   * admin accepts the loss.
   */
  const saveProfileOverride = async (profileId, options = {}) => {
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
          ...(options.confirm ? { confirm: true } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignMsg(t(data.message || "") || data.message);
        setShowAssignForm(false);
        setAssignProfileId("");
        selectUser(selectedUser); // refresh the effective profile + matrix
      } else if (res.status === 409 && data.requiresConfirmation) {
        const loss = data.loss || {};
        const removedList = loss.removed || [];
        const accepted = await confirm({
          title: t("engineering.permissions.assignImpactTitle"),
          message: t(
            data.error === "profile_assignment_empty_profile"
              ? "engineering.permissions.assignEmptyProfileConfirm"
              : "engineering.permissions.assignLossConfirm",
            {
              name: loss.newProfileName || "",
              current: loss.currentCount ?? 0,
              removed: loss.removedCount ?? 0,
              gained: loss.gainedCount ?? 0,
            },
          ),
          // The hint renders as ONE quieter line (DialogProvider collapses the
          // rest of the message), so the loss is listed inline rather than
          // stacked — the dialog stays readable at any width.
          hint: [
            t("engineering.permissions.assignLossHint"),
            removedList
              .slice(0, 6)
              .map((row) => `${row.module}.${row.capability}`)
              .join(", "),
            removedList.length > 6
              ? t("engineering.permissions.assignLossMore", {
                  count: removedList.length - 6,
                })
              : "",
          ]
            .filter(Boolean)
            .join(" "),
          tone: "danger",
          confirmLabel: t("common.continue"),
          cancelLabel: t("common.cancel"),
        });
        if (!accepted) {
          setAssignErr(t("engineering.permissions.assignCancelled"));
          return;
        }
        return await saveProfileOverride(profileId, { confirm: true });
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
        (restriction) => restriction.module === module && restriction.capability === capability,
      )
    )
      return "restricted";
    if (grants.some((grant) => grant.module === module && grant.capability === capability))
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
      const existingIndex = existing.findIndex(
        (grant) => grant.module === module && grant.capability === capability,
      );
      if (existingIndex >= 0) {
        existing[existingIndex].access_level = level;
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
      ).filter((restriction) => !(restriction.module === module && restriction.capability === capability));
    }

    if (action === "revoke") {
      newPerms.individualGrants = (newPerms.individualGrants || []).filter(
        (grant) => !(grant.module === module && grant.capability === capability),
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
          (restriction) => restriction.module === module && restriction.capability === capability,
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
      ).filter((restriction) => !(restriction.module === module && restriction.capability === capability));
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
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
                          onChange={(event) => setAssignProfileId(event.target.value)}
                          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 transition-all"
                        >
                          <option value="">
                            {t("engineering.permissions.selectProfile")}
                          </option>
                          {assignProfiles
                            .filter((profile) => profile.is_active)
                            .map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
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
                                            className="group border-b border-divider/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
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
    for (const [key, value] of Object.entries(applied)) {
      if (value) params.set(key, value);
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

  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
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
            onChange={(event) => updateFilter("q", event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && applyFilters()}
            placeholder={t("engineering.permissions.auditSearch")}
            aria-label={t("engineering.permissions.auditSearch")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40 transition-all"
          />
        </div>
        <input
          value={filters.actor}
          onChange={(event) => updateFilter("actor", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterActor")}
          aria-label={t("engineering.permissions.auditFilterActor")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <input
          value={filters.target}
          onChange={(event) => updateFilter("target", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterTarget")}
          aria-label={t("engineering.permissions.auditFilterTarget")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <input
          value={filters.capability}
          onChange={(event) => updateFilter("capability", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterCapability")}
          aria-label={t("engineering.permissions.auditFilterCapability")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <select
          value={filters.action}
          onChange={(event) => updateFilter("action", event.target.value)}
          aria-label={t("engineering.permissions.auditFilterActionAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.auditAllActions")}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <select
          value={filters.module}
          onChange={(event) => updateFilter("module", event.target.value)}
          aria-label={t("engineering.permissions.auditFilterModuleAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.auditAllModules")}</option>
          {moduleOptions.map((module) => (
            <option key={module} value={module}>
              {module}
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
            onChange={(event) => updateFilter("from", event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterTo")}
          </span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter("to", event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          />
        </label>
        <button
          onClick={applyFilters}
          className="px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {t("engineering.permissions.auditApplyFilters")}
        </button>
        <button
          onClick={clearFilters}
          className="px-4 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {t("engineering.permissions.auditClearFilters")}
        </button>
      </div>

      {applied.target_cid && (
        <p className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-3 py-2 text-[10px] font-bold text-[var(--text-primary)]">
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
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
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
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-divider/50 last:border-b-0 hover:bg-tertiary/20 transition-all">
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                      {fmtDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.actor_name || entry.actor_cid || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.target_name || entry.target_cid || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      {entry.module ? `${entry.module}.${entry.capability || "*"}` : entry.details ? String(entry.details).slice(0, 48) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                      {entry.previous_value || entry.new_value ? (
                        <span>
                          <span className="text-slate-500 line-through">{entry.previous_value || "—"}</span>
                          {" → "}
                          <span className="text-emerald-400">{entry.new_value || "—"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setDetail(entry)}
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
          <div className="md:hidden divide-y divide-divider/50">
            {entries.map((entry) => (
              <div key={entry.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                    {entry.action}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {fmtDate(entry.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditActor")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.actor_name || entry.actor_cid || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditTarget")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.target_name || entry.target_cid || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditObject")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {entry.module
                        ? `${entry.module}.${entry.capability || "*"}`
                        : entry.details
                          ? String(entry.details).slice(0, 48)
                          : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditChange")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {entry.previous_value || entry.new_value ? (
                        <span>
                          <span className="text-slate-500 line-through">
                            {entry.previous_value || "—"}
                          </span>
                          {" → "}
                          <span className="text-emerald-400">{entry.new_value || "—"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetail(entry)}
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
                  <div className="col-span-2 rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-3">
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
        const cached = urls.map((url) => cacheGet(url));
        if (cached.every((cachedEntry) => cachedEntry !== null && cachedEntry.success)) {
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

  const futureStudioMemberships = (memberships || []).filter((membership) => membership.group_name === "FUTURE STUDIO");
  const stats = { active: 0, expiringSoon: 0, expired: 0, ended: 0 };
  for (const membership of futureStudioMemberships) {
    const status = deriveMembershipStatus(membership);
    stats[status] = (stats[status] || 0) + 1;
  }

  const protectedGroups = Object.entries(protectedMap)
    .filter(([, isProtected]) => isProtected)
    .map(([name]) => name);
  const defaultProfiles = Object.entries(roleDefaults).map(([role, defaultsEntry]) => ({
    role,
    profileName: defaultsEntry?.profileName || defaultsEntry?.profileId,
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
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface-3)" }} />
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
                {recent.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                        {entry.actor_name || entry.actor_cid} → {entry.target_name || entry.target_cid}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="neutral">{entry.action}</Badge>
                        {entry.module && (
                          <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                            {entry.module}.{entry.capability || "*"}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] whitespace-nowrap">
                      {entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-GB") : "—"}
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
                    {protectedGroups.map((group) => (
                      <span
                        key={group}
                        className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400"
                      >
                        {group}
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
                    {defaultProfiles.map((profile) => (
                      <span
                        key={profile.role}
                        className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-teal-500/10 text-teal-400"
                      >
                        {profile.role} → {profile.profileName}
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
