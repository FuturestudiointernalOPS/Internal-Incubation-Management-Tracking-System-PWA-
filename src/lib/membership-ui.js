// Pure UI helpers for the Membership Control Center (admin/crm/membership).
// Kept framework-free so they can be unit-tested with jest.

/** A membership is displayed as "expiring soon" when its expiry is within this window. */
export const EXPIRING_SOON_DAYS = 30;

/**
 * Derive the DISPLAY membership status from the backend row.
 *
 * Backend statuses: active | expired | ended (the resolver also treats an
 * active row with a past expires_at as expired). "Expiring soon" is a pure
 * UI derivation — it never changes what the backend enforces.
 *
 * @param {{status?: string|null, expires_at?: string|null}} membership
 * @param {Date} [now]
 * @returns {"active"|"expiringSoon"|"expired"|"ended"}
 */
export function deriveMembershipStatus(membership, now = new Date()) {
  const status = String(membership?.status || "").toLowerCase();
  if (status === "ended") return "ended";
  if (status === "expired") return "expired";

  // status === "active" (or unknown → treat as active for display)
  const expiresAt = membership?.expires_at ? new Date(membership.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    if (expiresAt.getTime() <= now.getTime()) return "expired";
    const days = (expiresAt.getTime() - now.getTime()) / 86_400_000;
    if (days <= EXPIRING_SOON_DAYS) return "expiringSoon";
  }
  return "active";
}

/** True when the backend considers this membership effective (authorization-contributing). */
export function isEffectiveMembership(membership, now = new Date()) {
  const status = String(membership?.status || "").toLowerCase();
  if (status === "ended" || status === "expired") return false;
  const expiresAt = membership?.expires_at ? new Date(membership.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** Sort groups for the selector: protected groups first, then alphabetically. */
export function sortGroups(groups) {
  return [...groups].sort((first, second) => {
    if (first.isProtected !== second.isProtected) return first.isProtected ? -1 : 1;
    return String(first.name).localeCompare(String(second.name));
  });
}

/** Stable dedupe of roster rows by user+group (last row wins). */
export function dedupeMemberships(rows) {
  const map = new Map();
  for (const membership of rows) map.set(`${membership.user_cid}|${membership.group_name}`, membership);
  return [...map.values()];
}
