/**
 * The optimistic half of a capability quick-action.
 *
 * It applies one action to a deep copy of the person's permission payload and
 * returns the copy: no React state, no network, no messages. The screen keeps
 * the fetch, the "updating" message and the rollback on failure; this only
 * computes what the grid shows while the write is in flight. Extracted verbatim
 * from PersonAccessScreen.js's `applyQuickAction`.
 */
export default function applyOptimisticQuickAction(
  userPerms,
  action,
  module,
  capability,
  level,
) {
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

  return newPerms;
}
