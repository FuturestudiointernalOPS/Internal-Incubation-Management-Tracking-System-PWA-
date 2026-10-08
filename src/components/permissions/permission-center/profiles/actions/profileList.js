/**
 * The profile list's writes
 *
 * Create, duplicate, activate/deactivate, delete and rename. Deletion is
 * offered here but never decided here: the server blocks an in-use profile and
 * this only renders the refusal, item by item.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: no state of its own, no reads. The panel keeps every state value, every
 * read and both loaders, and hands this factory what it reads through `values`
 * — plus what the factories above it return. The names it needs are listed in
 * the signature — nothing else.
 */

export function profileList({
  newProfile,
  setActionMsg,
  setActionError,
  t,
  setShowCreateForm,
  setNewProfile,
  fetchProfiles,
  selectProfile,
  deleteBusy,
  confirm,
  impactTotal,
  setDeleteBusy,
  setSelectedProfile,
  selectedProfile,
  renameValue,
  setRenameMode,
}) {
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

  return {
    createProfile,
    duplicateProfile,
    toggleProfileActive,
    deleteProfile,
    renameProfile,
  };
}
