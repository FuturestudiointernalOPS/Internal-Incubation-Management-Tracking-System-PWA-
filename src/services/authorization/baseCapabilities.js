/**
 * BASE-CAPABILITY PRECEDENCE (SERVICE layer).
 *
 * A person's base capabilities resolve in one order, and it is the SAME order
 * the resolver uses (`@/services/authorization/contextResolver`):
 *
 *   1. an active access profile assigned to the contact wins   → "profile"
 *   2. otherwise the role's active default profile             → "role_default"
 *   3. otherwise the legacy `role_capabilities` rows           → "legacy"
 *
 * Only the base layer is read (the group and individual layers are additive and
 * are not touched by a profile assignment), so the assignment guard can warn
 * *before* a swap replaces that base and strips capabilities.
 *
 * The rule used to live inside `@/models/authorization.getCurrentBaseCapabilities`
 * (audit A1, finding #1: a business rule next to its SQL). The four statements
 * now live in `@/models/authorization/baseCapabilityReads`; nothing here runs SQL
 * or builds a Response.
 *
 * @returns {Promise<{source: "profile"|"role_default"|"legacy", profileName: string|null, caps: Array<{module: string, capability: string, access_level: number}>}>}
 */

import { getActiveAccessProfile } from "@/models/authorization";
import {
  getContactBaseState,
  getActiveRoleDefaultProfile,
  listProfileCapabilityRows,
  listRoleCapabilityRows,
} from "@/models/authorization/baseCapabilityReads";

export async function resolveCurrentBaseCapabilities(userCid) {
  const contact = (await getContactBaseState(userCid)).rows[0] || {};
  const role = contact.role;

  const [overrideRes, roleDefaultRes] = await Promise.all([
    contact.access_profile_id
      ? getActiveAccessProfile(contact.access_profile_id)
      : Promise.resolve({ rows: [] }),
    role
      ? getActiveRoleDefaultProfile(role)
      : Promise.resolve({ rows: [] }),
  ]);

  let source = "legacy";
  let profileId = null;
  let profileName = null;
  if (overrideRes.rows[0]) {
    source = "profile";
    profileId = overrideRes.rows[0].id;
    profileName = overrideRes.rows[0].name;
  } else if (roleDefaultRes.rows[0]) {
    source = "role_default";
    profileId = roleDefaultRes.rows[0].id;
    profileName = roleDefaultRes.rows[0].name;
  }

  const capsRes = profileId
    ? await listProfileCapabilityRows(profileId)
    : await listRoleCapabilityRows(role);

  return {
    source,
    profileName,
    caps: (capsRes.rows || []).map((row) => ({
      module: row.module,
      capability: row.capability,
      access_level: Number(row.access_level) || 0,
    })),
  };
}
