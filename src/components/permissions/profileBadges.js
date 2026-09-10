/**
 * PHASE UI-2c — Profile badge derivation (pure, unit-tested).
 *
 * The profile list marks what matters before you open a profile:
 *   roleDefault → this profile is the default for one or more roles
 *   inactive    → disabled profile (guarded server-side when it is a default)
 *   superAdmin  → the platform-wide profile (visually distinct, never hidden)
 */
export function deriveProfileBadges(profile, isDefaultFor = []) {
  const badges = [];
  if (Array.isArray(isDefaultFor) && isDefaultFor.length > 0) {
    badges.push("roleDefault");
  }
  if (profile && (Number(profile.is_active) === 0 || profile.is_active === false)) {
    badges.push("inactive");
  }
  if (/super\s*admin/i.test(String(profile?.name || ""))) {
    badges.push("superAdmin");
  }
  return badges;
}
