/**
 * Permission Centre — the HEALTH of the permission model, as one pure read.
 *
 * The Journal heads the log with four numbers and three warnings, and the
 * section navigation repeats each warning as a badge. Both come from here, so
 * a badge can never claim an alert the Journal does not show.
 *
 * Pure: takes the already-loaded bundle, returns data + i18n keys. No fetch.
 */

import { SCOPE_POLICIES } from "@/models/authorization/scope-catalog";

/** Days before an invitation expiry that counts as "soon". */
const EXPIRING_DAYS = 7;

/**
 * Health alerts for the current bundle.
 *
 * @param {object} bundle  the loaded centre data (see usePrototypeData)
 * @returns {{alerts: Array, badges: Record<string, number>}}
 */
export function computeAlerts(bundle = {}) {
  const {
    contacts = [],
    profiles = [],
    profileCapsById = {},
    roleDefaults = {},
    eligibilityMatrix = {},
    contextRoles = [],
    moduleToFeature = {},
  } = bundle;

  const alerts = [];
  const peopleByRole = contacts.reduce((counts, contact) => {
    const role = contact.role || "";
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});

  // 1 — Dead rights: a role's default profile still grants a feature whose
  // eligibility ceiling denies it. The prototype's "droits morts". Only roles
  // that actually have people are worth a warning — a ceiling nobody sits
  // under is configuration, not an incident.
  for (const profile of profiles) {
    const caps = profileCapsById[profile.id] || {};
    const roles = Object.entries(roleDefaults)
      .filter(([, value]) => String(value?.profileId ?? value?.profile_id) === String(profile.id))
      .map(([role]) => role);
    for (const role of roles) {
      if (!peopleByRole[role]) continue;
      for (const [module, feature] of Object.entries(moduleToFeature)) {
        if (eligibilityMatrix[role]?.[feature] === 1) continue;
        if (Object.keys(caps[module] || {}).length === 0) continue;
        alerts.push({
          id: `dead-${role}-${feature}`,
          tone: "warn",
          section: "rules",
          tab: "eligibility",
          key: "engineering.permissions.prototype.alerts.deadRights",
          params: { role, feature, profile: profile.name },
        });
        break; // one alert per role+profile is enough to open the door
      }
    }
  }

  // 2 — A contextual link with no profile behind it: the mapping exists, the
  // profile column is empty, so nobody can tell what that link grants.
  const gaps = (contextRoles || []).filter((row) => !row.profile_id && row.is_active !== 0);
  if (gaps.length > 0) {
    alerts.push({
      id: "context-role-gaps",
      tone: "warn",
      section: "profiles",
      tab: "contextRoles",
      key: "engineering.permissions.prototype.alerts.contextGap",
      params: { count: gaps.length },
    });
  }

  // 3 — A declared-but-unimplemented scope policy resolves to DENY: honest,
  // and worth naming rather than discovering during an audit.
  const pending = Object.values(SCOPE_POLICIES).filter((policy) => !policy.implemented);
  if (pending.length > 0) {
    alerts.push({
      id: "scope-pending",
      tone: "warn",
      section: "rules",
      tab: "scope",
      key: "engineering.permissions.prototype.alerts.scopePending",
      params: { count: pending.length, policies: pending.map((policy) => policy.key).join(", ") },
    });
  }

  const badges = { people: 0, profiles: 0, rules: 0, journal: 0 };
  for (const alert of alerts) {
    if (badges[alert.section] !== undefined) badges[alert.section] += 1;
  }
  return { alerts, badges };
}

/**
 * The Journal's four numbers.
 *
 * @returns {{superAdmins:number, profiles:number, changes:number, expiring:number}}
 */
export function journalKpis(bundle = {}) {
  const { contacts = [], profiles = [], auditTotal = 0 } = bundle;
  const now = Date.now();
  const expiring = contacts.filter((contact) => {
    const raw = contact.invitation_expires_at;
    if (!raw) return false;
    const expiresAt = new Date(raw).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now && expiresAt - now <= EXPIRING_DAYS * 86400000;
  }).length;

  return {
    superAdmins: contacts.filter((contact) => String(contact.role).toLowerCase() === "super_admin").length,
    profiles: profiles.length,
    changes: auditTotal,
    expiring,
  };
}
