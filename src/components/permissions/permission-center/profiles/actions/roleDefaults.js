/**
 * "Default for" assignment
 *
 * Which kinds of person receive this template, and the removal of a
 * role's default. The same endpoint the retired Role → Profile screen used.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: no state of its own, no reads. The panel keeps every state value, every
 * read and both loaders, and hands this factory what it reads through `values`
 * — plus what the factories above it return. The names it needs are listed in
 * the signature — nothing else.
 */

export function roleDefaultWrites({
  selectedProfile,
  defaultRoleChoice,
  setDefaultRoleBusy,
  setDefaultRoleMsg,
  setDefaultRoleErr,
  t,
  setDefaultRoleChoice,
  fetchProfiles,
  setRemoveBusy,
  setRemoveMsg,
  setRemoveErr,
}) {
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

  return {
    assignRoleDefault,
    removeRoleDefault,
  };
}
