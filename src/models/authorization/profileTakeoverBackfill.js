/**
 * PROFILES TAKE OVER — one-time data migration (tranche 2).
 *
 * docs/PROFILES_TAKEOVER_MIGRATION.md. This tranche moves the DATA from the
 * `access_profiles` template layer onto the `profiles` catalogue, WITHOUT
 * switching the resolver: until tranche 3 reads `profile_capabilities`, nothing
 * about anyone's effective access changes.
 *
 * What it does, once per database:
 *   1. converts each seeded access profile into a PROFILE carrying its
 *      capabilities (`profile_capabilities`);
 *   2. copies `role_access_profile_defaults` → `role_profile_defaults`
 *      (role → PROFILE KEY);
 *   3. fills `context_role_profiles.profile_key` from its `profile_id`;
 *   4. fills `contacts.profile_key` from its `access_profile_id`.
 *
 * Idempotent and administrator-respecting, exactly like the other backfills:
 * every INSERT is `ON CONFLICT DO NOTHING` (an administrator's later edit wins)
 * and every UPDATE only fills a NULL column. Re-running changes nothing.
 *
 * Product decisions baked into the mapping:
 *   • `program_manager` is ONE profile with PROGRAM-ONLY access — the seeded
 *     "Assigned Program Manager" set. The portfolio "Program Manager" template is
 *     NOT copied (its capabilities would re-widen the profile); it is only used
 *     to resolve the bridges that pointed at it.
 *   • The ad-hoc templates (Project Owner, Operations Manager, Instructor,
 *     Finance Assistant) become profiles too, so nothing they grant is lost.
 *   • The baseline templates (Super Admin Default, Staff Default, Venture Member)
 *     also become profiles: every capability set is dynamic and editable.
 */

import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { ensureProfileCapabilitiesSchema } from "./profileCapabilitiesStore";

/**
 * Access profile NAME → the profile it becomes.
 *
 * `key` is the target profile key; `context`/`allowedRoles` seed the row when it
 * does not exist yet; `copyCaps: false` means the template is only a bridge and
 * its capabilities are NOT copied (the "Program Manager" portfolio case, whose
 * programme-only replacement is "Assigned Program Manager").
 */
export const ACCESS_PROFILE_TO_PROFILE = [
  {
    accessProfile: "Super Admin Default",
    key: "super_admin_default",
    context: "global",
    allowedRoles: ["super_admin"],
  },
  {
    accessProfile: "Staff Default",
    key: "staff_default",
    context: "global",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Venture Member",
    key: "venture_member",
    context: "venture",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Participant Default",
    key: "participant",
    context: "program",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Mentor",
    key: "investor",
    context: "investor",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Founder",
    key: "founder",
    context: "venture",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Learner",
    key: "learner",
    context: "lms",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Venture Manager",
    key: "venture_manager",
    context: "venture",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Assigned Program Manager",
    key: "program_manager",
    context: "program",
    allowedRoles: ["staff"],
  },
  {
    // Merged away: `program_manager` keeps the programme-only set above. Present
    // here ONLY so the bridges that pointed at it resolve to the right key.
    accessProfile: "Program Manager",
    key: "program_manager",
    copyCaps: false,
  },
  {
    accessProfile: "Project Owner",
    key: "project_owner",
    context: "staff",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Operations Manager",
    key: "operations_manager",
    context: "staff",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Instructor",
    key: "instructor",
    context: "staff",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Finance Assistant",
    key: "finance_assistant",
    context: "staff",
    allowedRoles: ["staff"],
  },
];

/** One-time, idempotent, admin-respecting. Never throws on a soft failure. */
export async function ensureProfileTakeover() {
  await ensurePermissionsSchema();
  await ensureProfileCapabilitiesSchema();

  const profilesRes = await db.execute({
    sql: "SELECT id, name FROM access_profiles",
    args: [],
  });
  const byName = new Map();
  for (const row of profilesRes.rows || []) byName.set(String(row.name), row);
  const byId = new Map();
  for (const row of profilesRes.rows || []) byId.set(Number(row.id), String(row.name));

  const report = { profiles: 0, capabilities: 0, roleDefaults: 0, contextRows: 0, overrides: 0 };

  // 1. Convert each mapped access profile into a profile, with its capabilities.
  for (const mapping of ACCESS_PROFILE_TO_PROFILE) {
    const source = byName.get(mapping.accessProfile);
    if (!source) continue;

    const inserted = await db.execute({
      sql: `INSERT INTO profiles (key, context, allowed_roles, is_active, label)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT (key) DO NOTHING`,
      args: [
        mapping.key,
        mapping.context || "global",
        JSON.stringify(mapping.allowedRoles || []),
        mapping.accessProfile,
      ],
    });
    report.profiles += inserted?.rowsAffected ?? 0;

    // A label must exist for the resolver's `profileName` to keep reading the way
    // it always did (the access-profile name). NULL-only, so an administrator's
    // rename wins.
    await db.execute({
      sql: `UPDATE profiles SET label = ?, updated_at = NOW()
            WHERE key = ? AND (label IS NULL OR label = '')`,
      args: [mapping.accessProfile, mapping.key],
    });

    if (mapping.copyCaps === false) continue;

    const capsRes = await db.execute({
      sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
      args: [source.id],
    });
    for (const cap of capsRes.rows || []) {
      const capInsert = await db.execute({
        sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        args: [mapping.key, cap.module, cap.capability, cap.access_level],
      });
      report.capabilities += capInsert?.rowsAffected ?? 0;
    }
  }

  // 2. Role defaults → profile keys.
  const defaultsRes = await db.execute({
    sql: "SELECT role_name, access_profile_id FROM role_access_profile_defaults",
    args: [],
  });
  for (const row of defaultsRes.rows || []) {
    const key = profileKeyForAccessProfileId(row.access_profile_id, byId);
    if (!key) continue;
    const res = await db.execute({
      sql: `INSERT INTO role_profile_defaults (role_name, profile_key)
            VALUES (?, ?)
            ON CONFLICT (role_name) DO NOTHING`,
      args: [String(row.role_name), key],
    });
    report.roleDefaults += res?.rowsAffected ?? 0;
  }

  // 3. Context registry rows → profile keys (NULL-only, admin mappings win).
  const ctxRes = await db.execute({
    sql: "SELECT id, profile_id FROM context_role_profiles WHERE profile_id IS NOT NULL",
    args: [],
  });
  for (const row of ctxRes.rows || []) {
    const key = profileKeyForAccessProfileId(row.profile_id, byId);
    if (!key) continue;
    const res = await db.execute({
      sql: `UPDATE context_role_profiles SET profile_key = ?, updated_at = NOW()
            WHERE id = ? AND profile_key IS NULL`,
      args: [key, Number(row.id)],
    });
    report.contextRows += res?.rowsAffected ?? 0;
  }

  // 4. Per-person overrides → profile keys (NULL-only).
  for (const [accessProfileId, name] of byId.entries()) {
    const key = profileKeyForAccessProfileName(name);
    if (!key) continue;
    const res = await db.execute({
      sql: `UPDATE contacts SET profile_key = ?
            WHERE access_profile_id = ? AND profile_key IS NULL`,
      args: [key, accessProfileId],
    });
    report.overrides += res?.rowsAffected ?? 0;
  }

  return { success: true, ...report };
}

/** The profile key an access profile NAME becomes, or null when unmapped. */
export function profileKeyForAccessProfileName(name) {
  const mapping = ACCESS_PROFILE_TO_PROFILE.find(
    (entry) => entry.accessProfile === String(name),
  );
  return mapping ? mapping.key : null;
}

function profileKeyForAccessProfileId(accessProfileId, byId) {
  if (accessProfileId === null || accessProfileId === undefined) return null;
  const name = byId.get(Number(accessProfileId));
  return name ? profileKeyForAccessProfileName(name) : null;
}
