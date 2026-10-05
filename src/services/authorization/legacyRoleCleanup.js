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
 * decides; it never runs a statement itself. It imports only pure vocabulary.
 */

import { BASELINE_IDENTITIES } from "@/lib/identity";
import {
  PROFILE_KEYS,
  baselineRoleForProfile,
} from "@/models/authorization/profile-catalog";
import {
  listContactRoleCounts,
  listContactsByRole,
  alignContactsFromRoleToBaseline,
} from "@/models/authorization/legacyRoleCleanupStore";

/** The baseline a legacy account is aligned onto. */
export const DEFAULT_BASELINE_ROLE = "member";

/**
 * Classify one `contacts.role` value.
 *
 *   "baseline" — one of the three identities the column is meant to hold.
 *   "profile"  — a contextual profile the catalogue knows (Phase A): the
 *                information it stands for lives in `profile_assignments`.
 *   "retired"  — neither: a leftover label no catalogue claims.
 *   "empty"    — no role at all (a data defect the survey must surface too).
 *
 * @param {string|null|undefined} role
 * @returns {"baseline"|"profile"|"retired"|"empty"}
 */
export function classifyRoleValue(role) {
  const value = String(role ?? "").trim();
  if (!value) return "empty";
  if (BASELINE_IDENTITIES.includes(value)) return "baseline";
  if (PROFILE_KEYS.includes(value)) return "profile";
  return "retired";
}

/** True when the value is NOT a baseline identity (so it must be aligned away). */
export function isLegacyRoleValue(role) {
  const kind = classifyRoleValue(role);
  return kind === "profile" || kind === "retired";
}

/**
 * The baseline identity a legacy value is aligned ONTO.
 *
 * It must keep the person's profile OPEN: a staff-only profile
 * (`program_manager`, `venture_manager`) aligns to `staff`, everything else
 * (member-open profiles and retired labels) to the member default. Aligning a
 * staff-only profile holder to `member` would make the profile rule refuse them
 * the moment it is enforced — the very loss Phase H must avoid.
 *
 * @param {string} role
 * @returns {"staff"|"member"}
 */
export function targetBaselineForRole(role) {
  return baselineRoleForProfile(String(role ?? "")) || DEFAULT_BASELINE_ROLE;
}

/**
 * Turn the grouped role counts into the Phase H report (PURE).
 *
 * @param {Array<{role: string, count: number|string}>} counts
 * @returns {{baseline: Array, legacy: Array, totalContacts: number,
 *   totalLegacy: number, safe: boolean}}
 *   `safe` is true only when NO account carries a legacy value — the gate the
 *   roadmap sets before the alignment is declared complete.
 */
export function buildLegacyRoleReport(counts = []) {
  const baseline = [];
  const legacy = [];
  let totalContacts = 0;

  for (const row of counts) {
    const role = String(row?.role ?? "");
    const count = Number(row?.count) || 0;
    totalContacts += count;
    const kind = classifyRoleValue(role);
    const entry = { role, count, kind };
    // An empty role is neither baseline nor a profile, but it is a defect the
    // survey must still surface — it is grouped with the legacy values.
    if (kind === "baseline") baseline.push(entry);
    else legacy.push({ ...entry, target: targetBaselineForRole(role) });
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
 * The full survey: counts + the accounts behind each legacy value.
 *
 * @returns {Promise<object>} the report plus an `accounts` map keyed by role.
 */
export async function surveyLegacyRoles() {
  const countsRes = await listContactRoleCounts();
  const report = buildLegacyRoleReport(countsRes?.rows || []);

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
    const toRole = targetBaselineForRole(entry.role);
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
