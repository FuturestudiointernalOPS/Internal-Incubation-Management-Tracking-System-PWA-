import db, { initDb } from "@/lib/db";
import { PERMISSION_MODULES } from "@/server/authz/capabilities";

/**
 * Authorization bootstrap — default grants (REPOSITORY layer).
 *
 * The catalogue every environment starts from: the baseline role capabilities.
 * All upserts, so running them again is a no-op. Split verbatim out of
 * `models/authorization/bootstrap.js` — see docs/LAYER_SPLIT.md.
 *
 * The named Access Profiles and their role bindings used to be seeded here too
 * (`seedDefaultAccessProfiles`). That layer is retired: the profiles and their
 * role defaults are seeded directly by `profileCatalogueSeed.js`.
 */

export async function seedDefaultRoleCapabilities() {
  try {
    await initDb();
    const defaults = {
      super_admin: Object.fromEntries(
        Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => [
          moduleKey,
          Object.fromEntries(module.capabilities.map((capability) => [capability, 5])),
        ]),
      ),
      staff: {
        projects: { view: 1, create: 2, edit: 3 },
        programs: { view: 1 },
        reports: { view: 1, create: 2 },
        messaging: { view: 1, send: 2 },
        contacts: { view: 1 },
      },
      participant: {
        projects: { view: 1 },
        messaging: { view: 1, send: 2 },
      },
    };
    for (const [role, modules] of Object.entries(defaults)) {
      for (const [module, caps] of Object.entries(modules)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO role_capabilities (role, module, capability, access_level) VALUES (?, ?, ?, ?) ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?`,
            args: [role, module, capability, level, level],
          });
        }
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
