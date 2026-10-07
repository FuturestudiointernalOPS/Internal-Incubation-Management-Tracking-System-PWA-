/**
 * BASE-CAPABILITY PRECEDENCE (SERVICE layer).
 *
 * A person's base capabilities resolve in one order, and it is the SAME order
 * the resolver uses (`@/services/authorization/contextResolver`):
 *
 *   1. an active profile assigned to the contact wins   → "profile"
 *   2. otherwise the role's active default profile       → "role_default"
 *   3. otherwise the legacy `role_capabilities` rows     → "legacy"
 *
 * Only the base layer is read (the group and individual layers are additive and
 * are not touched by a profile assignment), so the assignment guard can warn
 * *before* a swap replaces that base and strips capabilities.
 *
 * profiles takeover (docs/PROFILES_TAKEOVER_MIGRATION.md): the resolution goes
 * through the PROFILE KEY only (`profiles` + `profile_capabilities`), with the
 * legacy `role_capabilities` rows as the final step — the SAME path the resolver
 * uses, so the guard and the effective access can never disagree. The statements
 * live in `@/models/authorization` (`contextReads` / `baseCapabilityReads`).
 *
 * @returns {Promise<{source: "profile"|"role_default"|"legacy", profileName: string|null, caps: Array<{module: string, capability: string, access_level: number}>}>}
 */

import {
  getContactBaseState,
} from "@/models/authorization/baseCapabilityReads";
import {
  resolveContactBaseProfile,
  resolveRoleDefaultBaseProfile,
  getBaseCapabilityRows,
} from "@/models/authorization/contextReads";
import { pickBaseProfile } from "./contextResolver";

export async function resolveCurrentBaseCapabilities(userCid) {
  const contact = (await getContactBaseState(userCid)).rows[0] || {};
  const role = contact.role;

  const [overrideRes, roleDefaultRes] = await Promise.all([
    contact.profile_key
      ? resolveContactBaseProfile({
          profileKey: contact.profile_key ?? null,
        })
      : Promise.resolve({ rows: [] }),
    role
      ? resolveRoleDefaultBaseProfile(role)
      : Promise.resolve({ rows: [] }),
  ]);

  let source = "legacy";
  let profileKey = null;
  let profileName = null;
  const overridePick = pickBaseProfile(overrideRes.rows);
  const rolePick = pickBaseProfile(roleDefaultRes.rows);
  if (overridePick) {
    ({ profileKey, profileName } = overridePick);
    source = "profile";
  } else if (rolePick) {
    ({ profileKey, profileName } = rolePick);
    source = "role_default";
  }

  const capsRes = await getBaseCapabilityRows({ profileKey, role });

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
