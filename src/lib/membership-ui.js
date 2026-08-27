// Pure UI helpers for the Membership Control Center (admin/membership).
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
 * @param {{status?: string|null, expires_at?: string|null}} m
 * @param {Date} [now]
 * @returns {"active"|"expiringSoon"|"expired"|"ended"}
 */
export function deriveMembershipStatus(m, now = new Date()) {
  const status = String(m?.status || "").toLowerCase();
  if (status === "ended") return "ended";
  if (status === "expired") return "expired";

  // status === "active" (or unknown → treat as active for display)
  const expiresAt = m?.expires_at ? new Date(m.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    if (expiresAt.getTime() <= now.getTime()) return "expired";
    const days = (expiresAt.getTime() - now.getTime()) / 86_400_000;
    if (days <= EXPIRING_SOON_DAYS) return "expiringSoon";
  }
  return "active";
}

/** True when the backend considers this membership effective (authorization-contributing). */
export function isEffectiveMembership(m, now = new Date()) {
  const status = String(m?.status || "").toLowerCase();
  if (status === "ended" || status === "expired") return false;
  const expiresAt = m?.expires_at ? new Date(m.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** Sort groups for the selector: protected groups first, then alphabetically. */
export function sortGroups(groups) {
  return [...groups].sort((a, b) => {
    if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });
}

/** Stable dedupe of roster rows by user+group (last row wins). */
export function dedupeMemberships(rows) {
  const map = new Map();
  for (const r of rows) map.set(`${r.user_cid}|${r.group_name}`, r);
  return [...map.values()];
}
