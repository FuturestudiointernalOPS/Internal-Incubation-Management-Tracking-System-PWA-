"use client";

"use client";

"use client";

/**
 * ACCESS PROFILES VIEW — extracted from `PermissionCenter.js`.
 *
 * The profile editor: build the whole module catalogue, narrow it ONLY when the
 * profile is role-bound, and let a role-less profile fall through to every
 * section. That distinction is the whole point of the screen — the original
 * defect applied `filterSectionsByRoleEligibility` unconditionally, which
 * returned `[]` for a profile with no role, so a role-less profile looked empty.
 * A role binding must constrain the editor, never gate it.
 *
 * Also hosts the impact preview (the real `/impact` endpoint, never a client-side
 * guess), the role-default editor, and `PendingChangesList`.
 *
 * `buildEditableModules` is NOT here: the shell and this view both consume it,
 * so it went to `../shared/`. `capsToObject` IS here, because `selectProfile`
 * memoises its own identity and a helper rebuilt per render would defeat it.
 *
 * Split out verbatim, behaviour identical. The extraction asserts that all seven
 * original defects the UI guards forbid are still absent, and that the audit
 * ACTION vocabulary following in the shim stays with `AuditView`.
 */

import { useCallback, useEffect, useState } from "react";
import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import FeatureMatrixSection from "@/components/permissions/FeatureMatrixSection";
import { defer } from "@/components/permissions/effectUtils";
import { buildSubsectionRows, collectHiddenStoredCaps, filterSectionsByRoleEligibility, groupModulesByFeature, toggleCapability, toggleFullCapabilities } from "@/components/permissions/matrixHelpers";
import { diffCapabilities } from "@/components/permissions/pendingChanges";
import { deriveProfileBadges } from "@/components/permissions/profileBadges";
import Badge from "@/components/permissions/ui/Badge";
import PendingChangesList from "@/components/permissions/ui/PendingChangesList";
import { useDialogs } from "@/components/ui/DialogProvider";
import { moduleCapabilityParents } from "@/models/authorization/capability-catalog";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { Copy, Eye, EyeOff, Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import buildEditableModules from "@/components/permissions/permission-center/shared/buildEditableModules";
import ProfileRoleDefaultsModal from "@/components/permissions/permission-center/ProfileRoleDefaultsModal";
import ProfileSaveConfirmModal from "@/components/permissions/permission-center/ProfileSaveConfirmModal";

/**
 * The capability rows a profile carries, keyed by module then capability. Pure,
 * so it lives at module scope: `selectProfile` memoises its own identity, and a
 * helper captured from the component body would change on every render and
 * defeat that memoisation.
 */
function capsToObject(rows) {
  const capsByModule = {};
  for (const row of rows || []) {
    capsByModule[row.module] ??= {};
    capsByModule[row.module][row.capability] = Number(row.access_level);
  }
  return capsByModule;
}

export default function AccessProfilesView({ initialProfileId = null }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [profiles, setProfiles] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [allRoles, setAllRoles] = useState([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
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
  // Context-role bindings are mappings, not people, so they are reported
  // separately: a profile can read "0 people" and still be live through
  // context_role_profiles (e.g. Assigned Program Manager → program:program_manager).
  const [impactContextBindings, setImpactContextBindings] = useState(null);
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
        // The curated identity list is only PART of the vocabulary the engine
        // enforces: roles that exist in this database but not in that list
        // (program_manager, teacher, mentor…) are served separately as
        // `extraRoles`. Merge them, otherwise those roles cannot be re-bound to
        // a profile from this screen even though the engine honours them.
        const mergedRoles = [
          ...new Set([
            ...(eligData.roles || []),
            ...(eligData.extraRoles || []),
          ]),
        ];
        setAllRoles(
          mergedRoles.length > 0 ? mergedRoles : Object.keys(data.roleDefaults || {}),
        );
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
        const cached = urls.map((url) => cacheGet(url));
        if (cached.every((cachedEntry) => cachedEntry !== null && cachedEntry.success)) {
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
    } catch (error) {
      console.error("Failed to load profiles", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    defer(() => fetchProfiles());
  }, [fetchProfiles]);

  // Identity is fixed, so the deep-link effect below can list it as a dependency
  // without re-running on every render: it writes state only through the stable
  // setters and reads the module-scope helper above.
  const selectProfile = useCallback(async (profile) => {
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
    } catch (error) {
      console.error("Failed to load profile capabilities", error);
    }
  }, []);

  // Picker → selection + deep link. `replaceState` keeps the URL shareable
  // (?profile=<id>) without importing next/navigation into this file.
  const handleProfilePick = (event) => {
    const id = event.target.value;
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
    const profile = profiles.find((profile) => String(profile.id) === String(id));
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
    const hit = profiles.find((profile) => String(profile.id) === String(initialProfileId));
    // Deferred: the mount effect must not perform a synchronous state update.
    if (hit) defer(() => selectProfile(hit));
  }, [initialProfileId, profiles, selectedProfile, selectProfile]);

  // UI-2c — impact preview for the selected profile (how many users resolve to
  // it today). Read-only, fail-soft: no number is better than a wrong number.
  useEffect(() => {
    if (!selectedProfile?.id) {
      defer(() => {
        setImpactTotal(null);
        setImpactContextBindings(null);
      });
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/engineering/permissions/impact?profile_id=${encodeURIComponent(selectedProfile.id)}`,
        );
        const data = await res.json();
        if (!alive) return;
        setImpactTotal(data.success ? Number(data.impact?.total || 0) : null);
        setImpactContextBindings(
          data.success ? Number(data.impact?.contextBindings || 0) : null,
        );
      } catch {
        if (alive) {
          setImpactTotal(null);
          setImpactContextBindings(null);
        }
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
      for (const capability of data.capabilities) {
        if (!caps[capability.module]) caps[capability.module] = {};
        caps[capability.module][capability.capability] = capability.access_level;
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

  /**
   * What a refused delete means, in a sentence the admin can act on. The server
   * owns the decision (assigned people, role defaults, context mappings) and
   * answers with the counts; this only renders them.
   */
  const describeDeleteBlock = (data) => {
    if (data?.error === "profile_in_use_assignments") {
      return t("engineering.permissions.deleteBlockedAssigned", {
        count: data.assignedCount ?? 0,
        names: (data.assignedNames || []).join(", "),
      });
    }
    if (data?.error === "profile_in_use_context") {
      return t("engineering.permissions.deleteBlockedContext", {
        count: data.contextCount ?? 0,
        roles: (data.contextRoles || []).join(", "),
      });
    }
    if (data?.error === "profile_in_use_role_default") {
      return t("engineering.permissions.deleteBlockedRoleDefault", {
        roles: (data.roles || []).join(", "),
      });
    }
    return (
      t((data?.error || t("engineering.permissions.failedToDeleteProfile")) || "") ||
      data?.message ||
      data?.error ||
      t("engineering.permissions.failedToDeleteProfile")
    );
  };

  // A profile still carried by anyone must not be deleted — the server blocks it
  // and explains why. Deleting is offered here, but never decided here.
  const deleteProfile = async (profile) => {
    if (!profile?.id || deleteBusy) return;
    setActionMsg("");
    setActionError("");
    const accepted = await confirm({
      title: t("engineering.permissions.deleteProfileTitle"),
      message: t("engineering.permissions.deleteProfileConfirm", {
        name: profile.name,
      }),
      hint:
        impactTotal !== null && impactTotal > 0
          ? t("engineering.permissions.deleteProfileImpactHint", { total: impactTotal })
          : undefined,
      tone: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/access-profiles?id=${encodeURIComponent(profile.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        setActionMsg(
          t("engineering.permissions.profileDeleted", { name: profile.name }),
        );
        setSelectedProfile(null);
        fetchProfiles(true);
      } else {
        setActionError(describeDeleteBlock(data));
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    } finally {
      setDeleteBusy(false);
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
      .filter(([, defaultsEntry]) => defaultsEntry.profileId === profileId)
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
  // header row).
  //
  // Unmapped modules (modules with no feature — e.g. org_membership) are NOT
  // features and are dropped: the template only ever shows dashboard sections.
  const allSections = groupModulesByFeature(
    availableModules,
    moduleToFeature,
    featureKeys,
  ).filter((section) => !section.unmapped);

  // A profile is configurable ON ITS OWN. It does not have to be a role's
  // default to be edited (see docs/ACCESS_PROFILE_CLEANUP.md). Only a profile
  // that IS bound as a role default is narrowed to those roles' eligibility —
  // that is the ceiling the resolver enforces for the people who inherit it
  // that way. A standalone profile shows the whole catalogue; its ceiling is
  // still enforced where it actually binds, at assignment time
  // (assertTemplateCapsEligible in /api/access-profiles/assign).
  const eligibleSections =
    selectedIsDefaultFor.length > 0
      ? filterSectionsByRoleEligibility(
          allSections,
          selectedIsDefaultFor,
          isRoleEligibleForFeature,
        )
      : allSections;

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
                  (violation) => `${violation.module}.${violation.capability} → ${violation.feature}`,
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
                  onChange={(event) =>
                    setNewProfile({ ...newProfile, name: event.target.value })
                  }
                  placeholder={t("engineering.permissions.profileNamePlaceholder")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 transition-all"
                />
                <input
                  value={newProfile.description}
                  onChange={(event) =>
                    setNewProfile({ ...newProfile, description: event.target.value })
                  }
                  placeholder={t("engineering.permissions.descriptionOptional")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 transition-all"
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
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
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
                        onChange={(event) => setRenameValue(event.target.value)}
                        placeholder={t("engineering.permissions.renamePlaceholder")}
                        className="w-56 bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
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
                  <button
                    onClick={() => deleteProfile(selectedProfile)}
                    disabled={deleteBusy}
                    title={t("engineering.permissions.deleteProfileTitle")}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-red-400 disabled:opacity-40"
                  >
                    {deleteBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
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
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
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
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-brand-orange/10 text-[var(--brand-orange)]"
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
                {impactTotal !== null && (
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest ${
                      impactTotal > 0
                        ? "text-[var(--brand-orange)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {t("engineering.permissions.impactAffects", { total: impactTotal })}
                  </p>
                )}
                {impactContextBindings !== null && impactContextBindings > 0 && (
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.impactContextBindings", {
                      count: impactContextBindings,
                    })}
                  </p>
                )}
                {changesCount > 0 && (
                  <PendingChangesList
                    items={diffCapabilities(savedCaps, draftCaps).map((change) => ({
                      label: change.label,
                      level: change.to,
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
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("engineering.permissions.reasonPlaceholder")}
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-secondary px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)]"
                />
              </div>

              {selectedIsDefaultFor.length > 0 ? (
                <div className="p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/20">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profileEligibilityFilterHint", {
                      roles: selectedIsDefaultFor.join(", "),
                    })}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-secondary/50 border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profileStandaloneHint")}
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
                        ? "engineering.permissions.profileNoConfigurableFeatures"
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
        <ProfileRoleDefaultsModal
          t={t}
          selectedIsDefaultFor={selectedIsDefaultFor}
          removeRoleDefault={removeRoleDefault}
          removeBusy={removeBusy}
          defaultRoleChoice={defaultRoleChoice}
          setDefaultRoleChoice={setDefaultRoleChoice}
          allRoles={allRoles}
          assignRoleDefault={assignRoleDefault}
          defaultRoleBusy={defaultRoleBusy}
          defaultRoleMsg={defaultRoleMsg}
          defaultRoleErr={defaultRoleErr}
          removeMsg={removeMsg}
          removeErr={removeErr}
          onClose={() => setRolesModalOpen(false)}
        />
      )}

      {/* Profile-safety confirmation for role-bound profiles */}
      {pendingSaveConfirm && (
        <ProfileSaveConfirmModal
          t={t}
          roles={pendingSaveConfirm}
          onCancel={() => setPendingSaveConfirm(null)}
          onConfirm={confirmSave}
        />
      )}
    </div>
  );
}
