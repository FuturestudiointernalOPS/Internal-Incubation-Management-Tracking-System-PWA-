/**
 * Picking a profile
 *
 * The picker → selection, and the shareable ?profile=<id> URL that
 * follows it. `replaceState` keeps the deep link without importing
 * next/navigation here.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: no state of its own, no reads. The panel keeps every state value, every
 * read and both loaders, and hands this factory what it reads through `values`
 * — plus what the factories above it return. The names it needs are listed in
 * the signature — nothing else.
 */

export function profileSelection({
  setSelectedProfile,
  setProfileCaps,
  setSavedCaps,
  setDraftCaps,
  profiles,
  selectProfile,
}) {
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

  return {
    handleProfilePick,
  };
}
