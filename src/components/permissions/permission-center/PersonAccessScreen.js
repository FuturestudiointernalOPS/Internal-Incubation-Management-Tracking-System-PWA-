/**
 * PERSON ACCESS SCREEN (write lens).
 *
 * The individual-access editor: pick a person, see their effective rights and
 * edit the base layer (profile override), the CRUD grid and the exceptions
 * block. It was the `search` view inside `PermissionCenter.js`; the shell now
 * only routes to it. State, loaders, writes and markup are unchanged — this is
 * a same-layer move, so nothing crosses a layer boundary.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLatestGuard, defer } from "@/components/permissions/effectUtils";
import { CRUD_CAPABILITIES, crudCapabilities, deriveUserCapState, describeCapOrigins, eligibleFeaturesForPerson, groupModulesByFeature, isPersonEligibleForFeature } from "@/components/permissions/matrixHelpers";
import PersonAccessView from "@/components/permissions/permission-center/person-access/PersonAccessView";
import buildEditableModules from "@/components/permissions/permission-center/shared/buildEditableModules";
import applyOptimisticQuickAction from "@/components/permissions/permission-center/shared/applyOptimisticQuickAction";
import { riskyChanges } from "@/components/permissions/riskGate";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { FEATURE_ORDER } from "@/models/authorization/eligibility-defaults";


export default function PersonAccessScreen({ cid = null }) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
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
    const newPerms = applyOptimisticQuickAction(
      userPerms,
      action,
      module,
      capability,
      level,
    );

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

  // Everything the view renders, handed over whole so the markup can move out
  // of this file without the editor losing a single value or handler.
  const ctx = {
    actionError,
    actionMsg,
    applyQuickAction,
    assignBusy,
    assignErr,
    assignMsg,
    assignProfileId,
    assignProfiles,
    availableModules,
    exceptionSpecialCaps,
    expandedModules,
    featureLabel,
    fetchModules,
    getEffectiveLevel,
    getOrigin,
    handleQuickAction,
    ineligibleSectionCount,
    lang,
    loadAssignProfiles,
    loadError,
    loadingPerms,
    moduleSections,
    moduleToFeature,
    modulesError,
    originText,
    originsOf,
    personFeatures,
    riskGate,
    saveProfileOverride,
    selectUser,
    selectedUser,
    setActionError,
    setActionMsg,
    setAssignProfileId,
    setExpandedModules,
    setRiskGate,
    setShowAssignForm,
    setWhyTarget,
    showAssignForm,
    t,
    userPerms,
    whyTarget,
  };

  return <PersonAccessView ctx={ctx} />;
}

