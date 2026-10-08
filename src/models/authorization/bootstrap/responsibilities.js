import db, { initDb } from "@/lib/db";
import { RESPONSIBILITY_FEATURE_ROLES } from "@/lib/featureAccess";
import { ensureResponsibilitiesSchema } from "./schema";

/**
 * Authorization bootstrap — the responsibilities catalogue (REPOSITORY layer).
 *
 * The fixed default-responsibility definitions, seeded once per process. Split
 * verbatim out of `models/authorization/bootstrap.js` — see docs/LAYER_SPLIT.md.
 */

// The default-responsibility seed is a fixed catalogue: run it once per process
// (see seedDefaultResponsibilities). Request paths that call it on every read
// are answered from this promise after the first call.
let responsibilitiesSeedPromise = null;

/**
 * Seed default responsibilities.
 */
export async function seedDefaultResponsibilities() {
  // Once per process. The definitions are a fixed catalogue that only changes
  // when the code changes, and the allowed_roles pass is fill-only by design —
  // so repeating them per request bought nothing and cost 24 round trips on
  // every read of the responsibilities screen. A failure clears the memo so the
  // next call retries instead of the process caching a broken state.
  if (!responsibilitiesSeedPromise) {
    responsibilitiesSeedPromise = seedDefaultResponsibilitiesOnce().catch((error) => {
      responsibilitiesSeedPromise = null;
      return { success: false, error: error.message };
    });
  }
  return responsibilitiesSeedPromise;
}

async function seedDefaultResponsibilitiesOnce() {
  try {
    await initDb();
    await ensureResponsibilitiesSchema();

    const defaults = [
      {
        name: "CRM",
        key: "crm",
        description: "People, contacts, timeline, membership, duplicates",
        icon: "Users",
      },
      {
        name: "Communication",
        key: "communication",
        description: "Messaging, announcements, forms — outreach suite",
        icon: "Send",
      },
      {
        name: "Programs",
        key: "programs",
        description: "Program oversight — programs, participants, submissions",
        icon: "Briefcase",
      },
      {
        name: "Ventures",
        key: "ventures",
        description: "Venture management — portfolio and registrations",
        icon: "Rocket",
      },
      {
        name: "Investors",
        key: "investors",
        description: "Investor management — records, reviews, campaigns",
        icon: "TrendingUp",
      },
      {
        name: "Finance",
        key: "finance",
        description: "Financial operations — budgets, reports",
        icon: "BarChart3",
      },
      {
        name: "Operations",
        key: "operations",
        description: "Internal operations — projects, tasks, standups, retros",
        icon: "Settings",
      },
      {
        name: "Reports",
        key: "reports",
        description: "Reports and analytics",
        icon: "BarChart3",
      },
      {
        name: "Knowledge",
        key: "knowledge",
        description: "Knowledge management",
        icon: "Library",
      },
      {
        name: "LMS",
        key: "lms",
        description: "Course management — create and maintain courses",
        icon: "GraduationCap",
      },
      {
        name: "Security",
        key: "security",
        description: "User administration — personnel, permissions",
        icon: "Users",
      },
      {
        name: "Settings",
        key: "settings",
        description: "System configuration and engineering operations",
        icon: "Settings",
      },
    ];

    // 1. Definitions — ONE multi-row statement instead of 12 round trips.
    //    Same ON CONFLICT (key) upsert as before, same values as the incoming
    //    row (EXCLUDED), so re-running is still a no-op for existing rows.
    await db.execute({
      sql: `INSERT INTO responsibilities (name, key, description, icon, allowed_roles, is_active)
            VALUES ${defaults.map(() => "(?, ?, ?, ?, ?, 1)").join(", ")}
            ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon`,
      args: defaults.flatMap((resp) => [
        resp.name,
        resp.key,
        resp.description,
        resp.icon,
        JSON.stringify(RESPONSIBILITY_FEATURE_ROLES[resp.key] || []),
      ]),
    });

    // 2. Backfill allowed_roles ONLY where it has never been configured. Manual
    //    Super Admin edits (including an explicit empty list) are never touched.
    //    ONE statement instead of 12 round trips.
    await db.execute({
      sql: `UPDATE responsibilities AS r
            SET allowed_roles = v.roles
            FROM (VALUES ${defaults
              .map(() => "(CAST(? AS TEXT), CAST(? AS TEXT))")
              .join(", ")}) AS v(key, roles)
            WHERE r.key = v.key
              AND (r.allowed_roles IS NULL OR TRIM(r.allowed_roles) = '')`,
      args: defaults.flatMap((resp) => [
        resp.key,
        JSON.stringify(RESPONSIBILITY_FEATURE_ROLES[resp.key] || []),
      ]),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
