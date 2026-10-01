/**
 * Authorization — eligibility administration reads (REPOSITORY layer).
 *
 * The two statements the eligibility-administration service needs. SQL is
 * byte-identical to what used to sit inline in `eligibility-admin.js`.
 *
 * The third read it needs — the feature-eligibility rows for a role + groups —
 * is the exact statement already named in
 * `@/models/authorization/contextReads`, so the service reuses that one instead
 * of holding a second copy of it.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per query, no
 * decisions.
 */

import db from "@/lib/db";

/** The capability rows stored on one access-profile template. */
export function getProfileCapabilityRows(profileId) {
  return db.execute({
    sql: `SELECT module, capability, access_level
          FROM access_profile_capabilities WHERE profile_id = ?`,
    args: [profileId],
  });
}

/**
 * The role-default templates that still grant a capability of any of the given
 * modules. Callers pass the modules (the mapping from a feature key to its
 * modules is a decision, made in the service).
 */
export function getTemplatesGrantingModules(roleName, modules) {
  const placeholders = modules.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT DISTINCT ap.id, ap.name, apc.module, apc.capability
          FROM role_access_profile_defaults rpd
          JOIN access_profiles ap ON ap.id = rpd.access_profile_id
          JOIN access_profile_capabilities apc ON apc.profile_id = ap.id
          WHERE rpd.role_name = ? AND apc.module IN (${placeholders})
          ORDER BY ap.name, apc.module, apc.capability`,
    args: [roleName, ...modules],
  });
}
