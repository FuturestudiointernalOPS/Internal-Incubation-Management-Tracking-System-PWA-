/**
 * The draft, its review and its save
 *
 * The working copy of the capabilities, the change count, the explicit
 * save with its audit reason, the safety confirmation for a role-bound
 * profile, and the cleanup of the capabilities the matrix cannot show.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: no state of its own, no reads. The panel keeps every state value, every
 * read and both loaders, and hands this factory what it reads through `values`
 * — plus what the factories above it return. The names it needs are listed in
 * the signature — nothing else.
 */

import {
  toggleCapability,
  toggleFullCapabilities,
} from "@/components/permissions/matrixHelpers";
import { moduleCapabilityParents } from "@/models/authorization/capability-catalog";

export function capsDraft({
  roleDefaults,
  draftCaps,
  savedCaps,
  setActionError,
  setDraftCaps,
  selectedProfile,
  setSaving,
  setActionMsg,
  setSaveViolations,
  reason,
  selectProfile,
  setReason,
  t,
  safetyAck,
  setPendingSaveConfirm,
  setSafetyAck,
  availableModules,
}) {
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

  // The registry truth arrives as a parameter: before the split it was defined
  // later in the component body. The union with the draft/saved modules matters
  // for C1: a stored module the matrix cannot show (ineligible feature, or a
  // module no longer in the registry) is exactly the one the "Remove" action
  // clears, and that change must enable Save.
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

  return {
    defaultRolesFor,
    toggleDraftCap,
    toggleDraftFull,
    saveChanges,
    confirmSave,
    discardChanges,
    computeChanges,
    clearHiddenCaps,
  };
}
