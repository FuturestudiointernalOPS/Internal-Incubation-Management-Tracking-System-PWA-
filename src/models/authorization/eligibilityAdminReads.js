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

/**
 * The role-default PROFILES that still grant a capability of any of the given
 * modules. Callers pass the modules (the mapping from a feature key to its
 * modules is a decision, made in the service).
 *
 * Reads the takeover's `role_profile_defaults` + `profile_capabilities` — the
 * access-profile tables no longer carry what a role default grants.
 */
export function getTemplatesGrantingModules(roleName, modules) {
  const placeholders = modules.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT DISTINCT p.key AS profile_key, p.label AS name, pc.module, pc.capability
          FROM role_profile_defaults rpd
          JOIN profiles p ON p.key = rpd.profile_key
          JOIN profile_capabilities pc ON pc.profile_key = p.key
          WHERE rpd.role_name = ? AND pc.module IN (${placeholders})
          ORDER BY p.label, pc.module, pc.capability`,
    args: [roleName, ...modules],
  });
}
