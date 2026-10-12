/**
 * LEGACY GLOBAL-ROLE CLEANUP — decisions (SERVICE layer).
 *
 * Phase H of docs/ROADMAP_ROLES_PROFILES_ACCESS.md. The global identity on
 * `contacts.role` must be a BASELINE identity only (super_admin / staff /
 * member); every other value is contextual and belongs to a relationship row or
 * a profile card. This module answers the questions that make the alignment
 * safe:
 *
 *   - which value is a baseline identity, a known PROFILE, or a retired label?
 *   - the "relevé" of accounts still carrying a legacy value (the Phase H
 *     "preuve de zéro dépendance" the roadmap requires before aligning);
 *   - is the alignment SAFE (no legacy account left)?
 *
 * The SQL lives in `@/models/authorization/legacyRoleCleanupStore`. This file
 * decides; it never runs a statement itself, and it reads the profile catalogue
 * from the DATABASE — never from a hardcoded list.
 */

import { BASELINE_IDENTITIES } from "@/lib/identity";
import { listProfiles } from "@/models/authorization/profilesStore";
import {
  listContactRoleCounts,
  listContactsByRole,
  alignContactsFromRoleToBaseline,
} from "@/models/authorization/legacyRoleCleanupStore";

/** The baseline a legacy account is aligned onto. */
export const DEFAULT_BASELINE_ROLE = "member";

/** The stored allowed_roles (JSON string / array / null) as a string array. */
function parseAllowedRoles(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * The profile ceiling per key, read from the DATABASE: `Map<key, allowedRoles>`.
 * Everything below classifies against THIS map, so a profile created from the
 * profiles screen is recognised without any hardcoded list.
 */
export function profileRoleMapFromRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row?.key ?? ""), parseAllowedRoles(row?.allowed_roles));
  }
  return map;
}

/**
 * Classify one `contacts.role` value.
 *
 *   "baseline" — one of the three identities the column is meant to hold.
 *   "profile"  — a profile the DATABASE holds: the information it stands for
 *                lives in `profile_assignments`.
 *   "retired"  — neither: a leftover label no profile claims.
 *   "empty"    — no role at all (a data defect the survey must surface too).
 *
 * @param {string|null|undefined} role
 * @param {Map<string, string[]>} [profileRoleMap]  the DB profile ceilings
 * @returns {"baseline"|"profile"|"retired"|"empty"}
 */
export function classifyRoleValue(role, profileRoleMap) {
  const value = String(role ?? "").trim();
  if (!value) return "empty";
  if (BASELINE_IDENTITIES.includes(value)) return "baseline";
  return profileRoleMap?.has?.(value) ? "profile" : "retired";
}

/** True when the value is NOT a baseline identity (so it must be aligned away). */
export function isLegacyRoleValue(role, profileRoleMap) {
  const kind = classifyRoleValue(role, profileRoleMap);
  return kind === "profile" || kind === "retired";
}

/**
 * The baseline identity a legacy value is aligned ONTO.
 *
 * It must keep the person's profile OPEN: a staff-only profile
 * (`program_manager`, `venture_manager`) aligns to `staff`, everything else
 * (member-open profiles and retired labels) to the member default. Aligning a
 * staff-only profile holder to `member` would make the profile rule refuse them
 * the moment it is enforced — the very loss Phase H must avoid. The
 * role list comes from the profile's OWN stored rows.
 *
 * @param {string} role
 * @param {Map<string, string[]>} [profileRoleMap]  the DB profile ceilings
 * @returns {"staff"|"member"}
 */
export function targetBaselineForRole(role, profileRoleMap) {
  const allowed = profileRoleMap?.get?.(String(role ?? "")) || [];
  if (allowed.includes("member")) return "member";
  if (allowed.includes("staff")) return "staff";
  return DEFAULT_BASELINE_ROLE;
}

/**
 * Turn the grouped role counts into the Phase H report (PURE).
 *
 * @param {Array<{role: string, count: number|string}>} counts
 * @param {Map<string, string[]>} [profileRoleMap]  the DB profile ceilings
 * @returns {{baseline: Array, legacy: Array, totalContacts: number,
 *   totalLegacy: number, safe: boolean}}
 *   `safe` is true only when NO account carries a legacy value — the gate the
 *   roadmap sets before the alignment is declared complete.
 */
export function buildLegacyRoleReport(counts = [], profileRoleMap = new Map()) {
  const baseline = [];
  const legacy = [];
  let totalContacts = 0;

  for (const row of counts) {
    const role = String(row?.role ?? "");
    const count = Number(row?.count) || 0;
    totalContacts += count;
    const kind = classifyRoleValue(role, profileRoleMap);
    const entry = { role, count, kind };
    // An empty role is neither baseline nor a profile, but it is a defect the
    // survey must still surface — it is grouped with the legacy values.
    if (kind === "baseline") baseline.push(entry);
    else legacy.push({ ...entry, target: targetBaselineForRole(role, profileRoleMap) });
  }

  const totalLegacy = legacy.reduce((sum, entry) => sum + entry.count, 0);
  return {
    baseline,
    legacy,
    totalContacts,
    totalLegacy,
    safe: totalLegacy === 0,
  };
}

/**
 * The full survey: counts + the accounts behind each legacy value. The profile
 * ceilings are read from the DATABASE (profiles table), so the classification
 * reflects the profiles that actually exist.
 *
 * @returns {Promise<object>} the report plus an `accounts` map keyed by role.
 */
export async function surveyLegacyRoles() {
  const [countsRes, profilesRes] = await Promise.all([
    listContactRoleCounts(),
    listProfiles(),
  ]);
  const profileRoleMap = profileRoleMapFromRows(profilesRes?.rows);
  const report = buildLegacyRoleReport(countsRes?.rows || [], profileRoleMap);

  const accounts = {};
  for (const entry of report.legacy) {
    const res = await listContactsByRole(entry.role);
    accounts[entry.role] = (res?.rows || []).map((row) => ({
      cid: row.cid,
      name: row.name,
      status: row.status,
    }));
  }

  return { ...report, accounts };
}

/**
 * Align legacy `contacts.role` values onto the baseline.
 *
 * Additive and reversible by construction: it only rewrites the role COLUMN,
 * guarded by the exact legacy value, and deletes nothing. The relationships and
 * the profile cards that already describe the context are untouched — which is
 * what lets "the people concerned keep everything through their profiles"
 * (roadmap §10 acceptance).
 *
 * @param {{roleValue?: string|null}} args
 *   `roleValue` aligns ONE value; omit it to align every legacy value.
 * @returns {Promise<{success: boolean, aligned: Array, skipped: Array,
 *   toRole: string, error?: string}>}
 */
export async function alignLegacyRoles({ roleValue = null } = {}) {
  const survey = await surveyLegacyRoles();

  const targets = roleValue
    ? survey.legacy.filter((entry) => entry.role === String(roleValue))
    : survey.legacy;

  if (roleValue && targets.length === 0) {
    return {
      success: false,
      error: "not a legacy role value",
      aligned: [],
      skipped: [],
      toRole: DEFAULT_BASELINE_ROLE,
    };
  }

  const aligned = [];
  for (const entry of targets) {
    const toRole = entry.target || DEFAULT_BASELINE_ROLE;
    const result = await alignContactsFromRoleToBaseline({
      fromRole: entry.role,
      toRole,
    });
    aligned.push({
      role: entry.role,
      kind: entry.kind,
      to_role: toRole,
      aligned: Number(result?.rowsAffected ?? 0),
    });
  }

  return {
    success: true,
    aligned,
    // Legacy values that were left alone because a single value was requested.
    skipped: roleValue
      ? survey.legacy.filter((entry) => entry.role !== String(roleValue))
      : [],
    toRole: DEFAULT_BASELINE_ROLE,
  };
}
